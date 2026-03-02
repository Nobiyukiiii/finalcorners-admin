// ============================================================
// toast.js — Animated toast notification system
// ============================================================

const TOAST_DURATION = 4000;
let toastContainer = null;
const queue = [];
let isProcessing = false;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function createToastElement(message, type, id) {
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.dataset.id = id;
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__message">${message}</span>
    <button class="toast__close" aria-label="Dismiss">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  toast.querySelector('.toast__close').addEventListener('click', () => {
    dismissToast(toast);
  });

  return toast;
}

function dismissToast(toast) {
  toast.classList.add('toast--out');
  toast.addEventListener('animationend', () => {
    toast.remove();
    isProcessing = false;
    processQueue();
  }, { once: true });
}

function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const { message, type, id } = queue.shift();
  const container = ensureContainer();
  const toast = createToastElement(message, type, id);
  container.appendChild(toast);

  // Force reflow so animation triggers
  void toast.offsetWidth;
  toast.classList.add('toast--in');

  const timer = setTimeout(() => {
    if (toast.isConnected) {
      dismissToast(toast);
    }
  }, TOAST_DURATION);

  // Allow manual close to also clear timeout
  toast.querySelector('.toast__close').addEventListener('click', () => {
    clearTimeout(timer);
  }, { once: true });
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 */
export function showToast(message, type = 'info') {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  queue.push({ message, type, id });
  processQueue();
}
