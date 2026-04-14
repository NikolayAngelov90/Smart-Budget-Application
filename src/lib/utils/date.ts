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
