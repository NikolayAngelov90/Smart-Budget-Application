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

/**
 * HP-7: the persisted cache grew without bound.
 *
 * Every dated SWR key (`?today=YYYY-MM-DD`) mints a NEW key each day — roughly
 * six of them — and nothing removed the old ones. `metadata.keys` only ever
 * grew, so each write paid an O(n) `includes()` scan plus a full metadata
 * re-serialise, and each mount read and re-hydrated every dead day.
 *
 * The 50MB limit did not save it either: these entries are tiny, so the cache
 * could hold thousands of dead days without approaching the ceiling — and on
 * reaching it the provider printed a warning and silently stopped persisting
 * anything new, freezing rather than rotating.
 */
describe('dated cache keys are pruned', () => {
  const today = new Date().toISOString().slice(0, 10);

  it('drops entries pinned to a day that is not today', () => {
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    seedEntry(`/api/budgets?today=2020-01-01`, { data: { stale: true } });
    seedEntry(`/api/budgets?today=${today}`, { data: { fresh: true } });

    const entries = loadPersistedEntries();

    expect(entries.map(([k]) => k)).toEqual([`/api/budgets?today=${today}`]);
    // Removed from storage, not merely skipped — otherwise it still costs a
    // scan and a read on every future mount.
    expect(localStorage.getItem(`${PREFIX}-/api/budgets?today=2020-01-01`)).toBeNull();
  });

  it('shrinks the key list so writes stop paying for dead days', () => {
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    for (const day of ['2020-01-01', '2020-01-02', '2020-01-03']) {
      seedEntry(`/api/wishlist?today=${day}`, { data: { day } });
    }
    seedEntry(`/api/wishlist?today=${today}`, { data: { day: today } });

    loadPersistedEntries();

    const meta = JSON.parse(localStorage.getItem(META_KEY)!);
    expect(meta.keys).toEqual([`/api/wishlist?today=${today}`]);
  });

  it('leaves undated keys alone', () => {
    // Most of the cache is not dated; pruning must not touch it.
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    seedEntry('/api/categories', { data: ['a'] });
    seedEntry('/api/transactions?page=2', { data: ['b'] });

    const entries = loadPersistedEntries();

    expect(entries.map(([k]) => k).sort()).toEqual([
      '/api/categories',
      '/api/transactions?page=2',
    ]);
  });

  it('keeps a key whose date merely looks similar', () => {
    // Guards the regex: `?today=` must match the whole day, not a prefix.
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    seedEntry(`/api/score?today=${today}&period=year`, { data: { ok: true } });

    const entries = loadPersistedEntries();

    expect(entries).toHaveLength(1);
  });
});
