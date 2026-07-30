/**
 * Dated SWR keys — deferred-work cluster B.
 *
 * Five hooks now append the client's own calendar day to their key, so the
 * server stops deriving month windows from its UTC clock. Two properties matter
 * and neither is obvious from reading the hooks:
 *
 *  - the key actually carries `?today=<local day>` (otherwise the routes fall
 *    back to the server clock and the fix is cosmetic), and
 *  - the exported KEY constant remains a usable PREFIX, because everything that
 *    revalidates these now matches by prefix.
 */

import { renderHook } from '@testing-library/react';

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
  useSWRConfig: () => ({ mutate: jest.fn() }),
}));

import { useBudgets, BUDGETS_KEY } from '@/lib/hooks/useBudgets';
import { useWhatIf, WHAT_IF_KEY } from '@/lib/hooks/useWhatIf';
import { useWishlist, WISHLIST_KEY } from '@/lib/hooks/useWishlist';
import { toLocalISODate } from '@/lib/utils/date';

const today = () => toLocalISODate(new Date());

const CASES: [string, () => unknown, string][] = [
  ['useBudgets', () => renderHook(() => useBudgets()), BUDGETS_KEY],
  ['useWhatIf', () => renderHook(() => useWhatIf()), WHAT_IF_KEY],
  ['useWishlist', () => renderHook(() => useWishlist()), WISHLIST_KEY],
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('dated SWR keys', () => {
  it.each(CASES)('%s sends the client local day', (_name, render) => {
    render();

    const passedKey = mockUseSWR.mock.calls[0]![0] as string;
    expect(typeof passedKey).toBe('string');
    expect(passedKey).toContain(`today=${today()}`);
  });

  it.each(CASES)('%s keeps its KEY constant usable as a prefix', (_name, render, key) => {
    render();

    const passedKey = mockUseSWR.mock.calls[0]![0] as string;
    // Everything revalidating these matches with startsWith(KEY).
    expect(passedKey.startsWith(key)).toBe(true);
    // The constant itself must stay bare — no query string baked in.
    expect(key).not.toContain('?');
  });

  it('separates the query string from the path with exactly one ?', () => {
    renderHook(() => useBudgets());
    const passedKey = mockUseSWR.mock.calls[0]![0] as string;
    expect(passedKey.split('?')).toHaveLength(2);
  });
});
