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
export function resolveClientToday(
  todayParam: string | null | undefined,
  timeZoneParam?: string | null
): Date {
  const serverNow = new Date();

  // Preferred path: derive the day from the client's TIME ZONE using the
  // server's own clock.
  //
  // HP-7. The ±1-day clamp below bounds a wrong clock, but one day of tolerance
  // becomes a whole different window once the day drives a week, a quarter or a
  // year: a device one day fast on 31 Dec asking for `period=year` got the
  // NEXT year, and an empty donut. The clamp could not be tightened, because
  // that same ±1 day is exactly what a legitimate UTC+14 user needs — at 00:30
  // on 1 Jan their year really has rolled over while the UTC server is still on
  // the 31st. The two cases are indistinguishable from a date alone.
  //
  // A time zone distinguishes them. `Intl` resolves it from the tz database
  // rather than the clock, so a device with the wrong time still reports the
  // right zone — and the day is then computed from the SERVER's trusted clock.
  // Nothing about the client's own notion of "now" is trusted at all.
  const zoned = todayInTimeZone(timeZoneParam, serverNow);
  if (zoned) return zoned;

  // Fallback for clients that send only `?today=` (older bundles, and the
  // handful of callers not yet migrated). Clamped as before.
  if (!todayParam || !/^\d{4}-\d{2}-\d{2}$/.test(todayParam)) return serverNow;

  const candidate = new Date(`${todayParam}T12:00:00`);
  if (Number.isNaN(candidate.getTime())) return serverNow;
  if (Math.abs(calendarDaysApart(candidate, serverNow)) > 1) return serverNow;

  return candidate;
}

/**
 * `now` rendered as a local calendar day in `timeZone`, at midday.
 *
 * Midday for the same reason as above: a DST shift can never push it across a
 * date boundary. Returns null for a missing or unrecognised zone — `Intl`
 * throws `RangeError` on one it does not know.
 */
function todayInTimeZone(timeZone: string | null | undefined, now: Date): Date | null {
  if (!timeZone) return null;
  try {
    // `en-CA` formats as YYYY-MM-DD, which is the shape we already use.
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const resolved = new Date(`${day}T12:00:00`);
    return Number.isNaN(resolved.getTime()) ? null : resolved;
  } catch {
    // Unknown or malformed zone — fall through to the clamped `today`.
    return null;
  }
}

/** The `?today=` value a client should send: its own local calendar day. */
export function clientTodayParam(): string {
  return toLocalISODate(new Date());
}

/**
 * The `?tz=` value a client should send: its IANA zone.
 *
 * Read from the tz database via `Intl`, so it stays correct even when the
 * device clock is wrong — which is the whole point (see `resolveClientToday`).
 */
export function clientTimeZoneParam(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}
