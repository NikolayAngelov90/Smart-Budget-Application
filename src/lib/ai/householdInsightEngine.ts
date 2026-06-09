/**
 * Household Insight Engine
 * Story 13.10: Household-Level AI Insights
 *
 * Pure, deterministic functions (no DB, no external AI) that turn aggregate household
 * spending totals into household-framed insights ("Your household spent 20% more on
 * Groceries this month"). The inputs are membership-gated aggregates that already exclude
 * private categories (household_category_period_totals), so the engine structurally cannot
 * leak any member's private data.
 *
 * Coaching tone is mandatory: encouraging, never shaming.
 */

import { formatAmount } from '@/lib/utils/formatAmount';
import type { HouseholdPeriodTotal, HouseholdInsight } from '@/types/database.types';

export interface HouseholdInsightInput {
  /** ISO 4217 currency code used to format amounts (the viewer's preference). */
  currency: string;
  /** Per-category totals for the current month window. */
  current: HouseholdPeriodTotal[];
  /** Per-category totals for the previous month window. */
  previous: HouseholdPeriodTotal[];
}

/** Previous-period total must be at least this to compute a meaningful % change. */
const BASELINE_FLOOR = 20;
/** Minimum absolute % change before an insight is worth surfacing. */
const THRESHOLD_PCT = 15;
/** Max per-category insights. */
const MAX_CATEGORY_INSIGHTS = 3;

function sum(totals: HouseholdPeriodTotal[]): number {
  return totals.reduce((acc, t) => acc + Number(t.total), 0);
}

/**
 * Per-category insights: shared categories whose household spend changed ≥ THRESHOLD_PCT
 * vs last month (with a baseline floor to avoid noise). Largest swing first, capped.
 */
export function detectHouseholdCategoryChanges(input: HouseholdInsightInput): HouseholdInsight[] {
  const { currency, current, previous } = input;
  const prevById = new Map(previous.map((p) => [p.category_id, Number(p.total)]));

  const changes = current
    .map((c) => {
      const cur = Number(c.total);
      const prev = prevById.get(c.category_id) ?? 0;
      const pct = prev >= BASELINE_FLOOR ? ((cur - prev) / prev) * 100 : 0;
      return { id: c.category_id, name: c.category_name, cur, prev, pct };
    })
    .filter((c) => c.prev >= BASELINE_FLOOR && Math.abs(c.pct) >= THRESHOLD_PCT)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, MAX_CATEGORY_INSIGHTS);

  return changes.map(({ id, name, cur, prev, pct }) => {
    const rounded = Math.round(Math.abs(pct));
    const direction = pct > 0 ? 'more' : 'less';
    const tail =
      pct > 0
        ? 'Worth a quick chat as a household about whether that fits the plan — no judgement!'
        : "Nice — that's less than last month. Keep it up!";
    return {
      type: 'household_category_change' as const,
      title: `Your household spent ${rounded}% ${direction} on ${name} this month`,
      description: `Your household spent ${formatAmount(Math.round(cur), currency)} on ${name} this month — about ${rounded}% ${direction} than last month (${formatAmount(Math.round(prev), currency)}). ${tail}`,
      metadata: {
        category_id: id,
        category_name: name,
        current_amount: Math.round(cur),
        previous_amount: Math.round(prev),
        percent_change: Math.round(pct),
      },
    } satisfies HouseholdInsight;
  });
}

/**
 * Overall household shared-spend change vs last month (single insight when meaningful).
 */
export function detectHouseholdSpendChange(input: HouseholdInsightInput): HouseholdInsight[] {
  const { currency, current, previous } = input;
  const cur = sum(current);
  const prev = sum(previous);
  if (prev < BASELINE_FLOOR) return [];

  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < THRESHOLD_PCT) return [];

  const rounded = Math.round(Math.abs(pct));
  const direction = pct > 0 ? 'higher' : 'lower';
  return [
    {
      type: 'household_spend_change' as const,
      title: `Your household's shared spending is ${rounded}% ${direction} than last month`,
      description: `Your household's shared spending so far this month is ${formatAmount(Math.round(cur), currency)} — about ${rounded}% ${direction} than last month (${formatAmount(Math.round(prev), currency)}).`,
      metadata: {
        current_amount: Math.round(cur),
        previous_amount: Math.round(prev),
        percent_change: Math.round(pct),
      },
    } satisfies HouseholdInsight,
  ];
}

/**
 * Composes all household insight detectors. Overall spend change first, then the biggest
 * per-category swings. Deterministic and side-effect free.
 */
export function generateHouseholdInsights(input: HouseholdInsightInput): HouseholdInsight[] {
  return [...detectHouseholdSpendChange(input), ...detectHouseholdCategoryChanges(input)];
}
