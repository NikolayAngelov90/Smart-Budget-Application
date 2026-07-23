/**
 * Group a chronological (newest-first) list of transactions into date buckets
 * with human labels: Today / Yesterday / "Wednesday, 23 Jul".
 *
 * Story 16.1 (Transactions redesign): the list is presented under date headers
 * rather than as a flat run. Kept as a pure, framework-free helper so it is unit
 * testable without rendering.
 *
 * Dates are compared as `yyyy-MM-dd` strings — transactions store `date` as a
 * DATE column string, and comparing via `new Date()` would misbucket across
 * timezones (project rule).
 */

import { format, subDays, parseISO } from 'date-fns';
import type { Locale } from 'date-fns';

export interface DateGroup<T> {
  /** The `yyyy-MM-dd` key for the day. */
  key: string;
  /** Display label: Today / Yesterday / localized "EEEE, d MMM". */
  label: string;
  items: T[];
}

interface GroupOptions {
  todayLabel: string;
  yesterdayLabel: string;
  /** date-fns locale for the fallback weekday label (e.g. Bulgarian). */
  locale?: Locale;
  /** Override "now" — for deterministic tests. */
  now?: Date;
}

export function groupTransactionsByDate<T extends { date: string }>(
  transactions: T[],
  { todayLabel, yesterdayLabel, locale, now = new Date() }: GroupOptions
): DateGroup<T>[] {
  const todayKey = format(now, 'yyyy-MM-dd');
  const yesterdayKey = format(subDays(now, 1), 'yyyy-MM-dd');

  const groups: DateGroup<T>[] = [];
  const index = new Map<string, DateGroup<T>>();

  for (const tx of transactions) {
    const key = tx.date; // already 'yyyy-MM-dd'
    let group = index.get(key);
    if (!group) {
      let label: string;
      if (key === todayKey) {
        label = todayLabel;
      } else if (key === yesterdayKey) {
        label = yesterdayLabel;
      } else {
        label = format(parseISO(key), 'EEEE, d MMM', locale ? { locale } : undefined);
      }
      group = { key, label, items: [] };
      index.set(key, group);
      groups.push(group); // preserves the input order (newest-first)
    }
    group.items.push(tx);
  }

  return groups;
}
