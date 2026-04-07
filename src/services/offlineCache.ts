/**
 * offlineCache.ts
 *
 * Thin AsyncStorage cache layer for Supabase queries.
 *
 * Pattern:
 *   1. Try Supabase. On success → write to cache, return fresh data.
 *   2. On network error → return cached data + { fromCache: true } flag.
 *   3. Callers can show a "Last synced X ago" badge instead of an infinite skeleton.
 *
 * Keys use the pattern: @epexfit_cache/<scope>/<userId>/<qualifier>
 * TTL is per-resource (e.g. daily_log: 24 h, activities: 15 min).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@epexfit_cache';

export interface CacheEntry<T> {
  data: T;
  cachedAt: number; // Unix ms
}

export interface CachedResult<T> {
  data: T;
  fromCache: boolean;
  cachedAt?: number;
  error?: any;
}

/**
 * withCache — wraps any async Supabase call with read-through caching.
 *
 * @param key        AsyncStorage key (must be unique per query variant)
 * @param ttlMs      Max age before stale (still returned but fromCache=true)
 * @param fetcher    Async function that returns { data, error }
 * @param fallback   Value to return if both network and cache fail
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<{ data: T; error: any }>,
  fallback: T
): Promise<CachedResult<T>> {
  const cacheKey = `${PREFIX}/${key}`;

  try {
    // Try live fetch first
    const { data, error } = await fetcher();

    if (!error && data !== null && data !== undefined) {
      // Write to cache
      const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      return { data, fromCache: false };
    }

    // Fetch returned an error — try cache
    const cached = await _readCache<T>(cacheKey);
    if (cached) {
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt, error };
    }

    return { data: fallback, fromCache: false, error };
  } catch (networkError) {
    // Hard network failure (airplane mode etc.) — serve cache
    try {
      const cached = await _readCache<T>(cacheKey);
      if (cached) {
        return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt, error: networkError };
      }
    } catch {
      // Cache read also failed
    }
    return { data: fallback, fromCache: false, error: networkError };
  }
}

/**
 * invalidateCache — call after a mutation so next read is fresh.
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PREFIX}/${key}`);
  } catch {
    // Non-critical
  }
}

/**
 * invalidateCachePrefix — wipe all keys starting with a prefix pattern.
 * e.g. invalidateCachePrefix('daily_log/user-123') clears all logs for that user.
 */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  try {
    const fullPrefix = `${PREFIX}/${prefix}`;
    const allKeys = await AsyncStorage.getAllKeys();
    const toRemove = allKeys.filter(k => k.startsWith(fullPrefix));
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  } catch {
    // Non-critical
  }
}

async function _readCache<T>(cacheKey: string): Promise<CacheEntry<T> | null> {
  const raw = await AsyncStorage.getItem(cacheKey);
  if (!raw) return null;
  return JSON.parse(raw) as CacheEntry<T>;
}

// ─── TTL presets ─────────────────────────────────────────────────────────────
export const TTL = {
  DAILY_LOG:   24 * 60 * 60 * 1000, // 24 hours
  ACTIVITIES:  15 * 60 * 1000,       // 15 minutes
  GOALS:       60 * 60 * 1000,       // 1 hour
  WORKOUTS:    30 * 60 * 1000,       // 30 minutes
  WEEKLY_LOGS:  6 * 60 * 60 * 1000,  // 6 hours
  STATS:       30 * 60 * 1000,       // 30 minutes
};
