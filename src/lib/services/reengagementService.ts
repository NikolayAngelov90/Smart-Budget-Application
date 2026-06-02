/**
 * Re-engagement Service
 * Story 12.6 / FR8: Lapsed User Re-engagement Analysis
 *
 * Determines whether a returning user has lapsed (14+ days since last logging)
 * and, if so, assembles the welcome-back summary. Accepts the Supabase client
 * as a parameter (service-layer pattern). DB errors throw.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildReengagementSummary } from '@/lib/ai/reengagementAnalysis';
import { toLocalISODate } from '@/lib/utils/date';
import type {
  DetectedSubscription,
  Goal,
  ReengagementSummary,
  Transaction,
} from '@/types/database.types';
import type { UserPreferences } from '@/types/user.types';

const LAPSE_THRESHOLD_DAYS = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Returns the welcome-back summary for a returning lapsed user, or null when
 * the user is active, brand-new, or has already dismissed the current lapse.
 */
export async function getReengagementSummary(
  supabase: SupabaseClient,
  userId: string,
  prefs: Partial<UserPreferences> | null,
  today: Date = new Date()
): Promise<ReengagementSummary | null> {
  // Last logging activity
  const { data: lastTx, error: lastTxError } = await supabase
    .from('transactions')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastTxError) throw lastTxError;
  if (!lastTx) return null; // brand-new user — never lapsed

  const lastActivityDate = new Date(lastTx.created_at);
  const lapsedDays = Math.floor((today.getTime() - lastActivityDate.getTime()) / MS_PER_DAY);
  if (lapsedDays < LAPSE_THRESHOLD_DAYS) return null;

  // Dismissal: suppress when dismissed at or after the last activity (current lapse)
  const dismissedAt = prefs?.reengagement_dismissed_at;
  if (dismissedAt && new Date(dismissedAt).getTime() >= lastActivityDate.getTime()) {
    return null;
  }

  // Gather data in parallel
  const sixMonthsAgo = toLocalISODate(new Date(today.getFullYear(), today.getMonth() - 6, 1));

  const [historyResult, subsResult, goalsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', sixMonthsAgo),
    supabase
      .from('detected_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'kept']),
    supabase.from('goals').select('*').eq('user_id', userId),
  ]);

  if (historyResult.error) throw historyResult.error;
  if (subsResult.error) throw subsResult.error;
  if (goalsResult.error) throw goalsResult.error;

  return buildReengagementSummary({
    lastActivityDate,
    today,
    historicalTransactions: (historyResult.data ?? []) as Transaction[],
    subscriptions: (subsResult.data ?? []) as DetectedSubscription[],
    goals: (goalsResult.data ?? []) as Goal[],
  });
}
