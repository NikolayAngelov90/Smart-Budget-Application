/**
 * Providers — integration guard for the stable SWR provider.
 *
 * Regression: a full-page load of a data page hung on "Loading…" because the
 * provider was swapped in after mount, orphaning the request already in flight
 * from the first render. With a single stable provider the first-render fetch
 * resolves normally, and localStorage-persisted data is re-seeded after mount.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import { Providers } from '@/app/providers';

jest.mock('@/hooks/usePWAAnalytics', () => ({ usePWAAnalytics: () => undefined }));
jest.mock('@/i18n/detectLocale', () => ({ detectAndSetLocale: () => undefined }));

const PREFIX = 'smart-budget-swr-cache';
const META_KEY = 'smart-budget-cache-metadata';
const VERSION_KEY = 'smart-budget-cache-version';

const fetcher = async (url: string) => {
  const r = await fetch(url);
  return r.json();
};

// Gated on isLoading — proves the initial fetch resolves (isn't orphaned).
function Consumer() {
  const { data, isLoading } = useSWR('/api/test', fetcher);
  if (isLoading) return <div>loading-state</div>;
  return <div>value:{data?.value}</div>;
}

// Reports data whenever present — proves cached data is seeded, independent of
// the isLoading flag (which stays true while the mount fetch is still in flight).
function DataProbe() {
  const { data } = useSWR('/api/test', fetcher);
  return <div>data:{data?.value ?? 'none'}</div>;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(VERSION_KEY, '4');
});

describe('Providers — stable SWR provider', () => {
  it('resolves a fetch started on the first render (request is not orphaned)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ value: 'FRESH' }) }) as jest.Mock;

    render(
      <Providers>
        <Consumer />
      </Providers>
    );

    // The fetched value appears — the provider is stable, so the first-render
    // request lands in the live cache instead of being orphaned by a swap.
    expect(await screen.findByText('value:FRESH')).toBeInTheDocument();
  });

  it('hydrates localStorage-persisted data after mount, then revalidates', async () => {
    // Pre-seed a cached entry the way SWR persists its cache value ({ data, ... }).
    localStorage.setItem(`${PREFIX}-/api/test`, JSON.stringify({ data: { value: 'CACHED' } }));
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ totalSize: 0, keys: ['/api/test'], cacheTimestamp: 0 })
    );

    // Fetch stays pending (single shared deferred) so the cached value is what
    // we observe first; resolving it later delivers the fresh value to all callers.
    let resolveFetch: (v: unknown) => void = () => {};
    const pending = new Promise((res) => {
      resolveFetch = res;
    });
    global.fetch = jest.fn().mockReturnValue(pending) as jest.Mock;

    render(
      <Providers>
        <DataProbe />
      </Providers>
    );

    // Cached data hydrated in (loadPersistedEntries + mutate) — shown before the
    // in-flight fetch resolves. The loading-state write must NOT have clobbered
    // the persisted data (persistence skips data-less states).
    expect(await screen.findByText('data:CACHED')).toBeInTheDocument();

    // Live fetch then refreshes it (stale-while-revalidate).
    resolveFetch({ ok: true, json: async () => ({ value: 'FRESH' }) });
    expect(await screen.findByText('data:FRESH')).toBeInTheDocument();
  });
});
