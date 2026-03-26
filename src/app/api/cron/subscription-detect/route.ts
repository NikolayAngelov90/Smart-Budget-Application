/**
 * Vercel Cron Job Endpoint - Subscription Detection
 *
 * GET /api/cron/subscription-detect
 *
 * Scheduled to run weekly (Sunday 02:00 UTC, configured in vercel.json)
 * Scans all eligible users' transactions for recurring subscription patterns.
 *
 * Authentication: Requires CRON_SECRET environment variable via Authorization header
 *
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 * AC5: Cron job processes eligible users in batches within Vercel 10-second timeout
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  detectSubscriptions,
  flagUnusedSubscriptions,
  hasEnoughHistory,
} from '@/lib/services/subscriptionService';
import { logger } from '@/lib/utils/logger';

/**
 * GET handler for scheduled cron job
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify cron secret token using timing-safe comparison
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    const cronSecret = process.env.CRON_SECRET ?? '';

    const isAuthorized =
      token.length > 0 &&
      cronSecret.length > 0 &&
      token.length === cronSecret.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));

    if (!isAuthorized) {
      logger.error('SubscriptionCron', 'Unauthorized access attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('SubscriptionCron', 'Starting weekly subscription detection scan');

    // 2. Query all user IDs from user_profiles
    const supabase = createServiceRoleClient();
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1000);

    if (usersError) {
      logger.error('SubscriptionCron', 'Error querying users:', usersError);
      throw usersError;
    }

    const usersToProcess = users || [];

    if (usersToProcess.length === 0) {
      logger.info('SubscriptionCron', 'No users found to process');
      return NextResponse.json(
        {
          success: true,
          usersProcessed: 0,
          totalUsers: 0,
          subscriptionsDetected: 0,
          subscriptionsFlagged: 0,
          errors: [],
          errorCount: 0,
          elapsedMs: Date.now() - startTime,
        },
        { status: 200 }
      );
    }

    // 3. Process users in batches
    let usersProcessed = 0;
    let totalDetected = 0;
    let totalFlagged = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    const batchSize = 20;
    for (let i = 0; i < usersToProcess.length; i += batchSize) {
      const batch = usersToProcess.slice(i, i + batchSize);

      const batchPromises = batch.map(async (user) => {
        try {
          // Check if user has 3+ months of data
          const eligible = await hasEnoughHistory(user.id);
          if (!eligible) return;

          const detected = await detectSubscriptions(user.id);
          const flagged = await flagUnusedSubscriptions(user.id);

          usersProcessed++;
          totalDetected += detected.length;
          totalFlagged += flagged;

          logger.info(
            'SubscriptionCron',
            `User ${user.id}: ${detected.length} detected, ${flagged} flagged`
          );
        } catch (error) {
          logger.error('SubscriptionCron', `Error for user ${user.id}:`, error);
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
      'SubscriptionCron',
      `Completed: ${usersProcessed}/${usersToProcess.length} users, ${totalDetected} detected, ${totalFlagged} flagged, ${errors.length} errors, ${elapsedMs}ms`
    );

    // 4. Return metrics
    return NextResponse.json(
      {
        success: true,
        usersProcessed,
        totalUsers: usersToProcess.length,
        subscriptionsDetected: totalDetected,
        subscriptionsFlagged: totalFlagged,
        errors: errors.length > 0 ? errors.slice(0, 10) : [],
        errorCount: errors.length,
        elapsedMs,
      },
      { status: 200 }
    );
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    logger.error('SubscriptionCron', 'Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run subscription detection',
        details: error instanceof Error ? error.message : 'Unknown error',
        elapsedMs,
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - returns error (only GET is supported for cron jobs)
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use GET for cron job execution.',
    },
    { status: 405 }
  );
}
