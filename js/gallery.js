// ============================================================
// gallery.js — Gallery module: multi-upload, tag filter, bulk delete
// ============================================================

import {
  getGalleryImages,
  createGalleryImage,
  deleteGalleryImage,
  getGalleryTags,
} from './api.js';
import { uploadFile, deleteFile } from './storage.js';
import { STORAGE_FOLDERS } from './config.js';
import { showToast } from './toast.js';
import { confirmDialog } from './modal.js';
import { logAction } from './auditLog.js';
import { compressImage, formatFileSize } from './imageCompress.js';

let activeTag = '';
let selectedIds = new Set();

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadTags() {
  const tagFilter = document.getElementById('gallery-tag-filter');
  if (!tagFilter) return;

  try {
    const tags = await getGalleryTags();
    const currentValue = tagFilter.value;

    tagFilter.innerHTML = `<option value="">All Tags</option>` +
      tags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');

    if (currentValue) tagFilter.value = currentValue;
  } catch (err) {
    console.error('Failed to load tags', err);
  }
}

async function loadGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  grid.innerHTML = `<p class="loading-state">Loading images…</p>`;
  selectedIds.clear();
  updateBulkDeleteBtn();

  try {
    const images = await getGalleryImages({ tag: activeTag });
    renderGallery(images);
  } catch (err) {
    grid.innerHTML = `<p class="empty-state error">Failed to load gallery.</p>`;
    showToast('Failed to load gallery', 'error');
    console.error(err);
  }
}

