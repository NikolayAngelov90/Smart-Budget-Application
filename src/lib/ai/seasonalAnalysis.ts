/**
 * Seasonal Analysis Engine
 *
 * Pure computation module for seasonal & cyclical spending awareness
 * (Story 12.5 / FR6). Detects months whose spend is materially above the
 * user's typical monthly spend and projects the next 6 months from the same
 * month-of-year in history.
 *
 * No Supabase, no side effects — pure input → output.
 */

import { calculateMean } from './spendingAnalysis';
import type { SeasonalMonth, Transaction } from '@/types/database.types';

export interface SeasonalAnalysisInput {
  /** Expense-only transactions, up to ~13 months of history */
  transactions: Transaction[];
  today: Date;
}

export interface SeasonalAnalysisResult {
  timeline: SeasonalMonth[];
  baseline_monthly: number;
  months_analyzed: number;
  hasEnoughData: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const MIN_MONTHS = 6;
const TIMELINE_LENGTH = 6;
const SEASONAL_HIGH_MULTIPLIER = 1.25;

/**
 * Analyzes monthly spending history and predicts the next 6 months,
 * flagging months that were historically elevated (seasonal highs).
 */
export function analyzeSeasonalPatterns(input: SeasonalAnalysisInput): SeasonalAnalysisResult {
  const { transactions, today } = input;

  // Group expense spend by calendar month (YYYY-MM)
  const monthlyTotals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const key = tx.date.substring(0, 7);
    monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + tx.amount);
  }

  const monthsAnalyzed = monthlyTotals.size;
  const baselineMonthly = round2(calculateMean(Array.from(monthlyTotals.values())));
  const hasEnoughData = monthsAnalyzed >= MIN_MONTHS;

  if (!hasEnoughData) {
    return { timeline: [], baseline_monthly: baselineMonthly, months_analyzed: monthsAnalyzed, hasEnoughData: false };
  }

  // Build a month-of-year lookup (1-12 → latest matching {key,total})
  const monthOfYearLookup = new Map<number, { key: string; total: number }>();
  for (const [key, total] of monthlyTotals) {
    const monthIndex = Number(key.substring(5, 7)); // 'YYYY-MM' → MM
    const existing = monthOfYearLookup.get(monthIndex);
    // Prefer the most recent occurrence (lexicographically greatest key)
    if (!existing || key > existing.key) {
      monthOfYearLookup.set(monthIndex, { key, total });
    }
  }

  const timeline: SeasonalMonth[] = [];
  const baseYear = today.getFullYear();
  const baseMonth = today.getMonth(); // 0-11

  for (let i = 1; i <= TIMELINE_LENGTH; i++) {
    const d = new Date(baseYear, baseMonth + i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthIndex = d.getMonth() + 1;
    const basis = monthOfYearLookup.get(monthIndex) ?? null;
    const predicted = round2(basis?.total ?? 0);
    const isSeasonalHigh = baselineMonthly > 0 && predicted >= baselineMonthly * SEASONAL_HIGH_MULTIPLIER;

    timeline.push({
      month: monthKey,
      month_label: monthKey,
      month_index: monthIndex,
      predicted_amount: predicted,
      is_seasonal_high: isSeasonalHigh,
      historical_basis: basis?.key ?? null,
    });
  }

  return { timeline, baseline_monthly: baselineMonthly, months_analyzed: monthsAnalyzed, hasEnoughData: true };
}
