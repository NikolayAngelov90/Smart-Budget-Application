/**
 * Insight Generation API Endpoint
 *
 * POST /api/insights/generate
 *
 * Triggers generation of AI-powered budget insights for the authenticated user.
 * Supports optional forceRegenerate parameter to bypass cache.
 *
 * Story 6.5: Insight Generation Scheduling and Manual Refresh
 * AC8: Rate Limiting - Max 1 manual refresh per 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateInsights } from '@/lib/services/insightService';
import { checkRateLimit, recordRateLimitAction } from '@/lib/services/rateLimitService';

/**
 * POST handler for insight generation
 *
 * @example
 * POST /api/insights/generate?forceRegenerate=true
 *
 * Response:
 * {
 *   "success": true,
 *   "count": 5,
 *   "message": "Generated 5 insights successfully"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const forceRegenerate = searchParams.get('forceRegenerate') === 'true';

    // Rate limiting check (only for manual refreshes with forceRegenerate=true)
    if (forceRegenerate) {
      // Check if user has exceeded rate limit
      const rateLimitCheck = await checkRateLimit(user.id);

      if (rateLimitCheck.exceeded) {
        console.log(
          `[Rate Limit] User ${user.id} exceeded rate limit. ${rateLimitCheck.remainingSeconds}s remaining`
        );

        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            remainingSeconds: rateLimitCheck.remainingSeconds,
          },
          { status: 429 }
        );
      }

      // Record this action for rate limiting
      await recordRateLimitAction(user.id);
    }

    // Generate insights
    const startTime = Date.now();
    const insights = await generateInsights(user.id, forceRegenerate);
    const elapsedTime = Date.now() - startTime;

    // Return success response
    return NextResponse.json(
      {
        success: true,
        count: insights.length,
        message: `Generated ${insights.length} insight${insights.length !== 1 ? 's' : ''} successfully`,
        elapsedMs: elapsedTime,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating insights:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate insights',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - returns error (only POST is supported)
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST to generate insights.',
    },
    { status: 405 }
  );
}
