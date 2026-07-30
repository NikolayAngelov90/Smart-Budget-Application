/**
 * @jest-environment node
 */

/**
 * DATE-column window boundaries — deferred-work cleanup.
 *
 * `transactions.date` is `DATE NOT NULL` (migration 001). Four dashboard routes
 * built their window from LOCAL-time `Date` objects and then sent
 * `.toISOString()`, which shifts local midnight into the previous UTC day. For
 * anyone east of UTC — bg is UTC+2/+3, the app's second locale — the window
 * silently included the previous day.
 *
 * These pin the boundary strings the routes actually send, so nobody
 * reintroduces `.toISOString()` on a DATE comparison. The project convention is
 * documented in `src/lib/utils/date.ts`.
 */

import { endOfMonth, startOfMonth } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { toLocalISODate } from '@/lib/utils/date';

const ROOT = path.resolve(__dirname, '../../../../..');
const ROUTES = [
  'src/app/api/dashboard/month-over-month/route.ts',
  'src/app/api/dashboard/spending-by-category/route.ts',
  'src/app/api/dashboard/trends/route.ts',
  'src/app/api/values/spending/route.ts',
];

describe('DATE-column comparisons never go through toISOString', () => {
  it.each(ROUTES)('%s compares the date column as yyyy-MM-dd', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');

    // The exact regression: a DATE column filtered with an ISO timestamp.
    expect(src).not.toMatch(/\.(gte|lte|lt|gt)\('date',[^)]*toISOString/);
    // And it must be going through the helper that keeps it local.
    expect(src).toMatch(/toLocalISODate/);
  });
});

describe('toLocalISODate keeps month boundaries on the user calendar day', () => {
  it('does not roll a local first-of-month back into the previous month', () => {
    // 1 July local. toISOString() on a UTC+3 machine yields 2026-06-30T21:00Z,
    // whose date part is 2026-06-30 — a whole extra day of spend.
    const localFirst = startOfMonth(new Date('2026-07-15T12:00:00'));
    expect(toLocalISODate(localFirst)).toBe('2026-07-01');
    expect(localFirst.getDate()).toBe(1);
  });

  it('keeps the last day of the month as the inclusive upper bound', () => {
    expect(toLocalISODate(endOfMonth(new Date('2026-07-15T12:00:00')))).toBe('2026-07-31');
    // February, and a leap February.
    expect(toLocalISODate(endOfMonth(new Date('2026-02-10T12:00:00')))).toBe('2026-02-28');
    expect(toLocalISODate(endOfMonth(new Date('2028-02-10T12:00:00')))).toBe('2028-02-29');
  });

  it('is stable just after local midnight, which is when the bug bit', () => {
    // 00:30 local on the 1st — the window the previous code got wrong.
    const justAfterMidnight = new Date(2026, 6, 1, 0, 30, 0);
    expect(toLocalISODate(justAfterMidnight)).toBe('2026-07-01');
  });

  it('handles a December→January rollover without changing the year', () => {
    const localFirst = startOfMonth(new Date('2027-01-05T00:15:00'));
    expect(toLocalISODate(localFirst)).toBe('2027-01-01');
  });
});
