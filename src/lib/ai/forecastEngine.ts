/**
 * Forecast Engine
 *
 * Pure computation module for end-of-month spending projections.
 * Extrapolates current daily spending rate to project full-month totals
 * and flags categories whose trajectory exceeds their 3-month historical average.
 *
 * No Supabase, no side effects — pure input → output.
 */

import { endOfMonth } from 'date-fns';
import { calculateMean } from './spendingAnalysis';
import type { Category, CategoryForecast, Transaction } from '@/types/database.types';

export interface ForecastEngineInput {
  /** Expense-only transactions for the current calendar month */
  currentMonthTransactions: Transaction[];
  /** Expense-only transactions for the prior 3 calendar months */
  historicalTransactions: Transaction[];
  categories: Category[];
  today: Date;
}

/**
 * Computes end-of-month spending forecasts per category.
 *
 * Algorithm:
 *   dailyRate    = spentSoFar / daysElapsed
 *   projectedEOM = spentSoFar + (dailyRate × daysRemaining)
 *   isAtRisk     = projectedEOM > historicalAvg (and historicalAvg > 0)
 *
 * Returns categories sorted: at-risk first, then by projected_eom descending.
 * Categories with zero current-month spending are excluded.
 */
export function computeEndOfMonthForecasts(input: ForecastEngineInput): CategoryForecast[] {
  const { currentMonthTransactions, historicalTransactions, categories, today } = input;

  const daysElapsed = today.getDate();
  const daysInMonth = endOfMonth(today).getDate();
  const daysRemaining = daysInMonth - daysElapsed;

  if (daysElapsed === 0 || currentMonthTransactions.length === 0) return [];

  // Aggregate current-month spend per category
  const currentSpendMap = new Map<string, number>();
  for (const tx of currentMonthTransactions) {
    if (tx.type !== 'expense') continue;
    currentSpendMap.set(tx.category_id, (currentSpendMap.get(tx.category_id) ?? 0) + tx.amount);
  }

  // Aggregate historical spend per category per calendar month
  // Structure: categoryId → Map<'YYYY-MM', number>
  const historicalMonthMap = new Map<string, Map<string, number>>();
  for (const tx of historicalTransactions) {
    if (tx.type !== 'expense') continue;
    const monthKey = tx.date.substring(0, 7);
    if (!historicalMonthMap.has(tx.category_id)) {
      historicalMonthMap.set(tx.category_id, new Map());
    }
    const monthlyMap = historicalMonthMap.get(tx.category_id)!;
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + tx.amount);
  }

  const forecasts: CategoryForecast[] = [];

  for (const category of categories) {
    const spentSoFar = currentSpendMap.get(category.id) ?? 0;
    if (spentSoFar === 0) continue;

    const dailyRate = spentSoFar / daysElapsed;
    const projectedEom = Math.round((spentSoFar + dailyRate * daysRemaining) * 100) / 100;

    // Historical monthly totals for this category
    const monthlyTotals = Array.from(historicalMonthMap.get(category.id)?.values() ?? []);
    const historicalAvg = Math.round(calculateMean(monthlyTotals) * 100) / 100;

    const isAtRisk = historicalAvg > 0 && projectedEom > historicalAvg;

    forecasts.push({
      category_id: category.id,
      category_name: category.name,
      category_color: category.color,
      spent_so_far: Math.round(spentSoFar * 100) / 100,
      projected_eom: projectedEom,
      historical_avg: historicalAvg,
      is_at_risk: isAtRisk,
      days_elapsed: daysElapsed,
      days_in_month: daysInMonth,
    });
  }

  // Sort: at-risk first, then by projected_eom descending
  forecasts.sort((a, b) => {
    if (a.is_at_risk !== b.is_at_risk) return a.is_at_risk ? -1 : 1;
    return b.projected_eom - a.projected_eom;
  });

  return forecasts;
}
