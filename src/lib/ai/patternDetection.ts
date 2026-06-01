/**
 * Pattern Detection Engine
 *
 * Cross-category analysis functions that detect spending anomalies and trend
 * shifts requiring 2+ months of transaction history. Complements the per-category
 * rules in insightRules.ts with user-level pattern intelligence.
 *
 * All detection is server-side deterministic (no external AI APIs).
 * Coaching tone is mandatory: encouraging, never shaming.
 */

import { startOfMonth, endOfMonth, subMonths, format, parseISO } from 'date-fns';
import { calculateMean } from './spendingAnalysis';
import type { Category, InsightInsert, InsightMetadata, Transaction } from '@/types/database.types';

// ============================================================================
// TYPES
// ============================================================================

export interface PatternDetectionInput {
  userId: string;
  transactions: Transaction[];
  categories: Category[];
  currentMonth?: Date;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Returns the total expense amount for a category in a given month window.
 */
function categoryTotalForMonth(
  transactions: Transaction[],
  categoryId: string,
  monthStart: Date,
  monthEnd: Date
): number {
  return transactions
    .filter((t) => {
      const d = parseISO(t.date);
      return t.category_id === categoryId && t.type === 'expense' && d >= monthStart && d <= monthEnd;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

// ============================================================================
// ANOMALY DETECTION (Priority 4 — High)
// ============================================================================

/**
 * Detects categories whose current-month total is ≥50% above their
 * 2-month average baseline. Requires at least one transaction in each of
 * the two prior months for a category (guards against false positives from
 * newly-created categories).
 *
 * Returns up to 3 insights sorted by severity (largest % spike first).
 *
 * @example
 * "Your Dining spending ($480) is running 60% above your recent average ($300).
 *  Worth keeping an eye on how this month shapes up."
 */
export function detectSpendingAnomalies(input: PatternDetectionInput): InsightInsert[] {
  const { userId, transactions, categories, currentMonth = new Date() } = input;

  const m0Start = startOfMonth(currentMonth);
  const m0End = endOfMonth(currentMonth);
  const m1Start = startOfMonth(subMonths(currentMonth, 1));
  const m1End = endOfMonth(subMonths(currentMonth, 1));
  const m2Start = startOfMonth(subMonths(currentMonth, 2));
  const m2End = endOfMonth(subMonths(currentMonth, 2));

  const anomalies: Array<{ categoryId: string; categoryName: string; currentTotal: number; baseline: number; pctAbove: number }> = [];

  for (const category of categories) {
    const m0Total = categoryTotalForMonth(transactions, category.id, m0Start, m0End);
    const m1Total = categoryTotalForMonth(transactions, category.id, m1Start, m1End);
    const m2Total = categoryTotalForMonth(transactions, category.id, m2Start, m2End);

    // Require data in BOTH prior months to establish a reliable baseline
    if (m1Total === 0 || m2Total === 0) continue;

    const baseline = calculateMean([m1Total, m2Total]);

    // Noise guard: skip if baseline is too small to be meaningful
    if (baseline < 20) continue;

    const pctAbove = ((m0Total - baseline) / baseline) * 100;

    // Threshold: current month must be ≥50% above 2-month average
    if (pctAbove < 50) continue;

    anomalies.push({ categoryId: category.id, categoryName: category.name, currentTotal: m0Total, baseline, pctAbove });
  }

  // Sort by severity (largest spike first), cap at 3
  anomalies.sort((a, b) => b.pctAbove - a.pctAbove);
  const top = anomalies.slice(0, 3);

  return top.map(({ categoryId, categoryName, currentTotal, baseline, pctAbove }) => {
    const roundedPct = Math.round(pctAbove);
    const roundedBaseline = Math.round(baseline);
    const roundedCurrent = Math.round(currentTotal);
    const currentMonthLabel = format(currentMonth, 'yyyy-MM');

    const metadata: InsightMetadata = {
      category_id: categoryId,
      category_name: categoryName,
      current_amount: roundedCurrent,
      two_month_average: roundedBaseline,
      percent_above_baseline: roundedPct,
      current_month: currentMonthLabel,
    };

    return {
      user_id: userId,
      type: 'spending_anomaly' as const,
      priority: 4,
      title: `${categoryName} spending is ${roundedPct}% above your recent average`,
      description: `Your ${categoryName} spending ($${roundedCurrent}) is running ${roundedPct}% above your recent average ($${roundedBaseline}). Worth keeping an eye on how this month shapes up — no action needed yet!`,
      metadata,
      is_dismissed: false,
    } satisfies InsightInsert;
  });
}

// ============================================================================
// NEW HIGH-SPEND CATEGORY DETECTION (Priority 3 — Medium)
// ============================================================================

/**
 * Detects categories that have newly entered the user's top-3 spenders this
 * month but were not in their historical top-5 over the previous 2 months.
 *
 * Guards against early-month noise: requires ≥5 total transactions in the
 * current month before firing.
 *
 * Returns at most 1 insight (the biggest new entrant by current-month spend).
 *
 * @example
 * "Utilities has jumped into your top spending categories this month — $280 spent
 *  so far. Worth keeping in mind if you have budget targets in mind."
 */
export function detectNewHighSpendCategories(input: PatternDetectionInput): InsightInsert[] {
  const { userId, transactions, categories, currentMonth = new Date() } = input;

  const m0Start = startOfMonth(currentMonth);
  const m0End = endOfMonth(currentMonth);
  const m1End = endOfMonth(subMonths(currentMonth, 1));
  const m2Start = startOfMonth(subMonths(currentMonth, 2));

  // Early-month noise guard: need ≥5 current-month transactions total
  const currentMonthTxCount = transactions.filter((t) => {
    const d = parseISO(t.date);
    return d >= m0Start && d <= m0End;
  }).length;

  if (currentMonthTxCount < 5) return [];

  // Require at least some prior-month data before surfacing "new" entrants
  const hasHistoricalData = transactions.some((t) => {
    const d = parseISO(t.date);
    return d >= m2Start && d < m0Start;
  });

  if (!hasHistoricalData) return [];

  // Compute per-category totals for current month
  const currentTotals = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    total: categoryTotalForMonth(transactions, cat.id, m0Start, m0End),
  }));

  // Top-3 by current spend (only categories with actual spending)
  const currentTop3 = currentTotals
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  if (currentTop3.length === 0) return [];

  // Compute per-category totals for the previous 2 months combined (April start → May end)
  const historicalTotals = categories.map((cat) => ({
    id: cat.id,
    total: categoryTotalForMonth(transactions, cat.id, m2Start, m1End),
  }));

  // Historical top-5 IDs
  const historicalTop5Ids = new Set(
    historicalTotals
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((c) => c.id)
  );

  // New entrants: in current top-3 but not in historical top-5
  const newEntrants = currentTop3.filter((c) => !historicalTop5Ids.has(c.id));

  if (newEntrants.length === 0) return [];

  // Surface the biggest new entrant only (already sorted desc by current spend)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const top = newEntrants[0]!;

  const currentMonthLabel = format(currentMonth, 'yyyy-MM');

  const metadata: InsightMetadata = {
    category_id: top.id,
    category_name: top.name,
    current_amount: Math.round(top.total),
    current_month: currentMonthLabel,
  };

  return [
    {
      user_id: userId,
      type: 'new_high_spend_category' as const,
      priority: 3,
      title: `${top.name} has jumped into your top spending categories`,
      description: `${top.name} has jumped into your top spending categories this month — $${Math.round(top.total)} spent so far. Worth keeping in mind if you have budget targets in this area!`,
      metadata,
      is_dismissed: false,
    } satisfies InsightInsert,
  ];
}
