/**
 * Vercel Cron Job Endpoint — Weekly Digest Generation
 *
 * GET /api/cron/weekly-digest
 *
 * Scheduled to run weekly (Monday 08:00 UTC, configured in vercel.json)
 * Generates a financial digest for each eligible user for the previous week.
 *
 * Authentication: Requires CRON_SECRET environment variable via Authorization header
 *
 * Story 11.7: Weekly Financial Digest (ADR-019)
 * AC1: Digest generated per eligible user every Monday for the previous week
 * AC4: Upsert ensures idempotency if cron runs twice
 * AC5: Users with weekly_digest_enabled = false are skipped
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { startOfWeek, subWeeks } from 'date-fns';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateDigestForUser } from '@/lib/services/digestService';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify cron secret using timing-safe comparison
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    const cronSecret = process.env.CRON_SECRET ?? '';

    const isAuthorized =
      token.length > 0 &&
      cronSecret.length > 0 &&
      token.length === cronSecret.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));

    if (!isAuthorized) {
      logger.error('WeeklyDigestCron', 'Unauthorized access attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('WeeklyDigestCron', 'Starting weekly digest generation');

    // 2. Compute the previous week's Monday (week_start)
    const now = new Date();
    const prevWeek = subWeeks(now, 1);
    const weekStart = startOfWeek(prevWeek, { weekStartsOn: 1 });

    // 3. Query all user profiles including preferences
    const supabase = createServiceRoleClient();
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, preferences')
      .limit(1000);

    if (usersError) {
      logger.error('WeeklyDigestCron', 'Error querying users:', usersError);
      throw new Error(usersError.message);
    }

    const usersToProcess = users ?? [];

    if (usersToProcess.length === 0) {
      logger.info('WeeklyDigestCron', 'No users found to process');
      return NextResponse.json(
        {
          success: true,
          usersProcessed: 0,
          digestsGenerated: 0,
          errors: [],
          elapsedMs: Date.now() - startTime,
        },
        { status: 200 }
      );
    }

    // 4. Process in batches of 20
    let usersProcessed = 0;
    let digestsGenerated = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    const batchSize = 20;
    for (let i = 0; i < usersToProcess.length; i += batchSize) {
      const batch = usersToProcess.slice(i, i + batchSize);

      const batchPromises = batch.map(async (user) => {
        try {
          usersProcessed++;

          // AC5: Skip users who have opted out
          const prefs = (user.preferences as Record<string, unknown>) ?? {};
          const digestEnabled = prefs.weekly_digest_enabled !== false;
          if (!digestEnabled) {
            logger.info('WeeklyDigestCron', `Skipping user ${user.id} (digest disabled)`);
            return;
          }

          // Pass the user's currency preference so digest amounts match their settings
          // eslint-disable-next-line no-restricted-syntax
          const currency = typeof prefs.currency_format === 'string' ? prefs.currency_format : 'EUR';
          await generateDigestForUser(user.id, weekStart, currency);
          digestsGenerated++;

          logger.info('WeeklyDigestCron', `Digest generated for user ${user.id}`);
        } catch (error) {
          logger.error('WeeklyDigestCron', `Error for user ${user.id}:`, error);
          errors.push({
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      await Promise.all(batchPromises);
    }

    const elapsedMs = Date.now() - startTime;
    logger.info(
      'WeeklyDigestCron',
      `Completed: ${usersProcessed} users processed, ${digestsGenerated} digests generated, ${errors.length} errors, ${elapsedMs}ms`
    );

    return NextResponse.json(
      {
        success: true,
        usersProcessed,
        digestsGenerated,
        errors: errors.length > 0 ? errors.slice(0, 10) : [],
        elapsedMs,
      },
      { status: 200 }
    );
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    logger.error('WeeklyDigestCron', 'Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run weekly digest generation',
        details: error instanceof Error ? error.message : 'Unknown error',
        elapsedMs,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use GET for cron job execution.' },
    { status: 405 }
  );
}
