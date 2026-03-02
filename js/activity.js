// ============================================================
// activity.js — Activity Log section module
// ============================================================

import { getAuditLogs, renderAuditLog } from './auditLog.js';
import { showToast } from './toast.js';

let currentEntity = '';
let currentAction = '';

async function loadActivity() {
  const container = document.getElementById('activity-log-list');
  if (!container) return;

  container.innerHTML = `<p class="loading-state">Loading activity…</p>`;

  try {
    const logs = await getAuditLogs({
      limit: 100,
      entity: currentEntity,
      action: currentAction,
    });
    renderAuditLog(container, logs);
  } catch (err) {
    container.innerHTML = `<p class="empty-state error">Failed to load activity log. Make sure the <code>activity_logs</code> table exists in Supabase.</p>`;
    console.error('[activity]', err);
  }
}

export function initActivity() {
  const entityFilter = document.getElementById('activity-filter-entity');
  const actionFilter = document.getElementById('activity-filter-action');
  const refreshBtn   = document.getElementById('activity-refresh-btn');

  if (entityFilter) {
    entityFilter.addEventListener('change', () => {
      currentEntity = entityFilter.value;
      loadActivity();
    });
  }

  if (actionFilter) {
    actionFilter.addEventListener('change', () => {
      currentAction = actionFilter.value;
      loadActivity();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadActivity();
      showToast('Activity log refreshed', 'info');
    });
  }

  loadActivity();
}
