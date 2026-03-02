// ============================================================
// config.js — Supabase configuration
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your values
// ============================================================

export const SUPABASE_URL = 'https://xeeryfynexnfyzrkgohn.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_SqiBNMHPQKg8eRGdbhWBmg_taL-gWEr';
export const STORAGE_BUCKET = 'media';

export const TABLES = {
  SONGS:         'songs',
  MEMBERS:       'members',
  NEWS:          'news',
  GALLERY:       'gallery',
  MESSAGES:      'messages',
  SETTINGS:      'settings',
  ACTIVITY_LOGS: 'activity_logs',
};

export const STORAGE_FOLDERS = {
  SONGS: 'songs',
  MEMBERS: 'members',
  NEWS: 'news',
  GALLERY: 'gallery',
};

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
};
