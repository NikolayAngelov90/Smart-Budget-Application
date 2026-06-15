/**
 * Values Spending Engine
 * Story 14.2: Values-Context Spending View
 *
 * Pure, deterministic functions (no DB, no currency formatting) that turn the user's
 * values plan + per-category monthly spend into a value-grouped spending view: per-value
 * total, share of overall spend, trend vs last month, and a gentle "misalignment" flag
 * (low priority but a large share of spend). The card layer formats amounts; this layer
 * only produces numbers + flags so it is trivially unit-testable.
 */

import type { ValueWithCategories, ValueSpendRow, ValuesSpendingView } from '@/types/database.types';

export interface ValuesSpendingInput {
  /** The user's values in PRIORITY order (index 0 = highest priority). */
  values: ValueWithCategories[];
  /** category_id -> current-month expense total. */
  currentByCategory: Record<string, number>;
  /** category_id -> previous-month expense total. */
  previousByCategory: Record<string, number>;
}

/** Previous-month total must be at least this for a meaningful trend %. */
const BASELINE_FLOOR = 20;
/** Minimum absolute % change before the trend is "up"/"down" rather than "flat". */
const TREND_THRESHOLD_PCT = 15;
/** A value needs at least this share of spend to be eligible for a misalignment flag. */
const MISALIGN_SHARE_PCT = 20;
/** ...AND its priority rank must trail its spend rank by at least this many places. */
const MISALIGN_RANK_GAP = 2;

function sumOver(ids: string[], byCategory: Record<string, number>): number {
  return ids.reduce((acc, id) => acc + (byCategory[id] ?? 0), 0);
}

function trend(
  current: number,
  previous: number
): { trendDirection: ValueSpendRow['trendDirection']; trendPct: number } {
  if (previous < BASELINE_FLOOR) return { trendDirection: 'flat', trendPct: 0 };
  const pct = ((current - previous) / previous) * 100;
  if (pct >= TREND_THRESHOLD_PCT) return { trendDirection: 'up', trendPct: Math.round(pct) };
  if (pct <= -TREND_THRESHOLD_PCT) return { trendDirection: 'down', trendPct: Math.round(Math.abs(pct)) };
  return { trendDirection: 'flat', trendPct: 0 };
}

/**
 * Builds the value-grouped spending view for the current month.
 *
 * NOTE on the denominator: a category can map to multiple values (14.1 is many-to-many),
 * so summing per-value amounts double-counts. `totalSpend` is therefore the sum over the
 * DISTINCT current-month category totals, and `unassigned` is derived from that deduped
 * total — never from leftover percentage. Per-value percentages may sum to >100% when
 * categories are shared across values; that is expected.
 */
export function computeValuesSpending(input: ValuesSpendingInput): ValuesSpendingView {
  const { values, currentByCategory, previousByCategory } = input;

  const totalSpend = Object.values(currentByCategory).reduce((acc, n) => acc + n, 0);

  // Spend rank (1 = highest current spend) for the misalignment comparison.
  const spendByValueId = new Map(values.map((v) => [v.id, sumOver(v.category_ids, currentByCategory)]));
  const spendRankById = new Map<string, number>();
  [...values]
    .sort((a, b) => (spendByValueId.get(b.id) ?? 0) - (spendByValueId.get(a.id) ?? 0))
    .forEach((v, i) => spendRankById.set(v.id, i + 1));

  const rows: ValueSpendRow[] = values.map((v, i) => {
    const amount = spendByValueId.get(v.id) ?? 0;
    const prevAmount = sumOver(v.category_ids, previousByCategory);
    const percentage = totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0;
    const priorityRank = i + 1;
    const spendRank = spendRankById.get(v.id) ?? priorityRank;
    const misaligned = percentage >= MISALIGN_SHARE_PCT && priorityRank - spendRank >= MISALIGN_RANK_GAP;
    return {
      id: v.id,
      name: v.name,
      rank: priorityRank,
      amount: Math.round(amount),
      percentage,
      misaligned,
      ...trend(amount, prevAmount),
    };
  });

  // Unassigned = spend in categories mapped to NO value (deduped).
  const assigned = new Set<string>();
  for (const v of values) for (const id of v.category_ids) assigned.add(id);
  const unassignedAmount = Object.entries(currentByCategory)
    .filter(([id]) => !assigned.has(id))
    .reduce((acc, [, n]) => acc + n, 0);

  return {
    hasPlan: values.length > 0,
    totalSpend: Math.round(totalSpend),
    values: rows,
    unassigned: {
      amount: Math.round(unassignedAmount),
      percentage: totalSpend > 0 ? Math.round((unassignedAmount / totalSpend) * 100) : 0,
    },
  };
}
