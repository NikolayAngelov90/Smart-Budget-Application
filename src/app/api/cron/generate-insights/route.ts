/**
 * Vercel Cron Job Endpoint - Generate Insights
 *
 * GET /api/cron/generate-insights
 *
 * Scheduled to run daily at midnight UTC (configured in vercel.json)
 * Checks if it's the start of a new month and generates insights for all users
 *
 * Authentication: Requires CRON_SECRET environment variable via Authorization header
 *
 * Story 6.5: Insight Generation Scheduling and Manual Refresh
 * AC2: Scheduled Job - Daily at midnight UTC, checks for new month
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { generateInsights } from '@/lib/services/insightService';
import { logger } from '@/lib/utils/logger';

/**
 * GET handler for scheduled cron job
 *
 * @example
 * GET /api/cron/generate-insights
 * Headers: Authorization: Bearer ${process.env.CRON_SECRET}
 *
 * Response:
 * {
 *   "success": true,
 *   "usersProcessed": 25,
 *   "insightsGenerated": 87,
 *   "skipped": false,
 *   "reason": null,
 *   "errors": []
 * }
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify cron secret token using timing-safe comparison
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') ?? '';
    const cronSecret = process.env.CRON_SECRET ?? '';

    // Use timing-safe comparison to prevent timing attacks
    const isAuthorized = token.length > 0 &&
      cronSecret.length > 0 &&
      token.length === cronSecret.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));

    if (!isAuthorized) {
      logger.error('Cron', 'Unauthorized access attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check if it's the 1st day of the month (new month detection)
    const today = new Date();
    const isFirstOfMonth = today.getUTCDate() === 1;

    if (!isFirstOfMonth) {
      logger.info('Cron', `Skipped - Not start of month (Day: ${today.getUTCDate()})`);
      return NextResponse.json(
        {
          success: true,
          skipped: true,
          reason: `Not start of month (Day ${today.getUTCDate()})`,
          usersProcessed: 0,
          insightsGenerated: 0,
        },
        { status: 200 }
      );
    }

    logger.info('Cron', 'Starting monthly insight generation for all users');

    // 3. Query distinct active user IDs efficiently from user_profiles
    const supabase = await createClient();
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1000);

    const usersToProcess = users || [];

    if (usersError) {
      logger.error('Cron', 'Error querying users:', usersError);
      throw usersError;
    }

    if (!usersToProcess || usersToProcess.length === 0) {
      logger.info('Cron', 'No users found to process');
      return NextResponse.json(
        {
          success: true,
          usersProcessed: 0,
          insightsGenerated: 0,
          skipped: false,
        },
        { status: 200 }
      );
    }

    // 4. Process each user (generate insights)
    let usersProcessed = 0;
    let totalInsightsGenerated = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    // Process users in batches to stay within Vercel 10-second limit
    const batchSize = 20;
    for (let i = 0; i < usersToProcess.length; i += batchSize) {
      const batch = usersToProcess.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async (user) => {
        try {
          const insights = await generateInsights(user.id, false);
          usersProcessed++;
          totalInsightsGenerated += insights.length;
          logger.info('Cron', `User ${user.id}: ${insights.length} insights generated`);
        } catch (error) {
          logger.error('Cron', `Error for user ${user.id}:`, error);
          errors.push({
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      await Promise.all(batchPromises);
    }

    const elapsedTime = Date.now() - startTime;
    logger.info(
      'Cron',
      `Completed: ${usersProcessed}/${usersToProcess.length} users, ${totalInsightsGenerated} insights, ${errors.length} errors, ${elapsedTime}ms`
    );

    // 5. Return success response with metrics
    return NextResponse.json(
      {
        success: true,
        usersProcessed,
        totalUsers: usersToProcess.length,
        insightsGenerated: totalInsightsGenerated,
        errors: errors.length > 0 ? errors.slice(0, 10) : [], // Return max 10 errors
        errorCount: errors.length,
        elapsedMs: elapsedTime,
        skipped: false,
      },
      { status: 200 }
    );
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    logger.error('Cron', 'Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate insights',
        details: error instanceof Error ? error.message : 'Unknown error',
        elapsedMs: elapsedTime,
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
