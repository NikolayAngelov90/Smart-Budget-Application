/**
 * Dated SWR keys — deferred-work cluster B, hardened in HP-1.
 *
 * These hooks append the client's own calendar day to their key so the server
 * stops deriving month windows from its UTC clock. Two properties matter and
 * neither is obvious from reading the hooks:
 *
 *  - the key actually carries `?today=<local day>` (otherwise the route falls
 *    back to the server clock and the fix is cosmetic), and
 *  - the exported KEY constant remains a usable PREFIX, because everything that
 *    revalidates these now matches by prefix.
 *
 * HP-1 rewrote the coverage check to run the other way round. The original list
 * was maintained by hand, and `/api/dashboard/spending-by-category` was never
 * added to it: the route grew `resolveClientToday`, the categories screen sent
 * `?today=`, and `useSpendingByCategory` — the dashboard's caller — silently did
 * not. The fix was live on one screen and inert on the other, and the two
 * disagreed about the same number for anyone east of UTC at the turn of a month.
 * A hand-maintained list cannot catch that, because the omission IS the bug.
 *
 * So the ROUTES are now the source of truth: every route that reads
 * `resolveClientToday` must have a registered client below, and adding one to a
 * new route fails this suite until its caller is wired up and listed.
 */

import fs from 'fs';
import path from 'path';
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
import { useBudgetForecast, BUDGET_FORECAST_KEY } from '@/lib/hooks/useBudgetForecast';
import {
  useSpendingByCategory,
  SPENDING_BY_CATEGORY_KEY,
} from '@/lib/hooks/useSpendingByCategory';
import { toLocalISODate } from '@/lib/utils/date';

const today = () => toLocalISODate(new Date());

const API_DIR = path.resolve(__dirname, '../../../app/api');

/** Every API route whose window comes from the client's local day. */
function routesUsingClientToday(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routesUsingClientToday(full, acc);
    } else if (entry.name === 'route.ts') {
      if (fs.readFileSync(full, 'utf8').includes('resolveClientToday(')) {
        acc.push(
          '/api/' + path.relative(API_DIR, path.dirname(full)).split(path.sep).join('/')
        );
      }
    }
  }
  return acc;
}

interface DatedClient {
  /** How the client fetches it, if a hook owns the key. */
  render?: () => unknown;
  /** The exported bare-path constant, where one exists. */
  keyConstant?: string;
  /** Set when the caller is not a hook, with where it lives instead. */
  fetchedDirectlyBy?: string;
}

/**
 * Registered clients, keyed by the route they call. A route appearing in
 * `routesUsingClientToday()` with no entry here is a failure, not an omission
 * to be tidied later.
 */
const CLIENTS: Record<string, DatedClient> = {
  '/api/budgets': { render: () => renderHook(() => useBudgets()), keyConstant: BUDGETS_KEY },
  '/api/what-if': { render: () => renderHook(() => useWhatIf()), keyConstant: WHAT_IF_KEY },
  '/api/wishlist': { render: () => renderHook(() => useWishlist()), keyConstant: WISHLIST_KEY },
  '/api/dashboard/budget-forecast': {
    render: () => renderHook(() => useBudgetForecast()),
    keyConstant: BUDGET_FORECAST_KEY,
  },
  '/api/dashboard/spending-by-category': {
    render: () => renderHook(() => useSpendingByCategory()),
    keyConstant: SPENDING_BY_CATEGORY_KEY,
  },
  // These two build their keys through exported helpers rather than a hook of
  // their own, and are covered by their own suites.
  '/api/dashboard/stats': { fetchedDirectlyBy: 'useDashboardStats (dashboard-stats key tests)' },
  '/api/gamification/score': { fetchedDirectlyBy: 'buildScoreKey (useBudgetScore tests)' },
};

const HOOK_CASES = Object.entries(CLIENTS)
  .filter((entry): entry is [string, DatedClient & { render: () => unknown }] =>
    typeof entry[1].render === 'function'
  )
  .map(([route, client]) => [route, client.render, client.keyConstant] as const);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('dated SWR keys', () => {
  it('registers a client for every route that reads the client day', () => {
    const unregistered = routesUsingClientToday(API_DIR).filter((r) => !(r in CLIENTS));

    // The exact failure this inversion exists to catch: a route learns to accept
    // `?today=` while its caller keeps sending a bare URL, so the window quietly
    // falls back to the server's UTC clock and two screens disagree.
    expect(unregistered).toEqual([]);
  });

  it('does not list a route that no longer reads the client day', () => {
    const live = routesUsingClientToday(API_DIR);
    expect(Object.keys(CLIENTS).filter((r) => !live.includes(r))).toEqual([]);
  });

  it.each(HOOK_CASES)('%s sends the client local day', (_route, render) => {
    render();

    const passedKey = mockUseSWR.mock.calls[0]![0] as string;
    expect(typeof passedKey).toBe('string');
    expect(passedKey).toContain(`today=${today()}`);
  });

  it.each(HOOK_CASES)('%s keeps its KEY constant usable as a prefix', (_route, render, key) => {
    render();

    const passedKey = mockUseSWR.mock.calls[0]![0] as string;
    // Everything revalidating these matches with startsWith(KEY).
    expect(passedKey.startsWith(key!)).toBe(true);
    // The constant itself must stay bare — no query string baked in.
    expect(key).not.toContain('?');
  });

  it.each(HOOK_CASES)('%s separates the query string with exactly one ?', (_route, render) => {
    render();
    const passedKey = mockUseSWR.mock.calls[0]![0] as string;
    expect(passedKey.split('?')).toHaveLength(2);
  });
});

describe('useSpendingByCategory sends what it was asked for', () => {
  // Nothing proved `period` ever reached the network. Deleting
  // `params.set('period', period)` left every other test green: the component
  // test mocks this hook wholesale and only checks it was CALLED with 'year',
  // the route test invokes GET directly, and the key tests above render it with
  // no arguments. The user-visible effect of that deletion is the whole feature
  // silently reverting to month scope.

  it.each(['week', 'month', 'quarter', 'year'] as const)('puts period=%s in the URL', (period) => {
    renderHook(() => useSpendingByCategory(undefined, period));

    expect(mockUseSWR.mock.calls[0]![0]).toContain(`period=${period}`);
  });

  it('sends month instead of period when a month is given', () => {
    // `?month=` is a drill-down at a named month; the route makes it win, so
    // sending both would be ambiguous.
    renderHook(() => useSpendingByCategory('2026-03', 'year'));

    const key = mockUseSWR.mock.calls[0]![0] as string;
    expect(key).toContain('month=2026-03');
    expect(key).not.toContain('period=');
  });

  it('sends neither when neither is given', () => {
    renderHook(() => useSpendingByCategory());

    const key = mockUseSWR.mock.calls[0]![0] as string;
    expect(key).not.toContain('period=');
    expect(key).not.toContain('month=');
  });
});
