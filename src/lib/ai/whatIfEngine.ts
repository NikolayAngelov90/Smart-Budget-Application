/**
 * What-If Engine — Story 14.4 (FR16)
 *
 * Pure computation of exploratory savings projections: per-category percentage
 * reductions + cancelled subscriptions → monthly/annual savings and the effect
 * on the nearest savings goal. Epic-12 style (typed input → typed output, no
 * Supabase, no currency formatting, no user-facing text) and deliberately
 * client-safe: the simulator invokes it on every slider move ("live
 * calculation, no save" — UX spec), so there is no per-adjustment round-trip.
 *
 * Exploratory ONLY — nothing here (or anywhere in this feature) writes data.
 */

import type { WhatIfProjection } from '@/types/database.types';

export interface WhatIfAdjustment {
  /** 3-month average monthly spend for the category */
  avgMonthly: number;
  /** Slider value 0–100 (% reduction of avgMonthly) */
  reductionPct: number;
}

export interface WhatIfEngineInput {
  adjustments: WhatIfAdjustment[];
  /** Monthly amounts of subscriptions toggled to "cancelled" */
  cancelledMonthlyAmounts: number[];
  /** Nearest unmet future-deadline goal, or null */
  goal: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    /** DATE string YYYY-MM-DD */
    deadline: string;
  } | null;
  today: Date;
}

const MS_PER_DAY = 86_400_000;
/** Average days per month (365.25 / 12) — shared by savings→pace and days→months */
export const DAYS_PER_MONTH = 30.44;

/** Parse a YYYY-MM-DD DATE string as LOCAL midnight — never new Date('YYYY-MM-DD')
 *  (UTC-midnight parse misdates by a day in non-UTC timezones; 14-2/14-3 lesson). */
function parseLocalDate(dateString: string): Date | null {
  const [y, m, d] = dateString.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Normalize -0 so the UI never renders "-€0.00" (14-3 review lesson)
const round2 = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
};
const round1 = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? 0 : r;
};

export function computeWhatIfProjection(input: WhatIfEngineInput): WhatIfProjection {
  const { adjustments, cancelledMonthlyAmounts, goal, today } = input;

  const sliderSavings = adjustments.reduce(
    (sum, a) => sum + a.avgMonthly * (a.reductionPct / 100),
    0
  );
  const subscriptionSavings = cancelledMonthlyAmounts.reduce((sum, m) => sum + m, 0);
  const monthlySavings = round2(sliderSavings + subscriptionSavings);
  const annualSavings = round2(monthlySavings * 12);

  // Goal impact: extra monthly savings raise the daily pace toward the target,
  // shrinking the days needed vs. the deadline-required pace (14-3 model).
  let goalImpact: WhatIfProjection['goal_impact'] = null;
  if (goal && monthlySavings > 0) {
    const deadline = parseLocalDate(goal.deadline);
    const remaining = goal.targetAmount - goal.currentAmount;
    if (deadline && remaining > 0) {
      const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const daysToDeadline = Math.ceil((deadline.getTime() - todayLocal.getTime()) / MS_PER_DAY);
      if (daysToDeadline > 0) {
        const dailyRequired = remaining / daysToDeadline;
        const newDaily = dailyRequired + monthlySavings / DAYS_PER_MONTH;
        const newDays = Math.ceil(remaining / newDaily);
        const daysEarlier = daysToDeadline - newDays;
        goalImpact = {
          goal_name: goal.name,
          days_earlier: daysEarlier,
          months_earlier: round1(daysEarlier / DAYS_PER_MONTH),
        };
      }
    }
  }

  return {
    monthly_savings: monthlySavings,
    annual_savings: annualSavings,
    goal_impact: goalImpact,
  };
}
