/**
 * Re-engagement Push Cron — Story 15.5 (FR32, ADR-018/019)
 *
 * GET /api/cron/reengagement-push — daily. Finds users whose last logging
 * activity was EXACTLY 7 days ago (the streaks row's last_log_date) and sends
 * one warm, no-guilt re-engagement push. Stateless dedup: each absence
 * crosses day-7 exactly once, so no tracking table is needed — scanning for
 * >= 7 would push daily forever.
 *
 * The category gate owns the per-user 'reengagement' toggle (opt-in, default
 * OFF) and quiet hours. The gate never throws, so per-user isolation holds by
 * construction and the returned outcomes are the telemetry.
 *
 * Documented decisions (review 15-5):
 * - Quiet hours SUPPRESS, never defer: a quiet window covering 10:00 UTC
 *   drops that user's one-shot push permanently. Accepted for an opt-in
 *   category; defer/sent-marker design tracked in deferred-work.md. Same
 *   class: a missed cron day skips that day's cohort (equality scan).
 * - Day-key frames are mixed: last_log_date is the USER-LOCAL day (clamped
 *   ±1 by the tx route) while the target key is computed on a UTC server, so
 *   perceived absence spans ~6–8 days across timezones and "awake hours" is
 *   approximate at extreme offsets (UTC±12+). Exactly-once still holds.
 *
 * Schedule: 0 10 * * * (10:00 UTC). Secured with CRON_SECRET.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import { localDayKey } from '@/lib/ai/streakEngine';
import { logger } from '@/lib/utils/logger';
import {
  getAlreadyDeliveredByPeriod,
  markDelivered,
} from '@/lib/services/notificationDeliveryService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Re-engagement fires for users inactive 7-10 days.
 *
 * A RANGE rather than an exact day because Vercel Hobby permits one cron run
 * per day: widening the window is the only way to get a second attempt if a
 * run is missed. The per-episode marker keeps it to one push per episode.
 */
const REENGAGEMENT_WINDOW_START_DAYS = 7;
const REENGAGEMENT_WINDOW_END_DAYS = 10;

