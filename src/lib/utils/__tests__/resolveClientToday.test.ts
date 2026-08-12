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
import {
  clientTimeZoneParam,
  clientTodayParam,
  resolveClientToday,
  toLocalISODate,
} from '../date';

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

  it('the hooks build their key from the LIVE client day', () => {
    // Was `toMatch(/clientTodayParam\(\)/)`. That passed while the bug was
    // present: calling it inline only recomputes on a render that happens for
    // some other reason, so an idle tab kept yesterday's key and
    // `revalidateOnFocus` refetched it. The day has to come from the hook that
    // re-renders when it changes.
    for (const rel of [
      'src/lib/hooks/useBudgets.ts',
      'src/lib/hooks/useWhatIf.ts',
      'src/lib/hooks/useWishlist.ts',
      'src/lib/hooks/useBudgetScore.ts',
      'src/lib/hooks/useBudgetForecast.ts',
      'src/lib/hooks/useSpendingByCategory.ts',
    ]) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(src).toMatch(/useClientToday\(\)/);
      // A bare inline call is the regression; the only mentions left should be
      // in the comment explaining why it is no longer used.
      expect(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).not.toMatch(/clientTodayParam\(\)/);
    }
  });
});

/**
 * HP-7: the ±1-day clamp bounded a wrong clock, but one day of tolerance became
 * a whole different window once the day started driving a week, a quarter or a
 * year — a device one day fast on 31 Dec asking for `period=year` got the NEXT
 * year and an empty chart.
 *
 * The clamp could not simply be tightened: that same ±1 day is exactly what a
 * legitimate UTC+14 user needs at 00:30 on 1 Jan, when their year really has
 * rolled over while the UTC server is still on the 31st. A date alone cannot
 * tell the two apart.
 *
 * A time zone can. `Intl` resolves it from the tz database rather than the
 * clock, so the day is recomputed from the SERVER's trusted time.
 */
describe('resolveClientToday with a time zone', () => {
  const AT_UTC_2330_DEC31 = new Date('2026-12-31T23:30:00Z');

  afterEach(() => {
    jest.useRealTimers();
  });

  it('trusts the zone over a claimed day', () => {
    // Client claims 2 Jan (clock a day fast) but is really in Sofia (UTC+2),
    // where it is already 1 Jan. The server derives 1 Jan, not 2 Jan.
    jest.useFakeTimers().setSystemTime(AT_UTC_2330_DEC31);

    expect(toLocalISODate(resolveClientToday('2027-01-02', 'Europe/Sofia'))).toBe('2027-01-01');
  });

  it('still honours a genuinely ahead time zone', () => {
    // The case the clamp exists for: UTC+14 has already rolled over.
    jest.useFakeTimers().setSystemTime(AT_UTC_2330_DEC31);

    expect(toLocalISODate(resolveClientToday(null, 'Pacific/Kiritimati'))).toBe('2027-01-01');
  });

  it('still honours a genuinely behind time zone', () => {
    jest.useFakeTimers().setSystemTime(AT_UTC_2330_DEC31);

    expect(toLocalISODate(resolveClientToday(null, 'America/Los_Angeles'))).toBe('2026-12-31');
  });

  it('a wrong clock can no longer shift the window at all', () => {
    // The failure this closes: one day out on New Year's Eve moved a `year`
    // window into the next year.
    jest.useFakeTimers().setSystemTime(AT_UTC_2330_DEC31);

    expect(toLocalISODate(resolveClientToday('2027-01-01', 'America/Los_Angeles'))).toBe(
      '2026-12-31'
    );
  });

  it('falls back to the clamped day for an unknown or absent zone', () => {
    // Intl throws RangeError on a zone it does not know, and older clients send
    // no zone at all — both must keep working.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T09:00:00Z'));

    expect(toLocalISODate(resolveClientToday('2026-07-16', 'Not/AZone'))).toBe('2026-07-16');
    expect(toLocalISODate(resolveClientToday('2026-07-16', ''))).toBe('2026-07-16');
    // And the clamp still applies on that path.
    expect(toLocalISODate(resolveClientToday('2026-01-05', null))).toBe('2026-07-15');
  });

  it('clientTimeZoneParam emits something resolveClientToday accepts', () => {
    const tz = clientTimeZoneParam();

    expect(tz.length).toBeGreaterThan(0);
    expect(() => resolveClientToday(null, tz)).not.toThrow();
  });
});
