// ============================================================
// members.js — Members CRUD + drag-and-drop sort
// ============================================================

import {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  updateMemberSortOrders,
} from './api.js';
import { uploadFile, replaceFile, deleteFile } from './storage.js';
import { STORAGE_FOLDERS } from './config.js';
import { showToast } from './toast.js';
import { openModal, closeModal, confirmDialog } from './modal.js';
import { logAction } from './auditLog.js';
import { compressImage, formatFileSize } from './imageCompress.js';

let editingId = null;
let dragSrcEl = null;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadMembers() {
  const grid = document.getElementById('members-grid');
  if (!grid) return;
  grid.innerHTML = `<p class="loading-state">Loading members…</p>`;

  try {
    const members = await getMembers();
    renderMembers(members);
  } catch (err) {
    grid.innerHTML = `<p class="empty-state error">Failed to load members.</p>`;
    showToast('Failed to load members', 'error');
    console.error(err);
  }
}

function renderMembers(members) {
  const grid = document.getElementById('members-grid');
  if (!members.length) {
    grid.innerHTML = `<p class="empty-state">No members yet. Add the first one!</p>`;
    return;
  }

  grid.innerHTML = members.map(member => `
    <div class="member-card" draggable="true" data-id="${member.id}" data-order="${member.sort_order}">
      <div class="member-card__drag-handle" aria-label="Drag to reorder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/></svg>
      </div>
      <div class="member-card__photo">
        ${member.photo_url
          ? `<img src="${member.photo_url}" alt="${escapeHtml(member.name)}">`
          : `<div class="member-card__photo-placeholder">${(member.name || '?')[0].toUpperCase()}</div>`}
      </div>
      <div class="member-card__info">
        <div class="member-card__name">${escapeHtml(member.name)}</div>
        <div class="member-card__role">${escapeHtml(member.role)}</div>
        ${member.bio ? `<div class="member-card__bio">${escapeHtml(member.bio)}</div>` : ''}
      </div>
      <div class="member-card__actions">
        <button class="btn btn--icon btn--edit" data-id="${member.id}" aria-label="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn--icon btn--delete" data-id="${member.id}" aria-label="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  // Attach action listeners
  grid.querySelectorAll('.btn--edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  grid.querySelectorAll('.btn--delete').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });

  // Drag-and-drop listeners
  grid.querySelectorAll('.member-card').forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('dragleave', handleDragLeave);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);
  });
}

function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
  this.classList.add('member-card--dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('member-card--dragover');
  return false;
}

function handleDragLeave() {
  this.classList.remove('member-card--dragover');
}

async function handleDrop(e) {
  e.stopPropagation();
  this.classList.remove('member-card--dragover');

  if (dragSrcEl === this) return;

  const grid = document.getElementById('members-grid');
  const cards = Array.from(grid.querySelectorAll('.member-card'));
  const srcIdx = cards.indexOf(dragSrcEl);
  const dstIdx = cards.indexOf(this);

  if (srcIdx < dstIdx) {
    grid.insertBefore(dragSrcEl, this.nextSibling);
  } else {
    grid.insertBefore(dragSrcEl, this);
  }

  // Persist new order
  const updatedCards = Array.from(grid.querySelectorAll('.member-card'));
  const updates = updatedCards.map((card, idx) => ({
    id: card.dataset.id,
    sort_order: idx,
  }));

  try {
    await updateMemberSortOrders(updates);
    showToast('Order saved', 'success');
  } catch (err) {
    showToast('Failed to save order', 'error');
    console.error(err);
  }
}

function handleDragEnd() {
  document.querySelectorAll('.member-card').forEach(c => {
    c.classList.remove('member-card--dragging', 'member-card--dragover');
  });
}

function resetForm() {
  const form = document.getElementById('member-form');
  if (form) form.reset();
  editingId = null;
  const preview = document.getElementById('member-photo-preview');
  if (preview) {
    preview.src = '';
    preview.classList.add('hidden');
  }
  const title = document.getElementById('member-modal-title');
  if (title) title.textContent = 'Add Member';
}

function openAddModal() {
  resetForm();
  openModal('member-modal');
}

async function openEditModal(id) {
  resetForm();
  editingId = id;
  const title = document.getElementById('member-modal-title');
  if (title) title.textContent = 'Edit Member';

  try {
    const member = await getMemberById(id);
    populateForm(member);
    openModal('member-modal');
  } catch (err) {
    showToast('Failed to load member data', 'error');
    console.error(err);
  }
}

function populateForm(member) {
  const fields = ['name', 'role', 'bio'];
  fields.forEach(field => {
    const el = document.getElementById(`member-${field}`);
    if (el) el.value = member[field] ?? '';
  });

  const preview = document.getElementById('member-photo-preview');
  if (preview && member.photo_url) {
    preview.src = member.photo_url;
    preview.classList.remove('hidden');
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  const form = document.getElementById('member-form');
  if (!form) return;

  const submitBtn = form.querySelector('[type="submit"]');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const name = document.getElementById('member-name')?.value?.trim();
    const role = document.getElementById('member-role')?.value?.trim();

    if (!name) throw new Error('Name is required');
    if (!role) throw new Error('Role is required');

    let photo_url = null;
    let photo_path = null;

    const photoInput = document.getElementById('member-photo-input');
    const file = photoInput?.files?.[0];

    if (file) {
      const compressed = await compressImage(file, { maxWidth: 600, maxHeight: 600 });
      if (compressed.size < file.size) {
        showToast(`Photo compressed: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`, 'info');
      }

      if (editingId) {
        const existing = await getMemberById(editingId);
        const result = await replaceFile(
          STORAGE_FOLDERS.MEMBERS,
          compressed,
          existing.photo_path
        );
        photo_url = result.url;
        photo_path = result.path;
      } else {
        const result = await uploadFile(STORAGE_FOLDERS.MEMBERS, compressed);
        photo_url = result.url;
        photo_path = result.path;
      }
    }

    const payload = {
      name,
      role,
      bio: document.getElementById('member-bio')?.value?.trim() || null,
    };

    if (photo_url !== null) {
      payload.photo_url = photo_url;
      payload.photo_path = photo_path;
    }

    if (editingId) {
      await updateMember(editingId, payload);
      await logAction('update', 'member', { entityId: editingId, label: name });
      showToast('Member updated', 'success');
    } else {
      const members = await getMembers();
      const maxOrder =
        members.length > 0
          ? Math.max(...members.map(m => m.sort_order ?? 0))
          : -1;

      payload.sort_order = maxOrder + 1;

      const created = await createMember(payload);
      await logAction('create', 'member', { entityId: created.id, label: name });
      showToast('Member created', 'success');
    }

    closeModal('member-modal');
    await loadMembers();
  } catch (err) {
    showToast(err.message || 'Failed to save member', 'error');
    console.error(err);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Member';
    }
  }
}

async function handleDelete(id) {
  const confirmed = await confirmDialog('Delete this member? This cannot be undone.');
  if (!confirmed) return;

  try {
    const member = await getMemberById(id);
    if (member.photo_path) {
      await deleteFile(member.photo_path);
    }
    await deleteMember(id);
    await logAction('delete', 'member', { entityId: id, label: member.name });
    showToast('Member deleted', 'success');
    await loadMembers();
  } catch (err) {
    showToast('Failed to delete member', 'error');
    console.error(err);
  }
}

export function initMembers() {
  const addBtn = document.getElementById('members-add-btn');
  if (addBtn) addBtn.addEventListener('click', openAddModal);

  const form = document.getElementById('member-form');
  if (form) form.addEventListener('submit', handleSubmit);

  const photoInput = document.getElementById('member-photo-input');
  const photoPreview = document.getElementById('member-photo-preview');
  if (photoInput && photoPreview) {
    photoInput.addEventListener('change', () => {
      const file = photoInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = e => {
          photoPreview.src = e.target.result;
          photoPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  loadMembers();
}
