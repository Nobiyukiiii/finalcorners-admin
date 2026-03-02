// ============================================================
// news.js — News CRUD module (WITH QUILL EDITOR + STORAGE IMAGE)
// ============================================================

import {
  getNewsArticles,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  checkSlugUnique,
} from './api.js';

import { uploadFile, replaceFile, deleteFile } from './storage.js';
import { STORAGE_FOLDERS, PAGINATION } from './config.js';
import { showToast } from './toast.js';
import { openModal, closeModal, confirmDialog } from './modal.js';
import { logAction } from './auditLog.js';
import { compressImage, formatFileSize } from './imageCompress.js';

let currentPage = 1;
let totalCount = 0;
let currentSearch = '';
let editingId = null;
let quillEditor = null;
let selectedNewsIds = new Set();

/* ============================================================
   UTILITIES
============================================================ */

function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ============================================================
   QUILL EDITOR
============================================================ */

function initEditor(initialValue = '') {
  const editorEl = document.getElementById('news-editor');
  if (!editorEl) return;

  if (!quillEditor) {
    quillEditor = new window.Quill('#news-editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline'],
          ['blockquote'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean'],
        ],
      },
    });
  }

  quillEditor.root.innerHTML = initialValue || '';
}

/* ============================================================
   LOAD + RENDER
============================================================ */

async function loadNews() {
  const tbody = document.getElementById('news-table-body');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="table-loading">Loading…</td></tr>`;

  try {
    const { data, count } = await getNewsArticles({
      page: currentPage,
      pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
      search: currentSearch,
    });

    totalCount = count;
    renderTable(data);
    renderPagination();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-error">Failed to load news.</td></tr>`;
    showToast('Failed to load news', 'error');
  }
}

function renderTable(articles) {
  const tbody = document.getElementById('news-table-body');

  if (!articles.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No articles found.</td></tr>`;
    selectedNewsIds.clear();
    updateNewsActions();
    return;
  }

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  tbody.innerHTML = articles.map(article => `
    <tr>
      <td style="width:40px;">
        <input type="checkbox" class="table-checkbox news-row-check" data-id="${article.id}" aria-label="Select article" ${selectedNewsIds.has(article.id) ? 'checked' : ''}>
      </td>
      <td>
        ${article.featured_image
          ? `<img src="${article.featured_image}" alt="${escHtml(article.title)}" class="table-thumbnail">`
          : `<div class="table-thumbnail-placeholder">📰</div>`}
      </td>
      <td>
        <div class="td-primary">${escHtml(article.title)}</div>
        <div class="td-secondary">${escHtml(article.slug)}</div>
      </td>
      <td>${formatDate(article.published_at)}</td>
      <td>
        ${article.published_at
          ? `<span class="badge badge--released">Published</span>`
          : `<span class="badge badge--draft">Draft</span>`}
      </td>
      <td class="td-actions">
        <button class="btn btn--icon btn--edit" data-id="${article.id}" aria-label="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn--icon btn--delete" data-id="${article.id}" aria-label="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.news-row-check').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedNewsIds.add(cb.dataset.id);
      else selectedNewsIds.delete(cb.dataset.id);
      syncNewsSelectAll();
      updateNewsActions();
    });
  });

  tbody.querySelectorAll('.btn--edit').forEach(btn =>
    btn.addEventListener('click', () => openEditModal(btn.dataset.id))
  );
  tbody.querySelectorAll('.btn--delete').forEach(btn =>
    btn.addEventListener('click', () => handleDelete(btn.dataset.id))
  );

  syncNewsSelectAll();
  updateNewsActions();
}

function renderPagination() {
  const info = document.getElementById('news-pagination-info');
  const prev = document.getElementById('news-prev-btn');
  const next = document.getElementById('news-next-btn');

  const pageSize = PAGINATION.DEFAULT_PAGE_SIZE;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (info) {
    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalCount);
    info.textContent = totalCount > 0 ? `${from}–${to} of ${totalCount}` : '0 results';
  }

  if (prev) prev.disabled = currentPage <= 1;
  if (next) next.disabled = currentPage >= totalPages;
}

/* ============================================================
   MODAL HANDLING
============================================================ */

function resetForm() {
  const form = document.getElementById('news-form');
  if (form) form.reset();

  editingId = null;

  if (quillEditor) {
    quillEditor.root.innerHTML = '';
  }

  const title = document.getElementById('news-modal-title');
  if (title) title.textContent = 'Add Article';
}

function openAddModal() {
  resetForm();
  openModal('news-modal');

  setTimeout(() => {
    initEditor('');
  }, 50);
}

async function openEditModal(id) {
  resetForm();
  editingId = id;

  const title = document.getElementById('news-modal-title');
  if (title) title.textContent = 'Edit Article';

  try {
    const article = await getNewsById(id);

    document.getElementById('news-title').value = article.title ?? '';
    document.getElementById('news-slug').value = article.slug ?? '';
    document.getElementById('news-meta-description').value =
      article.meta_description ?? '';

    if (article.published_at) {
      document.getElementById('news-published-at').value =
        article.published_at.substring(0, 16);
    }

    openModal('news-modal');

    setTimeout(() => {
      initEditor(article.content || '');
    }, 50);

  } catch (err) {
    showToast('Failed to load article data', 'error');
  }
}

/* ============================================================
   SUBMIT (WITH IMAGE STORAGE)
============================================================ */

