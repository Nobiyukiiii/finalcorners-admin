// ============================================================
// dashboard.js — Dashboard metrics module
// ============================================================

import {
  getCount,
  getLatestMessages,
  getLatestSongs,
} from './api.js';
import { TABLES } from './config.js';
import { showToast } from './toast.js';

function setMetric(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
    el.classList.add('metric--loaded');
  }
}

async function loadMetrics() {
  try {
    const [
      songCount,
      memberCount,
      newsCount,
      galleryCount,
      messageCount,
    ] = await Promise.all([
      getCount(TABLES.SONGS),
      getCount(TABLES.MEMBERS),
      getCount(TABLES.NEWS),
      getCount(TABLES.GALLERY),
      getCount(TABLES.MESSAGES),
    ]);

    setMetric('metric-songs', songCount);
    setMetric('metric-members', memberCount);
    setMetric('metric-news', newsCount);
    setMetric('metric-gallery', galleryCount);
    setMetric('metric-messages', messageCount);

    // Derived: coming soon songs
    const { data: songs } = await import('./api.js').then(m =>
      m.supabase.from(TABLES.SONGS).select('coming_soon')
    );
    const comingSoon = songs ? songs.filter(s => s.coming_soon).length : 0;
    const released = songs ? songs.filter(s => !s.coming_soon).length : 0;
    setMetric('metric-coming-soon', comingSoon);
    setMetric('metric-released', released);
  } catch (err) {
    showToast('Failed to load dashboard metrics', 'error');
    console.error(err);
  }
}

async function loadLatestMessages() {
  const container = document.getElementById('latest-messages');
  if (!container) return;

  try {
    const messages = await getLatestMessages(5);

    if (!messages.length) {
      container.innerHTML = `<p class="empty-state">No messages yet.</p>`;
      return;
    }

    container.innerHTML = messages.map(msg => `
      <div class="message-item">
        <div class="message-item__header">
          <span class="message-item__name">${escapeHtml(msg.name)}</span>
          <span class="message-item__time">${formatDate(msg.created_at)}</span>
        </div>
        <div class="message-item__subject">${escapeHtml(msg.subject)}</div>
        <div class="message-item__email">${escapeHtml(msg.email)}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="empty-state error">Failed to load messages.</p>`;
    console.error(err);
  }
}

async function loadLatestSongs() {
  const container = document.getElementById('latest-songs');
  if (!container) return;

  try {
    const songs = await getLatestSongs(3);

    if (!songs.length) {
      container.innerHTML = `<p class="empty-state">No songs yet.</p>`;
      return;
    }

    container.innerHTML = songs.map(song => `
      <div class="song-item">
        <div class="song-item__cover">
          ${song.cover_url
            ? `<img src="${song.cover_url}" alt="${escapeHtml(song.title)}">`
            : `<span class="song-item__cover-placeholder">♪</span>`}
        </div>
        <div class="song-item__info">
          <div class="song-item__title">${escapeHtml(song.title)}</div>
          <div class="song-item__meta">
            ${song.release_date ? formatDate(song.release_date) : 'No date'}
            ${song.coming_soon ? `<span class="badge badge--coming-soon">Coming Soon</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="empty-state error">Failed to load songs.</p>`;
    console.error(err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export async function initDashboard() {
  await Promise.all([
    loadMetrics(),
    loadLatestMessages(),
    loadLatestSongs(),
  ]);
}
