/**
 * Recovery Planner
 *
 * Pure computation module for 30-day budget recovery plans (Story 12.4 / FR4).
 * Identifies categories where current-month spend exceeds the 3-month historical
 * average and builds a realistic per-category target based on the user's
 * leanest historical month. The average uses the FIXED window (see
 * fixedWindowMonthlyAverage) so recovery agrees with nudges/forecasts about
 * what "usual spend" means (extended by the 2026-07-02 review decision).
 *
 * No Supabase, no side effects — pure input → output.
 */

import { fixedWindowMonthlyAverage } from './spendingAnalysis';
import type { Category, RecoveryTarget, Transaction } from '@/types/database.types';

export interface RecoveryPlannerInput {
  /** Expense-only transactions for the current calendar month */
  currentMonthTransactions: Transaction[];
  /** Expense-only transactions for the prior 3 calendar months */
  historicalTransactions: Transaction[];
  categories: Category[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

// A 30-day plan: weekly = monthly / (30/7); daily = monthly / 30
const DAYS_IN_PLAN = 30;
const DAYS_IN_WEEK = 7;

/**
 * Builds the per-category recovery targets for a 30-day plan.
 *
 * A category is in scope when its current-month spend exceeds its 3-month
 * historical average (and that average is > 0). The recovery target is the
 * category's historical MINIMUM monthly spend — the leanest month the user
 * has already proven achievable.
 *
 * Returns targets sorted by overspend severity (current − avg) descending.
 * Empty array means no recovery plan is needed.
 */
export function buildRecoveryPlanTargets(input: RecoveryPlannerInput): RecoveryTarget[] {
  const { currentMonthTransactions, historicalTransactions, categories } = input;

  // Aggregate current-month expense per category
  const currentSpendMap = new Map<string, number>();
  for (const tx of currentMonthTransactions) {
    if (tx.type !== 'expense') continue;
    currentSpendMap.set(tx.category_id, (currentSpendMap.get(tx.category_id) ?? 0) + tx.amount);
  }

  // Aggregate historical expense per category per calendar month (YYYY-MM)
  const historicalMonthMap = new Map<string, Map<string, number>>();
  for (const tx of historicalTransactions) {
    if (tx.type !== 'expense') continue;
    const monthKey = tx.date.substring(0, 7);
    if (!historicalMonthMap.has(tx.category_id)) {
      historicalMonthMap.set(tx.category_id, new Map());
    }
    historicalMonthMap.get(tx.category_id)!.set(
      monthKey,
      (historicalMonthMap.get(tx.category_id)!.get(monthKey) ?? 0) + tx.amount
    );
  }

  const scored: Array<{ target: RecoveryTarget; severity: number }> = [];

  for (const category of categories) {
    const currentSpend = currentSpendMap.get(category.id) ?? 0;
    if (currentSpend === 0) continue;

    const monthlyTotals = Array.from(historicalMonthMap.get(category.id)?.values() ?? []);
    // Need at least one prior month of data to derive avg + min
    if (monthlyTotals.length === 0) continue;

    const historicalAvg = fixedWindowMonthlyAverage(monthlyTotals);
    if (historicalAvg <= 0) continue;

    // Overspent: current month exceeds the historical average
    if (currentSpend <= historicalAvg) continue;

    const historicalMin = Math.min(...monthlyTotals);
    const monthlyTarget = round2(historicalMin);

    scored.push({
      target: {
        category_id: category.id,
        category_name: category.name,
        category_color: category.color,
        historical_avg: round2(historicalAvg),
        historical_min: round2(historicalMin),
        monthly_target: monthlyTarget,
        weekly_target: round2(monthlyTarget / (DAYS_IN_PLAN / DAYS_IN_WEEK)),
        daily_target: round2(monthlyTarget / DAYS_IN_PLAN),
        current_spend: round2(currentSpend),
      },
      severity: currentSpend - historicalAvg,
    });
  }

  scored.sort((a, b) => b.severity - a.severity);
  return scored.map((s) => s.target);
}
