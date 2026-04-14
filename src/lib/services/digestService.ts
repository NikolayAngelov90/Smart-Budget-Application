/**
 * Digest Service
 * Story 11.7: Weekly Financial Digest
 *
 * Core computation logic for generating weekly financial digests.
 * generateDigestForUser — called from cron route (service-role client)
 * getLatestDigest — called from API route (user-scoped client)
 */

import { endOfWeek, subWeeks, format } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { DigestTopCategory, Json, WeeklyDigest } from '@/types/database.types';

// ============================================================================
// HELPERS
// ============================================================================

function formatAmount(amount: number, currency: string): string {
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Build a human-readable actionable highlight string.
 * Accepts the pre-computed changePct (from generateDigestForUser) so the
 * prevTotal=0 edge case is already handled correctly (changePct = 100, not 0).
 * Exported for unit testing.
 */
export function buildHighlight(
  total: number,
  changePct: number,
  topCats: DigestTopCategory[],
  currency: string
): string {
  if (changePct > 15) {
    return `Your spending increased by ${Math.round(changePct)}% — check your ${topCats[0]?.name ?? 'top'} category.`;
  }
  if (changePct < -15) {
    return `Great job! Spending dropped ${Math.round(Math.abs(changePct))}% vs last week.`;
  }
  if (topCats[0] && total > 0 && topCats[0].total / total > 0.5) {
    return `${topCats[0].name} made up over 50% of your spending this week.`;
  }
  return `You spent ${formatAmount(total, currency)} this week across ${topCats.length} categories.`;
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

interface TransactionRow {
  amount: number;
  category_id: string;
  // Supabase returns joined table as object (singular FK) — may be typed as array internally
  categories: { name: string; color: string } | { name: string; color: string }[] | null;
}

async function fetchWeekSpending(
  supabase: SupabaseClient,
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, category_id, categories(name, color)')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', format(weekStart, 'yyyy-MM-dd'))
    .lte('date', format(weekEnd, 'yyyy-MM-dd'));

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TransactionRow[];
}

function aggregateByCategory(rows: TransactionRow[]): DigestTopCategory[] {
  const map = new Map<string, DigestTopCategory>();
  for (const row of rows) {
    // Normalise the join result: Supabase may return object or array
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    const existing = map.get(row.category_id);
    if (existing) {
      existing.total += row.amount;
    } else {
      map.set(row.category_id, {
        category_id: row.category_id,
        name: cat?.name ?? 'Unknown',
        color: cat?.color ?? '#A0AEC0',
        total: row.amount,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate (or upsert) a digest for a user for the given week.
 * Uses service-role client internally — only call from cron routes.
 */
export async function generateDigestForUser(
  userId: string,
  weekStart: Date,
  // eslint-disable-next-line no-restricted-syntax
  currency = 'EUR'
): Promise<void> {
  const supabase = createServiceRoleClient();

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const prevWeekStart = subWeeks(weekStart, 1);
  const prevWeekEnd = subWeeks(weekEnd, 1);

  const [currentRows, prevRows] = await Promise.all([
    fetchWeekSpending(supabase, userId, weekStart, weekEnd),
    fetchWeekSpending(supabase, userId, prevWeekStart, prevWeekEnd),
  ]);

  const total = currentRows.reduce((sum, r) => sum + r.amount, 0);
  const prevTotal = prevRows.reduce((sum, r) => sum + r.amount, 0);

  const allCategories = aggregateByCategory(currentRows);
  const topCategories = allCategories.slice(0, 3);

  // AC-5 from story: when prevTotal=0 and total>0, use 100 as bounded pct
  let spendingChangePct: number;
  if (prevTotal === 0) {
    spendingChangePct = total > 0 ? 100 : 0;
  } else {
    spendingChangePct = ((total - prevTotal) / prevTotal) * 100;
  }

  const actionableHighlight = buildHighlight(total, spendingChangePct, topCategories, currency);

  const payload = {
    user_id: userId,
    week_start: format(weekStart, 'yyyy-MM-dd'),
    week_end: format(weekEnd, 'yyyy-MM-dd'),
    total_spending: total,
    previous_week_spending: prevTotal,
    spending_change_pct: spendingChangePct,
    top_categories: topCategories as unknown as Json,
    actionable_highlight: actionableHighlight,
    currency,
    generated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('weekly_digests')
    .upsert(payload, { onConflict: 'user_id,week_start' });

  if (error) {
    logger.error('DigestService', `Failed to upsert digest for user ${userId}: ${error.message}`);
    throw new Error(error.message);
  }

  logger.info('DigestService', `Digest upserted for user ${userId} week ${payload.week_start}`);
}

/**
 * Fetch the most recent digest for a user.
 * Returns null if no digest exists yet (progressive disclosure).
 * Accepts a user-scoped Supabase client (called from API route).
 */
export async function getLatestDigest(
  supabase: SupabaseClient,
  userId: string
): Promise<WeeklyDigest | null> {
  const { data, error } = await supabase
    .from('weekly_digests')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  // .maybeSingle() returns { data: null, error: null } for "no rows" (not PGRST116).
  // The PGRST116 guard is belt-and-suspenders in case the client behaviour changes.
  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  return (data as WeeklyDigest | null) ?? null;
}