async function handleSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('news-title')?.value?.trim();
  const slug = document.getElementById('news-slug')?.value?.trim();
  const fileInput = document.getElementById('news-image-input');

  if (!title) return showToast('Title is required', 'error');
  if (!slug) return showToast('Slug is required', 'error');

  const isUnique = await checkSlugUnique('news', slug, editingId);
  if (!isUnique) return showToast('Slug already exists', 'error');

  const publishedAtValue =
    document.getElementById('news-published-at')?.value
      ? new Date(document.getElementById('news-published-at').value).toISOString()
      : null;

  let imagePath = null;
  let imageUrl  = null;

  try {

    // ───────── EDIT MODE ─────────
    if (editingId) {
      const existing = await getNewsById(editingId);

      imagePath = existing.featured_image_path || null;
      imageUrl  = existing.featured_image || null;

      if (fileInput?.files?.length) {
        const file = fileInput.files[0];
        const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 800 });
        if (compressed.size < file.size) {
          showToast(`Image compressed: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`, 'info');
        }
        const replaced = await replaceFile(STORAGE_FOLDERS.NEWS, compressed, imagePath);
        imagePath = replaced.path;
        imageUrl  = replaced.url;
      }
    }

    // ───────── CREATE MODE ─────────
    else {
      if (fileInput?.files?.length) {
        const file = fileInput.files[0];
        const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 800 });
        if (compressed.size < file.size) {
          showToast(`Image compressed: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`, 'info');
        }
        const uploaded = await uploadFile(STORAGE_FOLDERS.NEWS, compressed);
        imagePath = uploaded.path;
        imageUrl  = uploaded.url;
      }
    }

    const payload = {
      title,
      slug,
      content: quillEditor ? quillEditor.root.innerHTML : null,
      meta_description:
        document.getElementById('news-meta-description')?.value?.trim() || null,
      published_at: publishedAtValue,

      // 🔥 SAMAKAN DENGAN GALLERY
      featured_image_path: imagePath,
      featured_image: imageUrl
    };

    if (editingId) {
      await updateNews(editingId, payload);
      await logAction('update', 'news', { entityId: editingId, label: title });
      showToast('Article updated', 'success');
    } else {
      const created = await createNews(payload);
      await logAction('create', 'news', { entityId: created.id, label: title });
      showToast('Article created', 'success');
    }

    closeModal('news-modal');
    loadNews();

  } catch (err) {
    console.error(err);
    showToast('Failed to save article', 'error');
  }
}

/* ============================================================
   DELETE (WITH IMAGE CLEANUP)
============================================================ */

async function handleDelete(id) {
  const confirmed = await confirmDialog('Delete this article?');
  if (!confirmed) return;

  try {
    const article = await getNewsById(id);

    if (article?.featured_image_path) {
      await deleteFile(article.featured_image_path);
    }

    await deleteNews(id);
    await logAction('delete', 'news', { entityId: id, label: article?.title });
    showToast('Article deleted', 'success');
    loadNews();

  } catch {
    showToast('Failed to delete article', 'error');
  }
}

/* ============================================================
   INIT
============================================================ */

// ─── News bulk helpers ───────────────────────────────────────

function syncNewsSelectAll() {
  const selectAll = document.getElementById('news-select-all');
  if (!selectAll) return;
  const rows = document.querySelectorAll('.news-row-check');
  if (!rows.length) { selectAll.checked = false; selectAll.indeterminate = false; return; }
  const checked = [...rows].filter(r => r.checked).length;
  selectAll.checked = checked === rows.length;
  selectAll.indeterminate = checked > 0 && checked < rows.length;
}

function updateNewsActions() {
  const btn = document.getElementById('news-bulk-delete-btn');
  if (!btn) return;
  if (selectedNewsIds.size > 0) {
    btn.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg> Delete (${selectedNewsIds.size})`;
  } else {
    btn.classList.add('hidden');
    btn.disabled = true;
  }
}

async function handleBulkDeleteNews() {
  if (selectedNewsIds.size === 0) return;
  const count = selectedNewsIds.size;
  const confirmed = await confirmDialog(`Delete ${count} article${count > 1 ? 's' : ''}? This cannot be undone.`);
  if (!confirmed) return;

  const ids = [...selectedNewsIds];
  let failed = 0;

  for (const id of ids) {
    try {
      const article = await getNewsById(id);
      if (article?.featured_image_path) await deleteFile(article.featured_image_path);
      await deleteNews(id);
      await logAction('delete', 'news', { entityId: id, label: article?.title });
    } catch (err) {
      failed++;
      console.error(`Failed to delete news ${id}`, err);
    }
  }

  selectedNewsIds.clear();

  if (failed > 0) {
    showToast(`Deleted ${ids.length - failed} article(s). ${failed} failed.`, 'warning');
  } else {
    showToast(`Deleted ${ids.length} article(s)`, 'success');
  }

  loadNews();
}

export function initNews() {

  document.getElementById('news-add-btn')
    ?.addEventListener('click', openAddModal);

  document.getElementById('news-form')
    ?.addEventListener('submit', handleSubmit);

  document.getElementById('news-title')
    ?.addEventListener('input', e => {
      if (!editingId) {
        document.getElementById('news-slug').value =
          generateSlug(e.target.value);
      }
    });

  // Select-all
  const selectAll = document.getElementById('news-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      document.querySelectorAll('.news-row-check').forEach(cb => {
        cb.checked = selectAll.checked;
        if (selectAll.checked) selectedNewsIds.add(cb.dataset.id);
        else selectedNewsIds.delete(cb.dataset.id);
      });
      updateNewsActions();
    });
  }

  // Bulk delete
  document.getElementById('news-bulk-delete-btn')
    ?.addEventListener('click', handleBulkDeleteNews);

  loadNews();
}