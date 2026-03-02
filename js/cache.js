// ============================================================
// cache.js — In-memory cache with TTL support
// ============================================================

const store = new Map(); // key → { value, expiresAt }

/**
 * Get a cached value. Returns null if missing or expired.
 */
export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Set a cached value with a TTL in milliseconds.
 * Default TTL = 60 seconds.
 */
export function cacheSet(key, value, ttlMs = 60_000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalidate one or more cache keys (supports prefix wildcard).
 * e.g. cacheInvalidate('songs') removes 'songs', 'songs:page:1', etc.
 */
export function cacheInvalidate(...keys) {
  for (const key of keys) {
    // Exact match
    if (store.has(key)) {
      store.delete(key);
    }
    // Prefix match: remove all keys that start with key + ':'
    const prefix = key + ':';
    for (const k of store.keys()) {
      if (k.startsWith(prefix)) store.delete(k);
    }
  }
}

/**
 * Invalidate ALL cache entries.
 */
export function cacheClear() {
  store.clear();
}

/**
 * Wrap an async fn with cache. If cache hit → return cached.
 * If miss → call fn, store result, return it.
 *
 * @param {string}   key
 * @param {Function} fn
 * @param {number}   ttlMs
 */
export async function withCache(key, fn, ttlMs = 60_000) {
  const cached = cacheGet(key);
  if (cached !== null) return cached;
  const result = await fn();
  cacheSet(key, result, ttlMs);
  return result;
}
