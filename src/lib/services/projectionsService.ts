/**
 * Projections Service
 * Story 11.4: Annualized Spending Projections
 *
 * Computes annualized spending projections per category based on the last
 * 1–3 complete calendar months of expense data.
 *
 * Architecture compliance:
 * - All functions accept supabase client as parameter (NEVER create their own) — M1 from 11.2
 * - DB errors throw (never silently return empty) — M4 from 11.2
 * - No hardcoded currency — amounts are raw numbers, formatting is UI concern
 * - No ! non-null assertions — optional chaining used throughout
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CategoryProjection, ProjectionsResponse } from '@/types/database.types';

// ============================================================================
// HELPERS
// ============================================================================

/** Format a Date to YYYY-MM-DD for Supabase DATE comparisons (local timezone, not UTC) */
function fmt(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Returns true if the user has at least 1 expense transaction before the current
 * calendar month (i.e., at least 1 complete past month of data exists).
 *
 * @throws on DB error — never silently returns false
 */
export async function hasEnoughDataForProjections(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const now = new Date();
  const currentMonthStart = fmt(new Date(now.getFullYear(), now.getMonth(), 1));

  const { data, error } = await supabase
    .from('transactions')
    .select('date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .lt('date', currentMonthStart)
    .limit(1);

  if (error) throw error;

  return (data?.length ?? 0) > 0;
}

/**
 * Computes annualized spending projections per category.
 *
 * Algorithm:
 * 1. Fetch transactions from last 3 complete calendar months (current period)
 * 2. Fetch transactions from prior 3 complete calendar months (previous period for trend)
 * 3. Aggregate by category; compute monthly avg, annual projection, trend
 * 4. Cross-reference detected_subscriptions to flag recurring categories
 * 5. Sort by annual_projection descending
 */
export async function getAnnualizedProjections(
  supabase: SupabaseClient,
  userId: string
): Promise<ProjectionsResponse> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Current period: up to 3 complete calendar months before current month
  const currentPeriodEnd = new Date(currentYear, currentMonth, 0); // last day of previous month
  const currentPeriodStart = new Date(currentYear, currentMonth - 3, 1); // 3 months back

  // Previous period: 3 months before the current period (for trend)
  const prevPeriodEnd = new Date(currentYear, currentMonth - 3, 0); // last day of month before current period
  const prevPeriodStart = new Date(currentYear, currentMonth - 6, 1); // 6 months back

  // Run both period queries and the subscriptions query in parallel
  const [currentResult, prevResult, subscriptionsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, category_id, date, categories(id, name, color)')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', fmt(currentPeriodStart))
      .lte('date', fmt(currentPeriodEnd))
      .order('date', { ascending: true }),

    supabase
      .from('transactions')
      .select('amount, category_id, date, categories(id, name, color)')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', fmt(prevPeriodStart))
      .lte('date', fmt(prevPeriodEnd))
      .order('date', { ascending: true }),

    supabase
      .from('detected_subscriptions')
      .select('category_id')
      .eq('user_id', userId)
      .in('status', ['active', 'unused']),
  ]);

  if (currentResult.error) throw currentResult.error;
  if (prevResult.error) throw prevResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const currentTxns = currentResult.data ?? [];
  const prevTxns = prevResult.data ?? [];

  // Build set of recurring category IDs
  const recurringCategoryIds = new Set<string>(
    (subscriptionsResult.data ?? []).map((s) => s.category_id).filter(Boolean)
  );

  // Count distinct calendar months in current period data
  const distinctMonths = new Set(currentTxns.map((tx) => tx.date.substring(0, 7)));
  const months_analyzed = Math.max(1, distinctMonths.size);

  // Aggregate current period by category
  type CatAgg = { total: number; count: number; name: string; color: string };
  const currMap = new Map<string, CatAgg>();
  for (const tx of currentTxns) {
    const cat = tx.categories as unknown as { id: string; name: string; color: string } | null;
    if (!cat || !tx.category_id) continue;
    const entry = currMap.get(tx.category_id) ?? {
      total: 0,
      count: 0,
      name: cat.name,
      color: cat.color,
    };
    entry.total += Number(tx.amount);
    entry.count += 1;
    currMap.set(tx.category_id, entry);
  }

  // Aggregate previous period by category (for trend)
  const prevMap = new Map<string, { total: number; count: number }>();
  for (const tx of prevTxns) {
    if (!tx.category_id) continue;
    const entry = prevMap.get(tx.category_id) ?? { total: 0, count: 0 };
    entry.total += Number(tx.amount);
    entry.count += 1;
    prevMap.set(tx.category_id, entry);
  }

  // Count distinct months in previous period for its monthly avg
  const prevDistinctMonths = new Set(prevTxns.map((tx) => tx.date.substring(0, 7)));
  const prevMonthsAnalyzed = Math.max(1, prevDistinctMonths.size);

  // Build projections array
  const projections: CategoryProjection[] = [];
  for (const [catId, { total, count, name, color }] of currMap) {
    const monthly_avg = Math.round((total / months_analyzed) * 100) / 100;
    const annual_projection = Math.round(monthly_avg * 12 * 100) / 100;

    // Compute trend
    let trend: CategoryProjection['trend'] = 'new';
    let trend_percentage: number | null = null;
    const prevEntry = prevMap.get(catId);
    if (prevEntry && prevEntry.total > 0) {
      const prevMonthlyAvg = prevEntry.total / prevMonthsAnalyzed;
      const pct = Math.round(((monthly_avg - prevMonthlyAvg) / prevMonthlyAvg) * 100);
      trend_percentage = pct;
      if (Math.abs(pct) < 5) {
        trend = 'stable';
      } else if (pct > 0) {
        trend = 'up';
      } else {
        trend = 'down';
      }
    }

    projections.push({
      category_id: catId,
      category_name: name,
      category_color: color,
      monthly_avg,
      annual_projection,
      transaction_count: count,
      is_recurring: recurringCategoryIds.has(catId),
      trend,
      trend_percentage,
    });
  }

  // Sort by annual_projection descending
  projections.sort((a, b) => b.annual_projection - a.annual_projection);

  return { projections, hasEnoughData: true, months_analyzed };
}
