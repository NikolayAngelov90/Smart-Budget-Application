/**
 * Deferred notification bookkeeping — DW-4.
 *
 * The crons used to match their cohort at ONE instant: "whose last log was
 * exactly 7 days ago", fired at 10:00 UTC. Anyone in quiet hours at that moment
 * was suppressed and never revisited, and a missed run skipped its whole cohort
 * permanently.
 *
 * With a marker per (user, kind, period) the cron can instead scan repeatedly
 * and ask "who is owed this period and has not been served yet?" — which makes
 * a rerun safe, a deferral recoverable, and a missed run self-healing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { toLocalISODate } from '@/lib/utils/date';

export type NotificationKind = 'reengagement' | 'weekly_digest';

/**
 * The period a delivery satisfies. Comparing period KEYS rather than timestamps
 * is what makes reruns idempotent and expiry trivial: once the key moves on,
 * the old one is simply never asked about again.
 */
export function dayPeriodKey(now: Date = new Date()): string {
  return toLocalISODate(now);
}

/** ISO week key, e.g. `2026-W31`. Matches the weekly digest's cadence. */
export function weekPeriodKey(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  // ISO weeks run Monday-Sunday and belong to the year containing their Thursday.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Users already served for this kind+period, so the caller can skip them.
 *
 * Read in one query rather than per user: a cohort scan runs every hour now, and
 * a per-user round trip would dominate the job.
 */
export async function getAlreadyDelivered(
  supabase: SupabaseClient,
  kind: NotificationKind,
  periodKey: string,
  userIds: string[]
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('notification_deliveries')
    .select('user_id')
    .eq('kind', kind)
    .eq('period_key', periodKey)
    .in('user_id', userIds);

  if (error) {
    // Fail CLOSED. If we cannot tell who has already been served, sending would
    // risk duplicates for the whole cohort; skipping means they are picked up on
    // the next hourly run, which is the point of the scan window.
    logger.error(
      'NotificationDelivery',
      `delivery lookup failed for ${kind}/${periodKey}: ${error.message}`
    );
    throw new Error('delivery lookup failed');
  }

  return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
}

/**
 * Record that a user has been served. Service-role only — a client able to
 * write here could forge an "already sent" marker and silently suppress its own
 * notifications, which is why the table is SELECT-only under RLS.
 *
 * Conflicts are ignored rather than raised: two runs racing the same user is
 * expected under a scan window, and the unique constraint is what settles it.
 */
export async function markDelivered(
  supabase: SupabaseClient,
  kind: NotificationKind,
  periodKey: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('notification_deliveries')
    .upsert(
      { user_id: userId, kind, period_key: periodKey },
      { onConflict: 'user_id,kind,period_key', ignoreDuplicates: true }
    );

  if (error) {
    // Non-fatal: the push already went out. A missing marker risks ONE duplicate
    // on the next run, which is a far better failure than throwing away a
    // successful send.
    logger.warn(
      'NotificationDelivery',
      `could not mark ${kind}/${periodKey} for ${userId}: ${error.message}`
    );
  }
}
