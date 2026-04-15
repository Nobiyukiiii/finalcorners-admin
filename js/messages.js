// ============================================================
// messages.js — Messages module
// ============================================================

import { getMessages, deleteMessage } from './api.js';
import { showToast } from './toast.js';
import { openModal, closeModal, confirmDialog } from './modal.js';

let currentSearch = '';
let viewingMessage = null;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadMessages() {
  const tbody = document.getElementById('messages-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="table-loading">Loading…</td></tr>`;

  try {
    const messages = await getMessages({ search: currentSearch });
    renderTable(messages);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-error">Failed to load messages.</td></tr>`;
    showToast('Failed to load messages', 'error');
    console.error(err);
  }
}

function renderTable(messages) {
  const tbody = document.getElementById('messages-table-body');
  if (!messages.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No messages found.</td></tr>`;
    return;
  }

  tbody.innerHTML = messages.map(msg => `
    <tr>
      <td>
        <div class="td-primary">${escapeHtml(msg.name)}</div>
        <div class="td-secondary">${escapeHtml(msg.email)}</div>
      </td>
      <td>${escapeHtml(msg.subject)}</td>
      <td class="td-message-preview">${escapeHtml(msg.message.substring(0, 80))}${msg.message.length > 80 ? '…' : ''}</td>
      <td>${formatDateTime(msg.created_at)}</td>
      <td class="td-actions">
        <button class="btn btn--icon btn--view" data-id="${msg.id}" aria-label="View message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="btn btn--icon btn--delete" data-id="${msg.id}" aria-label="Delete message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn--view').forEach(btn => {
    btn.addEventListener('click', () => openMessageModal(btn.dataset.id, messages));
  });
  tbody.querySelectorAll('.btn--delete').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });
}

function openMessageModal(id, messages) {
  const msg = messages.find(m => m.id === id);
  if (!msg) return;
  viewingMessage = msg;

  document.getElementById('msg-view-name').textContent = msg.name;
  document.getElementById('msg-view-email').textContent = msg.email;
  document.getElementById('msg-view-subject').textContent = msg.subject;
  document.getElementById('msg-view-date').textContent = formatDateTime(msg.created_at);
  document.getElementById('msg-view-body').textContent = msg.message;

  openModal('message-view-modal');
}

async function handleDelete(id) {
  const confirmed = await confirmDialog('Delete this message? This cannot be undone.');
  if (!confirmed) return;

  try {
    await deleteMessage(id);
    showToast('Message deleted', 'success');
    await loadMessages();
  } catch (err) {
    showToast('Failed to delete message', 'error');
    console.error(err);
  }
}

export function initMessages() {
  const searchInput = document.getElementById('messages-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearch = searchInput.value.trim();
        loadMessages();
      }, 300);
    });
  }

  const deleteFromModalBtn = document.getElementById('msg-view-delete-btn');
  if (deleteFromModalBtn) {
    deleteFromModalBtn.addEventListener('click', async () => {
      if (!viewingMessage) return;
      const confirmed = await confirmDialog('Delete this message?');
      if (!confirmed) return;

      try {
        await deleteMessage(viewingMessage.id);
        closeModal('message-view-modal');
        showToast('Message deleted', 'success');
        viewingMessage = null;
        await loadMessages();
      } catch (err) {
        showToast('Failed to delete message', 'error');
        console.error(err);
      }
    });
  }

  loadMessages();
}
