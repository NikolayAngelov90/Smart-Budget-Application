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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // 2. Users whose last log was exactly 7 days ago (paginated — a bare
    //    .limit() would silently truncate the cohort)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const targetDayKey = localDayKey(sevenDaysAgo);

    const supabase = createServiceRoleClient() as unknown as SupabaseClient;
    const users: Array<{ user_id: string }> = [];
    for (let from = 0; from < MAX_USERS; from += PAGE_SIZE) {
      const { data: rows, error } = await supabase
        .from('streaks')
        .select('user_id')
        .eq('last_log_date', targetDayKey)
        .order('user_id')
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logger.error('ReengagementPushCron', `streaks scan failed: ${error.message}`);
        return NextResponse.json({ success: false, error: 'Scan failed' }, { status: 500 });
      }

      const page = (rows ?? []) as Array<{ user_id: string }>;
      users.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    if (users.length >= MAX_USERS) {
      logger.warn(
        'ReengagementPushCron',
        `day-7 cohort hit the ${MAX_USERS} cap — remainder permanently skipped`
      );
    }

    // 3. Dispatch through the gate (opt-in toggle + quiet hours enforced
    //    there). The gate never throws — outcomes are the honest telemetry.
    const outcomes = await Promise.all(
      users.map((row) =>
        dispatchCategorizedPush(row.user_id, 'reengagement', {
          type: 'comeback',
          title: 'Your streak is waiting',
          body: "We saved your progress — log a transaction to pick up where you left off.",
          data: { url: '/dashboard' },
        })
      )
    );
    const sent = outcomes.filter((o) => o === 'sent').length;
    const suppressed = outcomes.filter((o) => o === 'suppressed').length;
    const failed = outcomes.filter((o) => o === 'failed').length;

    const elapsedMs = Date.now() - startTime;
    logger.info(
      'ReengagementPushCron',
      `Completed: ${users.length} day-7 users, ${sent} sent, ${suppressed} suppressed, ${failed} failed, ${elapsedMs}ms`
    );

    return NextResponse.json({
      success: true,
      usersFound: users.length,
      sent,
      suppressed,
      failed,
    });
  } catch (error) {
    logger.error('ReengagementPushCron', 'Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
