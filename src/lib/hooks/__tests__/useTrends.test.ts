/**
 * `useTrends` — the SWR key, which is the whole contract.
 *
 * hp-13 gave this hook a third state. It previously took `number | undefined`
 * and always fetched; it now takes `number | null | undefined`, where **null
 * means "the caller does not know yet"** and SWR treats a null key as "do not
 * fetch".
 *
 * That exists so `SpendingTrendsChart` can wait for a viewport breakpoint to
 * resolve instead of reading `window` during render — which was 500ing every
 * authenticated /dashboard SSR render. The alternative, guessing and correcting,
 * fires two requests and flips the caption.
 *
 * The hook had NO test file before this one (0% coverage), which is how a
 * contract change like this passes unnoticed.
 */

type SWRArgs = [key: unknown, fetcher?: unknown, config?: unknown];

const mockUseSWR = jest.fn<
  { data: undefined; error: undefined; isLoading: boolean; mutate: jest.Mock },
  SWRArgs
>(() => ({
  data: undefined,
  error: undefined,
  isLoading: false,
  mutate: jest.fn(),
}));

jest.mock('swr', () => ({
  __esModule: true,
  default: (key: unknown, fetcher?: unknown, config?: unknown) =>
    mockUseSWR(key, fetcher, config),
}));

import { renderHook } from '@testing-library/react';
import { useTrends } from '../useTrends';

/** The key SWR was called with on the most recent render. */
const lastKey = () => mockUseSWR.mock.calls[mockUseSWR.mock.calls.length - 1]?.[0];

beforeEach(() => {
  mockUseSWR.mockClear();
});

describe('useTrends — SWR key', () => {
  it('passes NULL when months is null, so SWR does not fetch', () => {
    renderHook(() => useTrends(null));
    // Not `undefined`, not a URL — null specifically. SWR only skips on a
    // falsy key, and a URL string here is exactly the wasted request this
    // state exists to prevent.
    expect(lastKey()).toBeNull();
  });

  it('requests the explicit window when months is a number', () => {
    renderHook(() => useTrends(3));
    expect(lastKey()).toBe('/api/dashboard/trends?months=3');
  });

  it('distinguishes 3 from 6 rather than collapsing to a default', () => {
    renderHook(() => useTrends(6));
    expect(lastKey()).toBe('/api/dashboard/trends?months=6');
  });

  it('keeps the old meaning of undefined: fetch the route default', () => {
    // Unchanged behaviour, pinned so the new null state cannot swallow it.
    renderHook(() => useTrends(undefined));
    expect(lastKey()).toBe('/api/dashboard/trends');
  });

  it('treats null and undefined as DIFFERENT, which is the point', () => {
    renderHook(() => useTrends(null));
    const whenNull = lastKey();
    renderHook(() => useTrends(undefined));
    const whenUndefined = lastKey();

    expect(whenNull).toBeNull();
    expect(whenUndefined).toBe('/api/dashboard/trends');
    expect(whenNull).not.toEqual(whenUndefined);
  });

  it('returns the SWR result shape unchanged', () => {
    const { result } = renderHook(() => useTrends(null));
    expect(result.current).toEqual(
      expect.objectContaining({
        data: undefined,
        error: undefined,
        isLoading: false,
        mutate: expect.any(Function),
      })
    );
  });
});
