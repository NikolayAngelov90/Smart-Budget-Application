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
 * OFF) and quiet hours. Per-user failures never abort the batch.
 *
 * Schedule: 0 10 * * * (10:00 UTC — awake hours). Secured with CRON_SECRET.
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

    // 2. Users whose last log was exactly 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const targetDayKey = localDayKey(sevenDaysAgo);

    const supabase = createServiceRoleClient() as unknown as SupabaseClient;
    const { data: rows, error } = await supabase
      .from('streaks')
      .select('user_id')
      .eq('last_log_date', targetDayKey)
      .limit(500);

    if (error) {
      logger.error('ReengagementPushCron', `streaks scan failed: ${error.message}`);
      return NextResponse.json({ success: false, error: 'Scan failed' }, { status: 500 });
    }

    const users = (rows ?? []) as Array<{ user_id: string }>;

    // 3. Dispatch through the gate (opt-in toggle + quiet hours enforced there).
    //    allSettled: one user's failure never aborts the batch.
    let dispatched = 0;
    const results = await Promise.allSettled(
      users.map(async (row) => {
        await dispatchCategorizedPush(row.user_id, 'reengagement', {
          type: 'comeback',
          title: 'Your streak is waiting',
          body: "We saved your progress — log a transaction to pick up where you left off.",
          data: { url: '/dashboard' },
        });
        dispatched++;
      })
    );
    const errors = results.filter((r) => r.status === 'rejected').length;

    const elapsedMs = Date.now() - startTime;
    logger.info(
      'ReengagementPushCron',
      `Completed: ${users.length} day-7 users, ${dispatched} dispatched, ${errors} errors, ${elapsedMs}ms`
    );

    return NextResponse.json({
      success: true,
      usersFound: users.length,
      dispatched,
      errors,
    });
  } catch (error) {
    logger.error('ReengagementPushCron', 'Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
