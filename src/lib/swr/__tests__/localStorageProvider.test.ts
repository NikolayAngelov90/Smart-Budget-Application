/**
 * localStorageProvider — regression guard for the "stuck on Loading…" bug.
 *
 * The Categories (and any data) page hung forever on a full-page load / refresh:
 * `Providers` used to attach the localStorage provider only AFTER mount, swapping
 * the SWR cache mid-lifecycle and orphaning the request already in flight from the
 * first render. The fix makes the provider attachable from the first render by
 * having its map start EMPTY (so the first client render matches the server), with
 * persisted data re-seeded after mount via `loadPersistedEntries`.
 *
 * These tests lock in the two invariants that make that safe:
 *  1. the provider does NOT synchronously preload localStorage (empty on construction);
 *  2. `loadPersistedEntries` reads the persisted entries and honours the cache version.
 */

import {
  localStorageProvider,
  loadPersistedEntries,
} from '@/lib/swr/localStorageProvider';

const PREFIX = 'smart-budget-swr-cache';
const META_KEY = 'smart-budget-cache-metadata';
const VERSION_KEY = 'smart-budget-cache-version';
const CURRENT_VERSION = '4';

/** Seed a persisted entry the way SWR's cache value is stored ({ data, ... }). */
function seedEntry(key: string, value: unknown) {
  localStorage.setItem(`${PREFIX}-${key}`, JSON.stringify(value));
  const meta = JSON.parse(localStorage.getItem(META_KEY) || '{"totalSize":0,"keys":[],"cacheTimestamp":0}');
  if (!meta.keys.includes(key)) meta.keys.push(key);
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

beforeEach(() => {
  localStorage.clear();
});

describe('localStorageProvider', () => {
  it('starts EMPTY even when localStorage holds cached entries (no synchronous preload)', () => {
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    seedEntry('/api/categories', { data: { data: [{ id: 'c1' }] } });

    const map = localStorageProvider();

    // The map must not be pre-filled — a preloaded provider was what forced the
    // after-mount swap that orphaned in-flight requests.
    expect(map.size).toBe(0);
    expect(map.get('/api/categories')).toBeUndefined();
  });

  it('persists fresh writes to localStorage via the overridden set()', () => {
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    const map = localStorageProvider();

    map.set('/api/categories', { data: { count: 11 } });

    const stored = localStorage.getItem(`${PREFIX}-/api/categories`);
    expect(stored).toBe(JSON.stringify({ data: { count: 11 } }));
  });
});

describe('loadPersistedEntries', () => {
  it('returns the persisted [key, state] pairs for post-mount hydration', () => {
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    seedEntry('/api/categories', { data: { count: 11 } });
    seedEntry('/api/budgets', { data: { budgets: [] } });

    const entries = loadPersistedEntries();
    const asMap = new Map(entries);

    expect(asMap.get('/api/categories')).toEqual({ data: { count: 11 } });
    expect(asMap.get('/api/budgets')).toEqual({ data: { budgets: [] } });
  });

  it('wipes the cache and returns [] when the stored version is stale', () => {
    localStorage.setItem(VERSION_KEY, '1'); // older than CURRENT_VERSION
    seedEntry('/api/categories', { data: { count: 11 } });

    const entries = loadPersistedEntries();

    expect(entries).toEqual([]);
    // stale entry purged, version bumped
    expect(localStorage.getItem(`${PREFIX}-/api/categories`)).toBeNull();
    expect(localStorage.getItem(VERSION_KEY)).toBe(CURRENT_VERSION);
  });
});
