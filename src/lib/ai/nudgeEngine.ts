/**
 * Nudge Engine
 *
 * Pure computation module that evaluates whether a spending nudge should fire
 * after a transaction is saved. Operates per-transaction at save time (not batch).
 *
 * Thresholds:
 *   ≥ 80% of historical avg → 'approaching' nudge (blue, informational)
 *   ≥ 100% of historical avg → 'exceeded' nudge (orange, coaching)
 *   historicalAvg === 0 → no nudge (new category, no baseline to compare)
 *
 * No Supabase, no side effects — pure input → output.
 */

import type { NudgePayload, NudgeSeverity } from '@/types/database.types';

export interface NudgeEngineInput {
  userId: string;
  categoryId: string;
  categoryName: string;
  /** Current month total AFTER the new transaction amount is included */
  currentMonthTotal: number;
  /** 3-month rolling average monthly spend for this category (0 = no history) */
  historicalAvg: number;
  /** Name of the user's soonest active goal with a deadline, or null */
  affectedGoalName: string | null;
}

/**
 * Evaluates whether a spending nudge should fire based on how the new
 * transaction affects the category's monthly pace vs its historical average.
 *
 * Returns null when no nudge is warranted.
 */
export function evaluateNudge(input: NudgeEngineInput): NudgePayload | null {
  const { categoryId, categoryName, currentMonthTotal, historicalAvg, affectedGoalName } = input;

  // No baseline = no nudge (avoid false positives for new categories)
  if (historicalAvg === 0) return null;

  const pctOfAvg = Math.round((currentMonthTotal / historicalAvg) * 100);

  let severity: NudgeSeverity;
  let title: string;
  let body: string;

  if (pctOfAvg >= 100) {
    severity = 'exceeded';
    title = `${categoryName} spending exceeded your usual amount`;
    body = `You've spent $${currentMonthTotal.toFixed(0)} in ${categoryName} this month — your usual monthly average is $${historicalAvg.toFixed(0)}.`;
  } else if (pctOfAvg >= 80) {
    severity = 'approaching';
    title = `${categoryName} spending at ${pctOfAvg}%`;
    body = `You've used ${pctOfAvg}% of your usual ${categoryName} budget for the month ($${currentMonthTotal.toFixed(0)} of ~$${historicalAvg.toFixed(0)}).`;
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