function renderGallery(images) {
  const grid = document.getElementById('gallery-grid');
  if (!images.length) {
    grid.innerHTML = `<p class="empty-state">No images yet. Upload some!</p>`;
    return;
  }

  grid.innerHTML = images.map(image => `
    <div class="gallery-item" data-id="${image.id}">
      <div class="gallery-item__checkbox-wrap">
        <input type="checkbox" class="gallery-item__checkbox" data-id="${image.id}" aria-label="Select image">
      </div>
      <img src="${image.image_url}" alt="${escapeHtml(image.caption || '')}" class="gallery-item__img" loading="lazy">
      <div class="gallery-item__overlay">
        ${image.caption ? `<p class="gallery-item__caption">${escapeHtml(image.caption)}</p>` : ''}
        ${image.tag ? `<span class="badge badge--tag">${escapeHtml(image.tag)}</span>` : ''}
        <button class="btn btn--icon btn--delete gallery-item__delete" data-id="${image.id}" aria-label="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.gallery-item__delete').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteSingle(btn.dataset.id));
  });

  grid.querySelectorAll('.gallery-item__checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.id;
      if (checkbox.checked) {
        selectedIds.add(id);
        checkbox.closest('.gallery-item').classList.add('gallery-item--selected');
      } else {
        selectedIds.delete(id);
        checkbox.closest('.gallery-item').classList.remove('gallery-item--selected');
      }
      updateBulkDeleteBtn();
    });
  });
}

function updateBulkDeleteBtn() {
  const btn = document.getElementById('gallery-bulk-delete-btn');
  if (!btn) return;
  btn.disabled = selectedIds.size === 0;
  btn.textContent = selectedIds.size > 0 ? `Delete Selected (${selectedIds.size})` : 'Delete Selected';
}

async function handleDeleteSingle(id) {
  const confirmed = await confirmDialog('Delete this image? This cannot be undone.');
  if (!confirmed) return;

  try {
    const images = await getGalleryImages();
    const image = images.find(img => img.id === id);
    if (image?.image_path) {
      await deleteFile(image.image_path);
    }
    await deleteGalleryImage(id);
    await logAction('delete', 'gallery', { entityId: id, label: image?.caption || image?.tag || 'image' });
    showToast('Image deleted', 'success');
    await loadGallery();
    await loadTags();
  } catch (err) {
    showToast('Failed to delete image', 'error');
    console.error(err);
  }
}

async function handleBulkDelete() {
  if (selectedIds.size === 0) return;

  const confirmed = await confirmDialog(`Delete ${selectedIds.size} image(s)? This cannot be undone.`);
  if (!confirmed) return;

  let failed = 0;
  try {
    const images = await getGalleryImages();
    const toDelete = images.filter(img => selectedIds.has(img.id));

    for (const image of toDelete) {
      try {
        if (image.image_path) {
          await deleteFile(image.image_path);
        }
        await deleteGalleryImage(image.id);
        await logAction('delete', 'gallery', { entityId: image.id, label: image.caption || image.tag || 'image' });
      } catch (err) {
        failed++;
        console.error(`Failed to delete image ${image.id}`, err);
      }
    }

    if (failed > 0) {
      showToast(`Deleted ${toDelete.length - failed} image(s). ${failed} failed.`, 'warning');
    } else {
      showToast(`Deleted ${toDelete.length} image(s)`, 'success');
    }

    selectedIds.clear();
    await loadGallery();
    await loadTags();
  } catch (err) {
    showToast('Bulk delete failed', 'error');
    console.error(err);
  }
}

async function handleUpload(files) {
  if (!files || files.length === 0) return;

  const tagInput = document.getElementById('gallery-upload-tag');
  const tag = tagInput?.value?.trim() || '';
  const progressContainer = document.getElementById('gallery-upload-progress');

  let uploaded = 0;
  let failed = 0;
  let totalSavedBytes = 0;

  if (progressContainer) {
    progressContainer.textContent = `Uploading 0 / ${files.length}…`;
    progressContainer.classList.remove('hidden');
  }

  for (const file of files) {
    try {
      const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1920 });
      totalSavedBytes += Math.max(0, file.size - compressed.size);

      const { url, path } = await uploadFile(STORAGE_FOLDERS.GALLERY, compressed);
      const record = await createGalleryImage({
        image_url: url,
        image_path: path,
        tag: tag || null,
        caption: null,
        uploaded_at: new Date().toISOString(),
      });
      await logAction('create', 'gallery', { entityId: record.id, label: file.name });
      uploaded++;
      if (progressContainer) {
        progressContainer.textContent = `Uploading ${uploaded} / ${files.length}…`;
      }
    } catch (err) {
      failed++;
      console.error(`Failed to upload ${file.name}`, err);
    }
  }

  if (progressContainer) {
    progressContainer.classList.add('hidden');
    progressContainer.textContent = '';
  }

  if (failed > 0) {
    showToast(`Uploaded ${uploaded} image(s). ${failed} failed.`, 'warning');
  } else {
    const savedMsg = totalSavedBytes > 1024
      ? ` · saved ${formatFileSize(totalSavedBytes)}`
      : '';
    showToast(`Uploaded ${uploaded} image(s) successfully${savedMsg}`, 'success');
  }

  // Reset file input
  const fileInput = document.getElementById('gallery-upload-input');
  if (fileInput) fileInput.value = '';

  await loadGallery();
  await loadTags();
}

export function initGallery() {
  const uploadInput = document.getElementById('gallery-upload-input');
  if (uploadInput) {
    uploadInput.addEventListener('change', () => {
      if (uploadInput.files?.length > 0) {
        handleUpload(Array.from(uploadInput.files));
      }
    });
  }

  const uploadBtn = document.getElementById('gallery-upload-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      uploadInput?.click();
    });
  }

  const tagFilter = document.getElementById('gallery-tag-filter');
  if (tagFilter) {
    tagFilter.addEventListener('change', () => {
      activeTag = tagFilter.value;
      loadGallery();
    });
  }

  const bulkDeleteBtn = document.getElementById('gallery-bulk-delete-btn');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', handleBulkDelete);
  }

  const selectAllBtn = document.getElementById('gallery-select-all-btn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.gallery-item__checkbox');
      const allChecked = checkboxes.length > 0 && [...checkboxes].every(c => c.checked);
      checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const id = cb.dataset.id;
        if (!allChecked) {
          selectedIds.add(id);
          cb.closest('.gallery-item').classList.add('gallery-item--selected');
        } else {
          selectedIds.delete(id);
          cb.closest('.gallery-item').classList.remove('gallery-item--selected');
        }
      });
      updateBulkDeleteBtn();
    });
  }

  loadTags();
  loadGallery();
}
