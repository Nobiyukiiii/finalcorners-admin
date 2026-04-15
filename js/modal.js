// ============================================================
// modal.js — Reusable modal system
// ============================================================

let activeModal = null;

/**
 * Open a modal by its ID
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  closeActiveModal();
  activeModal = modal;
  modal.classList.add('modal--active');
  document.body.classList.add('body--modal-open');

  modal.addEventListener('click', handleBackdropClick);
  document.addEventListener('keydown', handleEscKey);
}

/**
 * Close a specific modal
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  _closeModal(modal);
}

/**
 * Close whichever modal is currently active
 */
export function closeActiveModal() {
  if (activeModal) {
    _closeModal(activeModal);
  }
}

function _closeModal(modal) {
  modal.classList.remove('modal--active');
  document.body.classList.remove('body--modal-open');
  modal.removeEventListener('click', handleBackdropClick);
  document.removeEventListener('keydown', handleEscKey);
  if (activeModal === modal) activeModal = null;
}

function handleBackdropClick(e) {
  if (e.target === activeModal) {
    closeActiveModal();
  }
}

function handleEscKey(e) {
  if (e.key === 'Escape') {
    closeActiveModal();
  }
}

/**
 * Bind close buttons inside a modal container
 */
export function bindModalCloseButtons(containerEl) {
  containerEl.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.modalClose;
      if (targetId) {
        closeModal(targetId);
      } else {
        closeActiveModal();
      }
    });
  });
}

/**
 * Create and inject a confirm dialog
 * Returns a Promise that resolves true/false
 */
export function confirmDialog(message, title = 'Confirm') {
  return new Promise(resolve => {
    const existingDialog = document.getElementById('confirm-dialog');
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement('div');
    dialog.id = 'confirm-dialog';
    dialog.className = 'modal modal--active';
    dialog.innerHTML = `
      <div class="modal__panel modal__panel--sm">
        <div class="modal__header">
          <h2 class="modal__title">${title}</h2>
        </div>
        <div class="modal__body">
          <p class="confirm-dialog__message">${message}</p>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="confirm-cancel">Cancel</button>
          <button class="btn btn--danger" id="confirm-ok">Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    document.body.classList.add('body--modal-open');

    const cleanup = () => {
      dialog.remove();
      document.body.classList.remove('body--modal-open');
    };

    dialog.querySelector('#confirm-cancel').addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    dialog.querySelector('#confirm-ok').addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    dialog.addEventListener('click', e => {
      if (e.target === dialog) {
        cleanup();
        resolve(false);
      }
    });
  });
}
