// ============================================================
// api.js — Supabase client + all database operations
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, TABLES, PAGINATION } from './config.js';
import { withCache, cacheInvalidate } from './cache.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache TTLs (ms)
const TTL = {
  COUNTS:   30_000,   // 30s — dashboard metrics
  MEMBERS:  120_000,  // 2min — members list (changes infrequently)
  SETTINGS: 300_000,  // 5min — band settings
  TAGS:     60_000,   // 1min — gallery tags
  SONGS:    20_000,   // 20s — paginated lists
  NEWS:     20_000,
  MESSAGES: 10_000,   // 10s — inbox, more volatile
};

// ─── Generic helpers ────────────────────────────────────────

/**
 * Fetch total count for a table (cached)
 */
export async function getCount(table) {
  return withCache(`count:${table}`, async () => {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  }, TTL.COUNTS);
}

// ─── SONGS ─────────────────────────────────────────────────

export async function getSongs({ page = 1, pageSize = PAGINATION.DEFAULT_PAGE_SIZE, search = '' } = {}) {
  const cacheKey = `songs:page:${page}:size:${pageSize}:search:${search}`;
  return withCache(cacheKey, async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(TABLES.SONGS)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%,isrc.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    return { data, count };
  }, TTL.SONGS);
}

export async function getSongById(id) {
  const { data, error } = await supabase.from(TABLES.SONGS).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createSong(payload) {
  const { data, error } = await supabase.from(TABLES.SONGS).insert([payload]).select().single();
  if (error) throw error;
  cacheInvalidate('songs', `count:${TABLES.SONGS}`);
  return data;
}

export async function updateSong(id, payload) {
  const { data, error } = await supabase.from(TABLES.SONGS).update(payload).eq('id', id).select().single();
  if (error) throw error;
  cacheInvalidate('songs');
  return data;
}

export async function deleteSong(id) {
  const { error } = await supabase.from(TABLES.SONGS).delete().eq('id', id);
  if (error) throw error;
  cacheInvalidate('songs', `count:${TABLES.SONGS}`);
}

export async function checkSlugUnique(table, slug, excludeId = null) {
  let query = supabase.from(table).select('id').eq('slug', slug);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data.length === 0;
}

export async function getLatestSongs(limit = 3) {
  const { data, error } = await supabase
    .from(TABLES.SONGS)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ─── MEMBERS ───────────────────────────────────────────────

export async function getMembers() {
  return withCache('members:all', async () => {
    const { data, error } = await supabase
      .from(TABLES.MEMBERS)
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  }, TTL.MEMBERS);
}

export async function getMemberById(id) {
  const { data, error } = await supabase.from(TABLES.MEMBERS).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createMember(payload) {
  const { data, error } = await supabase.from(TABLES.MEMBERS).insert([payload]).select().single();
  if (error) throw error;
  cacheInvalidate('members', `count:${TABLES.MEMBERS}`);
  return data;
}

export async function updateMember(id, payload) {
  const { data, error } = await supabase.from(TABLES.MEMBERS).update(payload).eq('id', id).select().single();
  if (error) throw error;
  cacheInvalidate('members');
  return data;
}

export async function deleteMember(id) {
  const { error } = await supabase.from(TABLES.MEMBERS).delete().eq('id', id);
  if (error) throw error;
  cacheInvalidate('members', `count:${TABLES.MEMBERS}`);
}

export async function updateMemberSortOrders(updates) {
  // Use batch upsert instead of N individual requests
  const { error } = await supabase
    .from(TABLES.MEMBERS)
    .upsert(updates.map(({ id, sort_order }) => ({ id, sort_order })));
  if (error) throw error;
  cacheInvalidate('members');
}

// ─── NEWS ──────────────────────────────────────────────────

export async function getNewsArticles({ page = 1, pageSize = PAGINATION.DEFAULT_PAGE_SIZE, search = '' } = {}) {
  const cacheKey = `news:page:${page}:size:${pageSize}:search:${search}`;
  return withCache(cacheKey, async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(TABLES.NEWS)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    return { data, count };
  }, TTL.NEWS);
}

export async function getNewsById(id) {
  const { data, error } = await supabase.from(TABLES.NEWS).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createNews(payload) {
  const { data, error } = await supabase.from(TABLES.NEWS).insert([payload]).select().single();
  if (error) throw error;
  cacheInvalidate('news', `count:${TABLES.NEWS}`);
  return data;
}

export async function updateNews(id, payload) {
  const { data, error } = await supabase.from(TABLES.NEWS).update(payload).eq('id', id).select().single();
  if (error) throw error;
  cacheInvalidate('news');
  return data;
}

export async function deleteNews(id) {
  const { error } = await supabase.from(TABLES.NEWS).delete().eq('id', id);
  if (error) throw error;
  cacheInvalidate('news', `count:${TABLES.NEWS}`);
}

// ─── GALLERY ───────────────────────────────────────────────

export async function getGalleryImages({ tag = '' } = {}) {
  const cacheKey = `gallery:tag:${tag}`;
  return withCache(cacheKey, async () => {
    let query = supabase
      .from(TABLES.GALLERY)
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (tag) {
      query = query.eq('tag', tag);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }, TTL.SONGS);
}

export async function createGalleryImage(payload) {
  const { data, error } = await supabase.from(TABLES.GALLERY).insert([payload]).select().single();
  if (error) throw error;
  cacheInvalidate('gallery', `count:${TABLES.GALLERY}`);
  return data;
}

export async function deleteGalleryImage(id) {
  const { error } = await supabase.from(TABLES.GALLERY).delete().eq('id', id);
  if (error) throw error;
  cacheInvalidate('gallery', `count:${TABLES.GALLERY}`);
}

export async function getGalleryTags() {
  return withCache('gallery:tags', async () => {
    const { data, error } = await supabase.from(TABLES.GALLERY).select('tag');
    if (error) throw error;
    return [...new Set(data.map(d => d.tag).filter(Boolean))];
  }, TTL.TAGS);
}

// ─── MESSAGES ──────────────────────────────────────────────

export async function getMessages({ search = '' } = {}) {
  let query = supabase
    .from(TABLES.MESSAGES)
    .select('*')
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getLatestMessages(limit = 5) {
  const { data, error } = await supabase
    .from(TABLES.MESSAGES)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function deleteMessage(id) {
  const { error } = await supabase.from(TABLES.MESSAGES).delete().eq('id', id);
  if (error) throw error;
}

// ─── SETTINGS ──────────────────────────────────────────────

export async function getSettings() {
  return withCache('settings:main', async () => {
    const { data, error } = await supabase
      .from(TABLES.SETTINGS)
      .select('*')
      .eq('id', 'main')
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: created, error: createError } = await supabase
        .from(TABLES.SETTINGS)
        .insert([{ id: 'main', band_bio: '', location: '', formed_year: '' }])
        .select()
        .single();
      if (createError) throw createError;
      return created;
    }

    if (error) throw error;
    return data;
  }, TTL.SETTINGS);
}

export async function updateSettings(payload) {
  const { data, error } = await supabase
    .from(TABLES.SETTINGS)
    .upsert({ id: 'main', ...payload, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  cacheInvalidate('settings:main');
  return data;
}
