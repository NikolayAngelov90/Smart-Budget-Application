/**
 * Dashboard period ranges — Story 16.6.
 *
 * The trend chip is only honest if "previous" is the same LENGTH of window as
 * "current" and sits immediately before it. These pin the boundaries, including
 * the ones that are easy to get wrong: month-length differences, year rollover,
 * and the DST/midnight edges that make `toISOString()` the wrong tool here.
 */

import { format } from 'date-fns';
import { resolvePeriodRanges, isDashboardPeriod, DASHBOARD_PERIODS } from '../dashboardPeriod';
import type { DashboardPeriod } from '../dashboardPeriod';

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const ranges = (period: DashboardPeriod, iso: string) => {
  const { current, previous } = resolvePeriodRanges(period, new Date(iso));
  return {
    current: [ymd(current.start), ymd(current.end)],
    previous: [ymd(previous.start), ymd(previous.end)],
  };
};

describe('resolvePeriodRanges', () => {
  it('week runs Monday to Sunday, previous week immediately before', () => {
    // 2026-07-29 is a Wednesday.
    expect(ranges('week', '2026-07-29T12:00:00')).toEqual({
      current: ['2026-07-27', '2026-08-02'],
      previous: ['2026-07-20', '2026-07-26'],
    });
  });

  it('week uses a fixed Monday start, not the locale default', () => {
    // Sunday. With a Sunday-start week this would open a NEW week; with the
    // Monday start it is the last day of the week that began on the 27th.
    expect(ranges('week', '2026-08-02T12:00:00').current).toEqual(['2026-07-27', '2026-08-02']);
  });

  it('month covers the calendar month and compares to the previous one', () => {
    expect(ranges('month', '2026-07-15T12:00:00')).toEqual({
      current: ['2026-07-01', '2026-07-31'],
      previous: ['2026-06-01', '2026-06-30'],
    });
  });

  it('month handles the year boundary', () => {
    expect(ranges('month', '2026-01-10T12:00:00')).toEqual({
      current: ['2026-01-01', '2026-01-31'],
      previous: ['2025-12-01', '2025-12-31'],
    });
  });

  it('month handles February in a leap year', () => {
    expect(ranges('month', '2028-02-10T12:00:00').current).toEqual(['2028-02-01', '2028-02-29']);
  });

  it('quarter is a rolling 3 months, compared to the 3 before it', () => {
    // Rolling, not calendar: July selects May–July, not July–September.
    expect(ranges('quarter', '2026-07-15T12:00:00')).toEqual({
      current: ['2026-05-01', '2026-07-31'],
      previous: ['2026-02-01', '2026-04-30'],
    });
  });

  it('quarter spans the year boundary correctly', () => {
    expect(ranges('quarter', '2026-01-15T12:00:00')).toEqual({
      current: ['2025-11-01', '2026-01-31'],
      previous: ['2025-08-01', '2025-10-31'],
    });
  });

  it('year covers the calendar year and compares to the previous one', () => {
    expect(ranges('year', '2026-07-15T12:00:00')).toEqual({
      current: ['2026-01-01', '2026-12-31'],
      previous: ['2025-01-01', '2025-12-31'],
    });
  });

  it('the previous window always ends the day before the current one starts', () => {
    for (const period of DASHBOARD_PERIODS) {
      const { current, previous } = resolvePeriodRanges(period, new Date('2026-07-29T12:00:00'));
      const gapDays = (current.start.getTime() - previous.end.getTime()) / 86_400_000;
      // end-of-day vs start-of-day, so just under one day apart.
      expect(gapDays).toBeGreaterThan(0);
      expect(gapDays).toBeLessThanOrEqual(1);
    }
  });

  it('keeps boundaries in LOCAL time so DATE-column comparisons do not misbucket', () => {
    // The trap: new Date(2026,0,1).toISOString() is 2025-12-31 in any timezone
    // east of UTC, which would silently pull a day from the previous year into
    // the current one. Formatting locally is what keeps this correct.
    const { current } = resolvePeriodRanges('year', new Date('2026-01-01T00:30:00'));
    expect(ymd(current.start)).toBe('2026-01-01');
    expect(current.start.getHours()).toBe(0);
  });

  it('treats an unknown period as month', () => {
    expect(resolvePeriodRanges('nonsense' as DashboardPeriod, new Date('2026-07-15T12:00:00'))).toEqual(
      resolvePeriodRanges('month', new Date('2026-07-15T12:00:00'))
    );
  });
});

describe('isDashboardPeriod', () => {
  it.each(DASHBOARD_PERIODS)('accepts %s', (period) => {
    expect(isDashboardPeriod(period)).toBe(true);
  });

  it.each([['quarterly'], [''], ['MONTH'], [null], [undefined], [3]])('rejects %p', (value) => {
    expect(isDashboardPeriod(value)).toBe(false);
  });
});
