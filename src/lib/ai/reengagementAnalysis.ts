/**
 * Re-engagement Analysis Engine
 *
 * Pure computation for the lapsed-user welcome-back summary (Story 12.6 / FR8).
 * Produces a re-orientation snapshot — how long they were away, their typical
 * monthly spend, active recurring commitments, goal progress, and one coaching
 * next step — all from existing data.
 *
 * No Supabase, no side effects — pure input → output.
 */

import { calculateMean } from './spendingAnalysis';
import type {
  DetectedSubscription,
  Goal,
  ReengagementGoalSummary,
  ReengagementSummary,
  Transaction,
} from '@/types/database.types';

export interface ReengagementInput {
  lastActivityDate: Date;
  today: Date;
  /** Expense-only transactions, ~6 months, for the baseline */
  historicalTransactions: Transaction[];
  /** Active/kept subscriptions (caller filters) */
  subscriptions: DetectedSubscription[];
  goals: Goal[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MAX_GOALS = 3;

/** Normalizes a subscription's estimated amount to a monthly figure. */
function toMonthly(estimatedAmount: number, frequency: DetectedSubscription['frequency']): number {
  switch (frequency) {
    case 'weekly':
      return estimatedAmount * (52 / 12);
    case 'quarterly':
      return estimatedAmount / 3;
    case 'annual':
      return estimatedAmount / 12;
    case 'monthly':
    default:
      return estimatedAmount;
  }
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Builds the welcome-back summary for a returning lapsed user.
 */
export function buildReengagementSummary(input: ReengagementInput): ReengagementSummary {
  const { lastActivityDate, today, historicalTransactions, subscriptions, goals } = input;

  const lapsedDays = Math.max(0, Math.floor((today.getTime() - lastActivityDate.getTime()) / MS_PER_DAY));

  // Typical monthly spend — mean of monthly expense totals
  const monthlyTotals = new Map<string, number>();
  for (const tx of historicalTransactions) {
    if (tx.type !== 'expense') continue;
    const key = tx.date.substring(0, 7);
    monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + tx.amount);
  }
  const typicalMonthlySpend = round2(calculateMean(Array.from(monthlyTotals.values())));

  // Subscriptions normalized to monthly
  const activeSubscriptionCount = subscriptions.length;
  const activeSubscriptionMonthlyTotal = round2(
    subscriptions.reduce((sum, s) => sum + toMonthly(s.estimated_amount, s.frequency), 0)
  );

  // Goals → progress, top 3 by pct
  const goalSummaries: ReengagementGoalSummary[] = goals
    .map((g): ReengagementGoalSummary => ({
      id: g.id,
      name: g.name,
      current_amount: round2(g.current_amount),
      target_amount: round2(g.target_amount),
      pct: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, MAX_GOALS);

  // Recommended action (first applicable, coaching tone).
  // Kept currency-neutral — monetary amounts are rendered with the user's
  // currency elsewhere in the card via formatAmount.
  let recommendedAction: string;
  if (activeSubscriptionCount > 0) {
    recommendedAction = `While you were away, you had ${activeSubscriptionCount} active subscription${activeSubscriptionCount === 1 ? '' : 's'}. Worth a quick review.`;
  } else if (goalSummaries.length > 0) {
    recommendedAction = `Add your recent expenses to update progress on ${goalSummaries[0]!.name}.`;
  } else {
    recommendedAction = 'Log your latest expenses to refresh your insights.';
  }

  return {
    lapsed_days: lapsedDays,
    last_active_date: toLocalDateString(lastActivityDate),
    typical_monthly_spend: typicalMonthlySpend,
    active_subscription_count: activeSubscriptionCount,
    active_subscription_monthly_total: activeSubscriptionMonthlyTotal,
    goals: goalSummaries,
    recommended_action: recommendedAction,
  };
}
