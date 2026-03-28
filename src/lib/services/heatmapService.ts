/**
 * Heatmap Service
 * Story 11.3: Spending Heatmap
 *
 * Aggregates daily expense spending for heatmap visualization.
 * All functions accept a Supabase client to enforce RLS (per code review M1 pattern from Story 11.2).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailySpendingEntry, IntensityLevel } from '@/types/database.types';

/**
 * Fetches and aggregates daily expense spending for a given month.
 *
 * @param supabase - User-scoped Supabase client (required for RLS enforcement)
 * @param userId - The user's ID
 * @param year - The year (e.g., 2026)
 * @param month - The month (1-12)
 * @returns Array of daily spending entries sorted by date ascending
 */
export async function getDailySpending(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number
): Promise<DailySpendingEntry[]> {
  const paddedMonth = String(month).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = `${year}-${paddedMonth}-01`;
  const lastDay = `${year}-${paddedMonth}-${String(daysInMonth).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Aggregate by date in JavaScript
  const dayMap = new Map<string, { total: number; count: number }>();
  for (const tx of data) {
    const dateKey = tx.date as string;
    const amount = Number(tx.amount);
    const existing = dayMap.get(dateKey);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      dayMap.set(dateKey, { total: amount, count: 1 });
    }
  }

  // Sort by date and round totals to avoid floating-point drift
  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, count }]) => ({
      date,
      total: Math.round(total * 100) / 100,
      count,
    }));
}

/**
 * Checks if a user has enough transaction data to show the heatmap.
 * Returns true if the user has at least 7 distinct dates with expense transactions.
 *
 * @param supabase - User-scoped Supabase client (required for RLS enforcement)
 * @param userId - The user's ID
 */
export async function hasEnoughDataForHeatmap(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('transactions')
    .select('date')
    .eq('user_id', userId)
    .eq('type', 'expense');

  if (error) throw error;
  if (!data) return false;

  const distinctDates = new Set(data.map((tx) => tx.date as string));
  return distinctDates.size >= 7;
}

/**
 * Determines the color intensity level (0-4) for a given spending amount
 * relative to the month's maximum daily spend.
 *
 * @param amount - The amount to evaluate
 * @param maxAmount - The maximum daily spend in the period
 * @returns IntensityLevel: 0 = no spending, 4 = highest spending
 */
export function getIntensityLevel(amount: number, maxAmount: number): IntensityLevel {
  if (amount === 0 || maxAmount === 0) return 0;
  const ratio = amount / maxAmount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}
