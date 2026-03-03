// ============================================================
// songs.js — Songs CRUD module
// ============================================================

import {
  getSongs,
  getSongById,
  createSong,
  updateSong,
  deleteSong,
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
let selectedSongIds = new Set();

const selectors = {
  table: () => document.getElementById('songs-table-body'),
  paginationInfo: () => document.getElementById('songs-pagination-info'),
  paginationPrev: () => document.getElementById('songs-prev-btn'),
  paginationNext: () => document.getElementById('songs-next-btn'),
  searchInput: () => document.getElementById('songs-search'),
  addBtn: () => document.getElementById('songs-add-btn'),
  form: () => document.getElementById('song-form'),
  modal: () => document.getElementById('song-modal'),
  modalTitle: () => document.getElementById('song-modal-title'),
  coverInput: () => document.getElementById('song-cover-input'),
  coverPreview: () => document.getElementById('song-cover-preview'),
};

function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function validateDuration(duration) {
  if (!duration) return true;
  return /^\d+:[0-5]\d$/.test(duration);
}

function validateISRC(isrc) {
  if (!isrc) return true;
  return /^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d{5}$/.test(isrc);
}

async function loadSongs() {
  const tbody = selectors.table();
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="table-loading">Loading…</td></tr>`;

  try {
    const { data, count } = await getSongs({
      page: currentPage,
      pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
      search: currentSearch,
    });
    totalCount = count;
    renderTable(data);
    renderPagination();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-error">Failed to load songs.</td></tr>`;
    showToast('Failed to load songs', 'error');
    console.error(err);
  }
}

function renderTable(songs) {
  const tbody = selectors.table();
  if (!songs.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No songs found.</td></tr>`;
    selectedSongIds.clear();
    updateBulkBar('songs');
    return;
  }

  tbody.innerHTML = songs.map(song => `
    <tr>
      <td style="width:40px;">
        <input type="checkbox" class="table-checkbox song-row-check" data-id="${song.id}" aria-label="Select ${escapeHtml(song.title)}" ${selectedSongIds.has(song.id) ? 'checked' : ''}>
      </td>
      <td class="td-cover">
        ${song.cover_url
          ? `<img src="${song.cover_url}" alt="${escapeHtml(song.title)}" class="table-thumbnail">`
          : `<div class="table-thumbnail-placeholder">♪</div>`}
      </td>
      <td>
        <div class="td-primary">${escapeHtml(song.title)}</div>
        <div class="td-secondary">${escapeHtml(song.slug)}</div>
      </td>
      <td>${song.isrc ? escapeHtml(song.isrc) : '—'}</td>
      <td>${formatDate(song.release_date)}</td>
      <td>
        ${song.coming_soon
          ? `<span class="badge badge--coming-soon">Coming Soon</span>`
          : `<span class="badge badge--released">Released</span>`}
      </td>
      <td class="td-actions">
        <button class="btn btn--icon btn--edit" data-id="${song.id}" aria-label="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn--icon btn--delete" data-id="${song.id}" aria-label="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');

  // Row checkboxes
  tbody.querySelectorAll('.song-row-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      if (cb.checked) selectedSongIds.add(id);
      else selectedSongIds.delete(id);
      syncSelectAll('songs-select-all', '.song-row-check', selectedSongIds);
      updateBulkBar('songs');
    });
  });

  tbody.querySelectorAll('.btn--edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn--delete').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });

  syncSelectAll('songs-select-all', '.song-row-check', selectedSongIds);
  updateBulkBar('songs');
}

