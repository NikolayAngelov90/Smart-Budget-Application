/**
 * Household Insight Service
 * Story 13.10: Household-Level AI Insights
 *
 * Computes household-level insights on demand: pulls membership-gated per-category totals
 * for the current and previous month (private excluded by the RPC), then runs the pure
 * householdInsightEngine. Nothing is persisted.
 */

import { startOfMonth, subMonths, addDays, min as minDate, format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { generateHouseholdInsights } from '@/lib/ai/householdInsightEngine';
import { logger } from '@/lib/utils/logger';
import { DEFAULT_CURRENCY } from '@/lib/utils/constants';
import type { HouseholdInsight, HouseholdPeriodTotal } from '@/types/database.types';

function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/**
 * Returns household insights for the caller's household (empty if none / no meaningful change).
 */
export async function getHouseholdInsights(userId: string, now: Date = new Date()): Promise<HouseholdInsight[]> {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();
  const householdId = membership?.household_id ?? null;
  if (!householdId) return [];

  // Compare EQUAL-LENGTH windows: current month-to-date vs the previous month's same span.
  // (Comparing MTD to the full previous month would bias every category toward "less"
  // early in the month.) `dayOfMonth` is the number of elapsed days incl. today.
  const curStart = startOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const dayOfMonth = now.getDate();
  const curEnd = addDays(curStart, dayOfMonth); // half-open, includes today
  // Cap the previous window at the previous month end (handles shorter prior months).
  const prevEnd = minDate([addDays(prevStart, dayOfMonth), curStart]);

  const [currentRes, previousRes] = await Promise.all([
    supabase.rpc('household_category_period_totals', {
      p_household_id: householdId,
      p_start: isoDate(curStart),
      p_end: isoDate(curEnd),
    }),
    supabase.rpc('household_category_period_totals', {
      p_household_id: householdId,
      p_start: isoDate(prevStart),
      p_end: isoDate(prevEnd),
    }),
  ]);

  if (currentRes.error || previousRes.error) {
    logger.error('HouseholdInsightService', `period totals RPC failed: ${currentRes.error?.message ?? previousRes.error?.message}`);
    throw new Error('Failed to load household spending');
  }

  const { data: profile } = await supabase.from('user_profiles').select('preferences').eq('id', userId).maybeSingle();
  const prefs = (profile?.preferences ?? {}) as { currency_format?: unknown };
  const currency = typeof prefs.currency_format === 'string' ? prefs.currency_format : DEFAULT_CURRENCY;

  return generateHouseholdInsights({
    currency,
    current: (currentRes.data ?? []) as HouseholdPeriodTotal[],
    previous: (previousRes.data ?? []) as HouseholdPeriodTotal[],
  });
}
