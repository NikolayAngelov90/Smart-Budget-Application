/**
 * Dashboard period ranges — Story 16.6
 *
 * Lives outside the route because Next.js restricts what a route module may
 * export, and because the range arithmetic is the part most worth testing
 * directly.
 */

import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';

export const DASHBOARD_PERIODS = ['week', 'month', 'quarter', 'year'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export interface DateRange {
  start: Date;
  end: Date;
}

export function isDashboardPeriod(value: unknown): value is DashboardPeriod {
  return typeof value === 'string' && (DASHBOARD_PERIODS as readonly string[]).includes(value);
}

/**
 * The window for `period`, plus the immediately preceding window of EQUAL
 * length — that is what the trend compares against (week vs previous week,
 * year vs previous year).
 *
 * Monday week start (`weekStartsOn: 1`) on purpose: a locale-dependent start
 * would make the same underlying data render two different weekly totals.
 *
 * "quarter" is a ROLLING 3 months — the current month plus the two before it —
 * not the calendar quarter, because the control is labelled "3 Months".
 *
 * All boundaries stay in local time. The caller formats them as `yyyy-MM-dd`
 * for comparison against the `transactions.date` DATE column; going through
 * `toISOString()` would shift local midnight into the previous UTC day and
 * misbucket transactions at the edges of every window.
 */
export function resolvePeriodRanges(
  period: DashboardPeriod,
  now: Date,
  options: { comparePartial?: boolean } = {}
): { current: DateRange; previous: DateRange } {
  const ranges = fullRanges(period, now);
  if (!options.comparePartial) return ranges;

  // The current window runs to the END of the period, so for all but its last
  // day it holds PARTIAL data — while `previous` is a complete window. Compared
  // raw, the trend is structurally negative nearly always: on the Monday of a
  // new week, one day of spending against a full previous week reads as a ~86%
  // collapse. Truncate `previous` to the same number of elapsed days so the
  // comparison is like-for-like (week-to-date vs the same days last week).
  const elapsedDays = differenceInCalendarDays(now, ranges.current.start) + 1;
  const truncatedEnd = endOfDay(addDays(ranges.previous.start, elapsedDays - 1));

  return {
    current: ranges.current,
    previous: {
      start: ranges.previous.start,
      // Clamp: a 31-day month-to-date has no 31st day in a 30-day predecessor.
      end: truncatedEnd < ranges.previous.end ? truncatedEnd : ranges.previous.end,
    },
  };
}

function fullRanges(
  period: DashboardPeriod,
  now: Date
): { current: DateRange; previous: DateRange } {
  switch (period) {
    case 'week': {
      const opts = { weekStartsOn: 1 } as const;
      return {
        current: { start: startOfWeek(now, opts), end: endOfWeek(now, opts) },
        previous: {
          start: startOfWeek(subWeeks(now, 1), opts),
          end: endOfWeek(subWeeks(now, 1), opts),
        },
      };
    }
    case 'quarter':
      return {
        current: { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) },
        previous: {
          start: startOfMonth(subMonths(now, 5)),
          end: endOfMonth(subMonths(now, 3)),
        },
      };
    case 'year':
      return {
        current: { start: startOfYear(now), end: endOfYear(now) },
        previous: {
          start: startOfYear(subYears(now, 1)),
          end: endOfYear(subYears(now, 1)),
        },
      };
    case 'month':
    default:
      return {
        current: { start: startOfMonth(now), end: endOfMonth(now) },
        previous: {
          start: startOfMonth(subMonths(now, 1)),
          end: endOfMonth(subMonths(now, 1)),
        },
      };
  }
}