function renderPagination() {
  const info = selectors.paginationInfo();
  const prev = selectors.paginationPrev();
  const next = selectors.paginationNext();
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

function resetForm() {
  const form = selectors.form();
  if (form) form.reset();
  editingId = null;
  const preview = selectors.coverPreview();
  if (preview) {
    preview.src = '';
    preview.classList.add('hidden');
  }
  const modalTitle = selectors.modalTitle();
  if (modalTitle) modalTitle.textContent = 'Add Song';
}

function openAddModal() {
  resetForm();
  openModal('song-modal');
}

async function openEditModal(id) {
  resetForm();
  editingId = id;
  const modalTitle = selectors.modalTitle();
  if (modalTitle) modalTitle.textContent = 'Edit Song';

  try {
    const song = await getSongById(id);
    populateForm(song);
    openModal('song-modal');
  } catch (err) {
    showToast('Failed to load song data', 'error');
    console.error(err);
  }
}

function populateForm(song) {
  const fields = ['title', 'slug', 'release_date', 'spotify_url', 'youtube_url', 'description', 'isrc', 'duration'];
  fields.forEach(field => {
    const el = document.getElementById(`song-${field.replace('_', '-')}`);
    if (el) el.value = song[field] ?? '';
  });

  const comingSoon = document.getElementById('song-coming-soon');
  if (comingSoon) comingSoon.checked = song.coming_soon ?? false;

  const preview = selectors.coverPreview();
  if (preview && song.cover_url) {
    preview.src = song.cover_url;
    preview.classList.remove('hidden');
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  const form = selectors.form();
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
  }

  try {
    const titleEl = document.getElementById('song-title');
    const slugEl = document.getElementById('song-slug');
    const durationEl = document.getElementById('song-duration');
    const isrcEl = document.getElementById('song-isrc');

    const title = titleEl?.value?.trim();
    const slug = slugEl?.value?.trim();

    if (!title) throw new Error('Title is required');
    if (!slug) throw new Error('Slug is required');

    if (durationEl?.value && !validateDuration(durationEl.value)) {
      throw new Error('Duration must be in format mm:ss');
    }

    if (isrcEl?.value && !validateISRC(isrcEl.value)) {
      throw new Error('Invalid ISRC format (e.g. US-ABC-23-00001)');
    }

    const isUnique = await checkSlugUnique('songs', slug, editingId);
    if (!isUnique) throw new Error('Slug already exists. Please choose another.');

    let cover_url = null;
    let cover_path = null;

    const coverInput = selectors.coverInput();
    const file = coverInput?.files?.[0];

    if (file) {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800 });
      if (compressed.size < file.size) {
        showToast(`Image compressed: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`, 'info');
      }

      if (editingId) {
        const existing = await getSongById(editingId);
        const result = await replaceFile(STORAGE_FOLDERS.SONGS, compressed, existing.cover_path);
        cover_url = result.url;
        cover_path = result.path;
      } else {
        const result = await uploadFile(STORAGE_FOLDERS.SONGS, compressed);
        cover_url = result.url;
        cover_path = result.path;
      }
    }

const isComingSoon = document.getElementById('song-coming-soon')?.checked ?? false;

const payload = {
  title,
  slug,
  release_date: document.getElementById('song-release-date')?.value || null,
  spotify_url: document.getElementById('song-spotify-url')?.value?.trim() || null,
  youtube_url: document.getElementById('song-youtube-url')?.value?.trim() || null,
  description: document.getElementById('song-description')?.value?.trim() || null,
  isrc: isrcEl?.value?.trim() || null,
  duration: durationEl?.value?.trim() || null,

  // Sistem lama tetap jalan
  coming_soon: isComingSoon,

  // Sistem baru untuk website
  status: isComingSoon ? 'upcoming' : 'released',
};
    if (cover_url !== null) {
      payload.cover_url = cover_url;
      payload.cover_path = cover_path;
    }

    if (editingId) {
      await updateSong(editingId, payload);
      await logAction('update', 'song', { entityId: editingId, label: title });
      showToast('Song updated successfully', 'success');
    } else {
      const created = await createSong(payload);
      await logAction('create', 'song', { entityId: created.id, label: title });
      showToast('Song created successfully', 'success');
    }

    closeModal('song-modal');
    await loadSongs();
  } catch (err) {
    showToast(err.message || 'Failed to save song', 'error');
    console.error(err);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Song';
    }
  }
}

