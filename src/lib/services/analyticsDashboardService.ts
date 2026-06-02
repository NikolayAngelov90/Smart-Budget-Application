/**
 * Analytics Dashboard Service
 * Story 12.8: Engagement Analytics Dashboard
 *
 * - isAnalyticsViewer: role check via the user-scoped client (RLS-safe).
 * - getAnalyticsDashboard: cross-user aggregation via the service-role client
 *   (only call AFTER the role check passes).
 *
 * Accepts the Supabase client as a parameter (service-layer pattern).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateAnalytics, type AnalyticsEventRow } from '@/lib/analytics/aggregateAnalytics';
import { toLocalISODate } from '@/lib/utils/date';
import type { AnalyticsDashboardData } from '@/types/database.types';

/** Returns true if the user has the analytics_viewer role. */
export async function isAnalyticsViewer(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('analytics_viewer')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.analytics_viewer === true;
}

/**
 * Aggregates engagement analytics across all users for the given range.
 * MUST be called with a service-role client and only after the role check.
 */
export async function getAnalyticsDashboard(
  serviceClient: SupabaseClient,
  rangeDays: number,
  today: Date = new Date()
): Promise<AnalyticsDashboardData> {
  const since = toLocalISODate(new Date(today.getTime() - rangeDays * 24 * 60 * 60 * 1000));

  const { data, error } = await serviceClient
    .from('analytics_events')
    .select('user_id, event_name, event_properties, timestamp')
    .gte('timestamp', since);

  if (error) throw error;

  return aggregateAnalytics((data ?? []) as AnalyticsEventRow[], rangeDays);
}