const PAGE_SIZE = 500;
// Safety valve, not an expected ceiling. If ever hit, the remainder of that
// day's cohort is skipped for good (equality scan never retries) — the warn
// below is the signal to raise the cap or shard the scan.
const MAX_USERS = 5000;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify cron secret (timing-safe — generate-insights shape)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    const cronSecret = process.env.CRON_SECRET ?? '';

    const isAuthorized =
      token.length > 0 &&
      cronSecret.length > 0 &&
      token.length === cronSecret.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));

    if (!isAuthorized) {
      logger.error('ReengagementPushCron', 'Unauthorized access attempt');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Users whose last log falls in the re-engagement WINDOW.
    //
    // This was `.eq(last_log_date, exactly 7 days ago)` — a single instant
    // matched against a single day. If the cron run was missed (deploy,
    // incident, platform blip) that day's cohort was skipped PERMANENTLY,
    // because the next run matched a different day.
    //
    // A range makes a missed run recoverable: someone who became eligible on
    // day 7 is still a candidate on days 8-10. The per-EPISODE marker below is
    // what stops that turning into four pushes.
    //
    // Vercel Hobby allows one cron run per day, so widening the window is the
    // only way to get more than one attempt — running hourly is not available.
    const dayKeyOffset = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return localDayKey(d);
    };
    // Inclusive bounds, oldest first: [today-10 .. today-7].
    const windowOldest = dayKeyOffset(REENGAGEMENT_WINDOW_END_DAYS);
    const windowNewest = dayKeyOffset(REENGAGEMENT_WINDOW_START_DAYS);

    const supabase = createServiceRoleClient() as unknown as SupabaseClient;
    const users: Array<{ user_id: string; last_log_date: string }> = [];
    for (let from = 0; from < MAX_USERS; from += PAGE_SIZE) {
      const { data: rows, error } = await supabase
        .from('streaks')
        // `last_log_date` identifies the inactivity EPISODE, and becomes the
        // period key — so one push per episode, not one per day in the window.
        .select('user_id, last_log_date')
        .gte('last_log_date', windowOldest)
        .lte('last_log_date', windowNewest)
        .order('user_id')
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logger.error('ReengagementPushCron', `streaks scan failed: ${error.message}`);
        return NextResponse.json({ success: false, error: 'Scan failed' }, { status: 500 });
      }

      const page = (rows ?? []) as Array<{ user_id: string; last_log_date: string }>;
      users.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    if (users.length >= MAX_USERS) {
      logger.warn(
        'ReengagementPushCron',
        `day-7 cohort hit the ${MAX_USERS} cap — remainder permanently skipped`
      );
    }

    // 3. DW-4: skip anyone already served for this period.
    //
    // This job now runs HOURLY rather than once at 10:00 UTC. A daily run could
    // never recover a deferral: the next attempt landed at the same hour, so a
    // user whose quiet window covered 10:00 was deferred forever — which is
    // indistinguishable from the suppression it replaced. Scanning every hour
    // with a marker is what actually delivers once their quiet window ends.
    //
    // The period key also gives expiry for free: it is today's day key, so a
    // notification that never became sendable simply stops being offered when
    // the day rolls over, rather than arriving late describing a stale day.
    // The period is the user's inactivity EPISODE (their last_log_date), not
    // today — otherwise a four-day window would push them four times.
    let alreadyDelivered: Set<string>;
    try {
      alreadyDelivered = await getAlreadyDeliveredByPeriod(
        supabase,
        'reengagement',
        users.map((u) => ({ userId: u.user_id, periodKey: u.last_log_date }))
      );
    } catch {
      // Fail closed — see getAlreadyDelivered. The next hourly run retries.
      return NextResponse.json(
        { success: false, error: 'Delivery lookup failed' },
        { status: 500 }
      );
    }

    const pending = users.filter(
      (u) => !alreadyDelivered.has(`${u.user_id}:${u.last_log_date}`)
    );

    // 4. Dispatch through the gate (opt-in toggle + quiet hours enforced
    //    there). The gate never throws — outcomes are the honest telemetry.
    const outcomes = await Promise.all(
      pending.map(async (row) => {
        const outcome = await dispatchCategorizedPush(row.user_id, 'reengagement', {
          type: 'comeback',
          title: 'Your streak is waiting',
          body: "We saved your progress — log a transaction to pick up where you left off.",
          data: { url: '/dashboard' },
        });

        // Only a real send is recorded. A DEFERRED user must stay eligible so
        // the next hourly run can reach them once quiet hours are over — that
        // is the entire mechanism. 'suppressed' (opted out) is also left
        // unmarked; it costs one cheap gate check per hour and keeps the marker
        // meaning exactly "this user was served".
        if (outcome === 'sent') {
          await markDelivered(supabase, 'reengagement', row.last_log_date, row.user_id);
        }
        return outcome;
      })
    );
    const sent = outcomes.filter((o) => o === 'sent').length;
    const suppressed = outcomes.filter((o) => o === 'suppressed').length;
    const deferred = outcomes.filter((o) => o === 'deferred').length;
    const failed = outcomes.filter((o) => o === 'failed').length;

    const elapsedMs = Date.now() - startTime;
    logger.info(
      'ReengagementPushCron',
      `Completed: ${users.length} day-7 users, ${pending.length} pending, ` +
        `${sent} sent, ${deferred} deferred (quiet hours - retried next run), ` +
        `${suppressed} suppressed, ${failed} failed, ${elapsedMs}ms`
    );

    return NextResponse.json({
      success: true,
      usersFound: users.length,
      pending: pending.length,
      sent,
      deferred,
      suppressed,
      failed,
    });
  } catch (error) {
    logger.error('ReengagementPushCron', 'Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