async function handleDelete(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this song? This action cannot be undone.');
  if (!confirmed) return;

  try {
    const song = await getSongById(id);
    if (song.cover_path) {
      await deleteFile(song.cover_path);
    }
    await deleteSong(id);
    await logAction('delete', 'song', { entityId: id, label: song.title });
    showToast('Song deleted', 'success');
    await loadSongs();
  } catch (err) {
    showToast('Failed to delete song', 'error');
    console.error(err);
  }
}

// ─── Bulk action helpers ─────────────────────────────────────

/**
 * Sync the "select all" checkbox state based on current row selections.
 */
function syncSelectAll(selectAllId, rowCheckSelector, selectedSet) {
  const selectAll = document.getElementById(selectAllId);
  if (!selectAll) return;
  const rows = document.querySelectorAll(rowCheckSelector);
  if (rows.length === 0) { selectAll.checked = false; selectAll.indeterminate = false; return; }
  const checkedCount = [...rows].filter(r => r.checked).length;
  selectAll.checked = checkedCount === rows.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < rows.length;
}

/**
 * Update the visibility and label of the bulk delete button.
 */
function updateBulkBar(prefix) {
  const btn = document.getElementById(`${prefix}-bulk-delete-btn`);
  if (!btn) return;
  const set = prefix === 'songs' ? selectedSongIds : null;
  if (!set) return;
  if (set.size > 0) {
    btn.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg> Delete (${set.size})`;
  } else {
    btn.classList.add('hidden');
    btn.disabled = true;
  }
}

async function handleBulkDeleteSongs() {
  if (selectedSongIds.size === 0) return;
  const count = selectedSongIds.size;
  const confirmed = await confirmDialog(`Delete ${count} song${count > 1 ? 's' : ''}? This cannot be undone.`);
  if (!confirmed) return;

  const ids = [...selectedSongIds];
  let failed = 0;

  for (const id of ids) {
    try {
      const song = await getSongById(id);
      if (song.cover_path) await deleteFile(song.cover_path);
      await deleteSong(id);
      await logAction('delete', 'song', { entityId: id, label: song.title });
    } catch (err) {
      failed++;
      console.error(`Failed to delete song ${id}`, err);
    }
  }

  selectedSongIds.clear();

  if (failed > 0) {
    showToast(`Deleted ${ids.length - failed} song(s). ${failed} failed.`, 'warning');
  } else {
    showToast(`Deleted ${ids.length} song(s)`, 'success');
  }

  await loadSongs();
}

export function initSongs() {
  const addBtn = selectors.addBtn();
  if (addBtn) addBtn.addEventListener('click', openAddModal);

  const form = selectors.form();
  if (form) form.addEventListener('submit', handleSubmit);

  // Select all checkbox
  const selectAll = document.getElementById('songs-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      const rows = document.querySelectorAll('.song-row-check');
      rows.forEach(cb => {
        cb.checked = selectAll.checked;
        if (selectAll.checked) selectedSongIds.add(cb.dataset.id);
        else selectedSongIds.delete(cb.dataset.id);
      });
      updateBulkBar('songs');
    });
  }

  // Bulk delete button
  const bulkDeleteBtn = document.getElementById('songs-bulk-delete-btn');
  if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', handleBulkDeleteSongs);

  const searchInput = selectors.searchInput();
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearch = searchInput.value.trim();
        currentPage = 1;
        loadSongs();
      }, 300);
    });
  }

  const prevBtn = selectors.paginationPrev();
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadSongs();
      }
    });
  }

  const nextBtn = selectors.paginationNext();
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(totalCount / PAGINATION.DEFAULT_PAGE_SIZE);
      if (currentPage < totalPages) {
        currentPage++;
        loadSongs();
      }
    });
  }

  const titleInput = document.getElementById('song-title');
  const slugInput = document.getElementById('song-slug');
  if (titleInput && slugInput) {
    titleInput.addEventListener('input', () => {
      if (!editingId) {
        slugInput.value = generateSlug(titleInput.value);
      }
    });
  }

  const coverInput = selectors.coverInput();
  const coverPreview = selectors.coverPreview();
  if (coverInput && coverPreview) {
    coverInput.addEventListener('change', () => {
      const file = coverInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = e => {
          coverPreview.src = e.target.result;
          coverPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  loadSongs();
}
