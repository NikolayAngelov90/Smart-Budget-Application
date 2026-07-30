/**
 * @jest-environment node
 */

/**
 * resolveClientToday — deferred-work cluster B.
 *
 * Vercel runs functions with TZ=UTC while `transactions.date` holds the client's
 * LOCAL day, so six routes derived their month window from the wrong day for
 * part of every day. This is the shared guard: trust the client's calendar day,
 * but only within a day of the server's, so a stale or hostile value cannot
 * move the window arbitrarily.
 */

import fs from 'fs';
import path from 'path';
import { clientTodayParam, resolveClientToday, toLocalISODate } from '../date';

const ROOT = path.resolve(__dirname, '../../../..');

describe('resolveClientToday', () => {
  const REAL = new Date('2026-07-30T12:00:00');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(REAL);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('accepts the client day when it matches the server', () => {
    expect(toLocalISODate(resolveClientToday('2026-07-30'))).toBe('2026-07-30');
  });

  it('accepts a client one day ahead — the case the bug was about', () => {
    // UTC+3 just past midnight: the user is on the 31st, the server on the 30th.
    expect(toLocalISODate(resolveClientToday('2026-07-31'))).toBe('2026-07-31');
  });

  it('accepts a client one day behind', () => {
    // UTC-8 late evening: the user is still on the 29th.
    expect(toLocalISODate(resolveClientToday('2026-07-29'))).toBe('2026-07-29');
  });

  it('ignores a value more than a day out', () => {
    expect(toLocalISODate(resolveClientToday('2026-07-28'))).toBe('2026-07-30');
    expect(toLocalISODate(resolveClientToday('2020-01-01'))).toBe('2026-07-30');
    expect(toLocalISODate(resolveClientToday('2030-01-01'))).toBe('2026-07-30');
  });

  it.each([[null], [undefined], [''], ['not-a-date'], ['2026-7-3'], ['30-07-2026'], ['2026-13-01']])(
    'falls back to the server clock for %p',
    (value) => {
      expect(toLocalISODate(resolveClientToday(value as string | null))).toBe('2026-07-30');
    }
  );

  it('returns midday, so a DST shift cannot cross a date boundary', () => {
    expect(resolveClientToday('2026-07-31').getHours()).toBe(12);
  });

  it('crosses a month boundary, which is the whole point', () => {
    jest.setSystemTime(new Date('2026-07-31T23:30:00'));
    // Client is already in August; the server is not.
    expect(toLocalISODate(resolveClientToday('2026-08-01'))).toBe('2026-08-01');
  });

  it('clientTodayParam emits what resolveClientToday accepts', () => {
    const param = clientTodayParam();
    expect(param).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toLocalISODate(resolveClientToday(param))).toBe(param);
  });
});

/**
 * The keys these routes are read through now carry `?today=`, so anything
 * revalidating them must match by PREFIX. An exact-key mutate silently stops
 * matching — the trap Story 16-6 hit — so this is enforced, not just commented.
 */
describe('revalidation of dated keys matches by prefix', () => {
  const FILES = [
    'src/app/dashboard/page.tsx',
    'src/components/layout/AppLayout.tsx',
    'src/app/categories/page.tsx',
  ];
  const DATED = [
    'BUDGETS_KEY',
    'SCORE_KEY',
    "'/api/dashboard/spending-by-category'",
    "'/api/dashboard/budget-forecast'",
  ];

  it.each(FILES)('%s has no exact-key mutate on a dated key', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const key of DATED) {
      // e.g. `mutate(BUDGETS_KEY, undefined, { revalidate: true })`
      const exact = new RegExp(`mutate\\(\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`);
      expect(src).not.toMatch(exact);
    }
  });

  it('the hooks build their key from the client day', () => {
    for (const rel of [
      'src/lib/hooks/useBudgets.ts',
      'src/lib/hooks/useWhatIf.ts',
      'src/lib/hooks/useWishlist.ts',
      'src/lib/hooks/useBudgetScore.ts',
      'src/lib/hooks/useBudgetForecast.ts',
    ]) {
      expect(fs.readFileSync(path.join(ROOT, rel), 'utf8')).toMatch(/clientTodayParam\(\)/);
    }
  });
});
