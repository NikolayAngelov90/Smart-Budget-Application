/**
 * Date utility — timezone-safe helpers
 *
 * Use toLocalISODate() instead of date.toISOString().split('T')[0]
 * to avoid UTC offset shifting the date (e.g. 11pm local = next day UTC).
 */

/** Formats a Date to YYYY-MM-DD using LOCAL date components, not UTC. */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole days between two dates, ignoring time of day. */
function calendarDaysApart(a: Date, b: Date): number {
  const dayA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const dayB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((dayA - dayB) / 86_400_000);
}

/**
 * Which day "now" is, from the USER's point of view.
 *
 * Vercel runs functions with TZ=UTC, but `transactions.date` holds the client's
 * LOCAL day. Any route that derives a window from `new Date()` therefore puts
 * the boundary in the wrong place for anyone not on UTC: a Sofia user (UTC+3)
 * at 00:30 on the 1st is still in "last month" as far as the server knows, so
 * the transaction they just added falls outside the window entirely.
 *
 * Callers pass the client's own local date (`?today=YYYY-MM-DD`). It is clamped
 * to ±1 day of the server's date so a stale or hostile value cannot shift the
 * window arbitrarily — the same clock-skew guard the transactions route uses.
 *
 * Returns midday local, so a DST shift can never push the value across a date
 * boundary.
 */
export function resolveClientToday(todayParam: string | null | undefined): Date {
  const serverNow = new Date();
  if (!todayParam || !/^\d{4}-\d{2}-\d{2}$/.test(todayParam)) return serverNow;

  const candidate = new Date(`${todayParam}T12:00:00`);
  if (Number.isNaN(candidate.getTime())) return serverNow;
  if (Math.abs(calendarDaysApart(candidate, serverNow)) > 1) return serverNow;

  return candidate;
}

/** The `?today=` value a client should send: its own local calendar day. */
export function clientTodayParam(): string {
  return toLocalISODate(new Date());
}
