// ============================================================
// main.js — Dashboard entry point, routing, nav
// ============================================================

import { requireAuth, signOut } from './auth.js';
import { showToast } from './toast.js';
import { initDashboard } from './dashboard.js';
import { initSongs } from './songs.js';
import { initMembers } from './members.js';
import { initNews } from './news.js';
import { initGallery } from './gallery.js';
import { initMessages } from './messages.js';
import { initSettings } from './settings.js';
import { initActivity } from './activity.js';

const SECTIONS = ['dashboard', 'songs', 'members', 'news', 'gallery', 'messages', 'activity', 'settings'];
const initialized = new Set();

let currentSection = 'dashboard';

function showSection(name) {
  if (!SECTIONS.includes(name)) name = 'dashboard';

  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('nav-item--active', item.dataset.section === name);
  });

  // Update sections
  document.querySelectorAll('.section').forEach(section => {
    section.classList.toggle('section--active', section.id === `section-${name}`);
  });

  // Update page title
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    pageTitle.textContent = name.charAt(0).toUpperCase() + name.slice(1);
  }

  currentSection = name;

  // Lazy init
  if (!initialized.has(name)) {
    initialized.add(name);
    switch (name) {
      case 'dashboard':  initDashboard(); break;
      case 'songs':      initSongs();     break;
      case 'members':    initMembers();   break;
      case 'news':       initNews();      break;
      case 'gallery':    initGallery();   break;
      case 'messages':   initMessages();  break;
      case 'activity':   initActivity();  break;
      case 'settings':   initSettings();  break;
    }
  }

  // Update URL hash
  history.pushState({ section: name }, '', `#${name}`);
}

function bindNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) showSection(section);
    });
  });
}

function bindLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut();
      window.location.href = './index.html';
    } catch (err) {
      showToast('Logout failed', 'error');
      console.error(err);
    }
  });
}

function bindSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!toggleBtn || !sidebar) return;

  function openSidebar() {
    sidebar.classList.add('sidebar--open');
    if (overlay) overlay.classList.add('active');
  }

  function closeSidebar() {
    sidebar.classList.remove('sidebar--open');
    if (overlay) overlay.classList.remove('active');
  }

  toggleBtn.addEventListener('click', () => {
    if (sidebar.classList.contains('sidebar--open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Auto-close sidebar if window resized to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeSidebar();
  });

  // Close sidebar on nav item click (mobile)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

function getInitialSection() {
  const hash = window.location.hash.replace('#', '');
  return SECTIONS.includes(hash) ? hash : 'dashboard';
}

async function init() {
  const authed = await requireAuth();
  if (!authed) return;

  bindNav();
  bindLogout();
  bindSidebarToggle();

  const section = getInitialSection();
  showSection(section);

  window.addEventListener('popstate', e => {
    if (e.state?.section) {
      showSection(e.state.section);
    }
  });
}

init();
