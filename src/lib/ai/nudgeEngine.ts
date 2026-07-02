/**
 * Nudge Engine
 *
 * Pure computation module that evaluates whether a spending nudge should fire
 * after a transaction is saved. Operates per-transaction at save time (not batch).
 *
 * The baseline is the RESOLVED budget (ADR-025): the user's explicit limit when
 * one is set, otherwise the 3-month historical average. Copy is honest about
 * which one it is ("your budget" vs "your usual average").
 *
 * Thresholds:
 *   ≥ 80% of baseline → 'approaching' nudge (blue, informational)
 *   ≥ 100% of baseline → 'exceeded' nudge (orange, coaching)
 *   baseline === 0 → no nudge (no baseline to compare)
 *
 * No Supabase, no side effects — pure input → output.
 */

import { formatAmount } from '@/lib/utils/formatAmount';
import type { BudgetSource } from '@/lib/ai/budgetResolver';
import type { NudgePayload, NudgeSeverity } from '@/types/database.types';

export interface NudgeEngineInput {
  userId: string;
  categoryId: string;
  categoryName: string;
  /** Current month total AFTER the new transaction amount is included */
  currentMonthTotal: number;
  /** Resolved budget baseline: explicit limit if set, else 3-month average (0 = no baseline) */
  historicalAvg: number;
  /** Where the baseline came from; controls copy. Defaults to 'historical_average'. */
  budgetSource?: BudgetSource;
  /** Name of the user's soonest active goal with a deadline, or null */
  affectedGoalName: string | null;
  /** ISO 4217 currency code from the user's preferences (used to format amounts). */
  currency: string;
}

/**
 * Evaluates whether a spending nudge should fire based on how the new
 * transaction affects the category's monthly pace vs its historical average.
 *
 * Returns null when no nudge is warranted.
 */
export function evaluateNudge(input: NudgeEngineInput): NudgePayload | null {
  const {
    categoryId,
    categoryName,
    currentMonthTotal,
    historicalAvg,
    budgetSource = 'historical_average',
    affectedGoalName,
    currency,
  } = input;

  // No baseline = no nudge (avoid false positives for new categories)
  if (historicalAvg === 0) return null;

  const pctOfAvg = Math.round((currentMonthTotal / historicalAvg) * 100);
  const isExplicit = budgetSource === 'explicit';

  let severity: NudgeSeverity;
  let title: string;
  let body: string;

  if (pctOfAvg >= 100) {
    severity = 'exceeded';
    title = isExplicit
      ? `${categoryName} spending exceeded your budget`
      : `${categoryName} spending exceeded your usual amount`;
    body = isExplicit
      ? `You've spent ${formatAmount(currentMonthTotal, currency)} in ${categoryName} this month — your budget is ${formatAmount(historicalAvg, currency)}.`
      : `You've spent ${formatAmount(currentMonthTotal, currency)} in ${categoryName} this month — your usual monthly average is ${formatAmount(historicalAvg, currency)}.`;
  } else if (pctOfAvg >= 80) {
    severity = 'approaching';
    title = `${categoryName} spending at ${pctOfAvg}%`;
    body = isExplicit
      ? `You've used ${pctOfAvg}% of your ${categoryName} budget for the month (${formatAmount(currentMonthTotal, currency)} of ${formatAmount(historicalAvg, currency)}).`
      : `You've used ${pctOfAvg}% of your usual ${categoryName} budget for the month (${formatAmount(currentMonthTotal, currency)} of ~${formatAmount(historicalAvg, currency)}).`;
  } else {
    return null;
  }

  if (affectedGoalName) {
    body += ` Keeping an eye on this may help with your ${affectedGoalName} goal.`;
  }

  return {
    categoryId,
    categoryName,
    severity,
    currentMonthTotal: Math.round(currentMonthTotal * 100) / 100,
    historicalAvg: Math.round(historicalAvg * 100) / 100,
    pctOfAvg,
    affectedGoalName,
    title,
    body,
  };
}
