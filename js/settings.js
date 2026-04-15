// ============================================================
// settings.js — Settings module
// ============================================================

import { getSettings, updateSettings } from './api.js';
import { showToast } from './toast.js';
import { logAction } from './auditLog.js';

async function loadSettings() {
  const form = document.getElementById('settings-form');
  if (!form) return;

  const loadingEl = document.getElementById('settings-loading');
  if (loadingEl) loadingEl.classList.remove('hidden');

  try {
    const settings = await getSettings();

    const bioEl = document.getElementById('settings-band-bio');
    if (bioEl) bioEl.value = settings.band_bio ?? '';

    const locationEl = document.getElementById('settings-location');
    if (locationEl) locationEl.value = settings.location ?? '';

    const formedYearEl = document.getElementById('settings-formed-year');
    if (formedYearEl) formedYearEl.value = settings.formed_year ?? '';

    const updatedAtEl = document.getElementById('settings-updated-at');
    if (updatedAtEl && settings.updated_at) {
      updatedAtEl.textContent = `Last updated: ${new Date(settings.updated_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
  } catch (err) {
    showToast('Failed to load settings', 'error');
    console.error(err);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('settings-form');
  const submitBtn = form.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  try {
    const payload = {
      band_bio: document.getElementById('settings-band-bio')?.value?.trim() || null,
      location: document.getElementById('settings-location')?.value?.trim() || null,
      formed_year: document.getElementById('settings-formed-year')?.value?.trim() || null,
    };

    const updated = await updateSettings(payload);
    await logAction('update', 'settings', { label: 'Band Settings' });

    const updatedAtEl = document.getElementById('settings-updated-at');
    if (updatedAtEl && updated.updated_at) {
      updatedAtEl.textContent = `Last updated: ${new Date(updated.updated_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }

    showToast('Settings saved successfully', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to save settings', 'error');
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Settings';
  }
}

export function initSettings() {
  const form = document.getElementById('settings-form');
  if (form) form.addEventListener('submit', handleSubmit);
  loadSettings();
}
