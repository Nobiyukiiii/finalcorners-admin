// ============================================================
// auditLog.js — Audit log: record & display admin actions
// ============================================================
//
// Schema (Supabase table: activity_logs)
// ─────────────────────────────────────
//   id          uuid  primary key default gen_random_uuid()
//   actor_email text  not null
//   action      text  not null   -- 'create' | 'update' | 'delete'
//   entity      text  not null   -- 'song' | 'member' | 'news' | 'gallery' | 'settings'
//   entity_id   text             -- ID of the affected record (nullable for bulk/settings)
//   label       text             -- Human-readable identifier e.g. song title
//   meta        jsonb            -- Optional extra context
//   created_at  timestamptz default now()
//
// To create this table in Supabase SQL editor:
//
//   create table activity_logs (
//     id          uuid primary key default gen_random_uuid(),
//     actor_email text not null,
//     action      text not null,
//     entity      text not null,
//     entity_id   text,
//     label       text,
//     meta        jsonb,
//     created_at  timestamptz default now()
//   );
//
//   -- Allow authenticated users to insert (admins write logs)
//   alter table activity_logs enable row level security;
//   create policy "admins can insert logs"
//     on activity_logs for insert
//     to authenticated with check (true);
//   create policy "admins can read logs"
//     on activity_logs for select
//     to authenticated using (true);
//
// ============================================================

import { supabase } from './api.js';

const TABLE = 'activity_logs';

// ─── Write ──────────────────────────────────────────────────

/**
 * Record an admin action.
 *
 * @param {'create'|'update'|'delete'} action
 * @param {string} entity   - 'song' | 'member' | 'news' | 'gallery' | 'settings'
 * @param {object} [opts]
 * @param {string} [opts.entityId]  - ID of the affected record
 * @param {string} [opts.label]     - Human-readable name e.g. "Midnight Drive"
 * @param {object} [opts.meta]      - Any extra JSON data
 */
export async function logAction(action, entity, opts = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const actorEmail = user?.email ?? 'unknown';

    await supabase.from(TABLE).insert([{
      actor_email: actorEmail,
      action,
      entity,
      entity_id:  opts.entityId  ?? null,
      label:      opts.label     ?? null,
      meta:       opts.meta      ?? null,
    }]);
  } catch (err) {
    // Logging must never crash the main operation
    console.warn('[auditLog] Failed to write log entry:', err);
  }
}

// ─── Read ───────────────────────────────────────────────────

/**
 * Fetch the most recent audit log entries.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=50]
 * @param {string} [opts.entity]  - Filter by entity type
 * @param {string} [opts.action]  - Filter by action type
 * @returns {Promise<Array>}
 */
export async function getAuditLogs({ limit = 50, entity = '', action = '' } = {}) {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entity) query = query.eq('entity', entity);
  if (action) query = query.eq('action', action);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ─── Render helpers ─────────────────────────────────────────

const ACTION_CONFIG = {
  create: { label: 'Created',  color: 'var(--success)',  icon: '+' },
  update: { label: 'Updated',  color: 'var(--info)',     icon: '✎' },
  delete: { label: 'Deleted',  color: 'var(--danger)',   icon: '×' },
};

const ENTITY_EMOJI = {
  song:     '♪',
  member:   '👤',
  news:     '📰',
  gallery:  '🖼',
  settings: '⚙️',
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatRelative(dateStr) {
  const date  = new Date(dateStr);
  const now   = new Date();
  const diffMs = now - date;
  const diffS  = Math.floor(diffMs / 1000);
  const diffM  = Math.floor(diffS / 60);
  const diffH  = Math.floor(diffM / 60);
  const diffD  = Math.floor(diffH / 24);

  if (diffS < 60)  return 'just now';
  if (diffM < 60)  return `${diffM}m ago`;
  if (diffH < 24)  return `${diffH}h ago`;
  if (diffD < 7)   return `${diffD}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Render audit log entries into a container element.
 *
 * @param {HTMLElement} container
 * @param {Array}       logs
 */
export function renderAuditLog(container, logs) {
  if (!container) return;

  if (!logs.length) {
    container.innerHTML = `<p class="empty-state" style="padding:24px 0;">No activity recorded yet.</p>`;
    return;
  }

  container.innerHTML = logs.map(log => {
    const cfg    = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.update;
    const emoji  = ENTITY_EMOJI[log.entity] ?? '•';
    const entity = log.entity.charAt(0).toUpperCase() + log.entity.slice(1);

    return `
      <div class="audit-item">
        <span class="audit-item__icon" style="color:${cfg.color}">${cfg.icon}</span>
        <div class="audit-item__body">
          <div class="audit-item__action">
            <span class="audit-item__action-badge" style="color:${cfg.color};background:${cfg.color}1a;border-color:${cfg.color}33">
              ${cfg.label}
            </span>
            <span class="audit-item__entity">${emoji} ${entity}</span>
            ${log.label ? `<span class="audit-item__label">"${escapeHtml(log.label)}"</span>` : ''}
          </div>
          <div class="audit-item__meta">
            <span class="audit-item__actor">${escapeHtml(log.actor_email)}</span>
            <span class="audit-item__sep">·</span>
            <span class="audit-item__time" title="${new Date(log.created_at).toLocaleString()}">${formatRelative(log.created_at)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
