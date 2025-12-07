/**
 * Insight Engagement Analytics Tracking Endpoint
 *
 * POST /api/insights/:id/track
 *
 * Tracks user engagement events for insights (views, metadata expansions).
 * Used for analytics and measuring insight effectiveness.
 *
 * Epic 6 Retrospective: Insight Quality Monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Valid engagement event types
 */
type EngagementEventType = 'view' | 'metadata_expand';

/**
 * POST handler for tracking engagement events
 *
 * @example
 * POST /api/insights/abc-123/track
 * Body: { "event": "view" }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Event tracked successfully"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get insight ID from params
    const { id: insightId } = await params;

    // Validate insight ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(insightId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid insight ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { event } = body as { event?: string };

    // Validate event type
    const validEvents: EngagementEventType[] = ['view', 'metadata_expand'];
    if (!event || !validEvents.includes(event as EngagementEventType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid event type. Must be "view" or "metadata_expand"',
        },
        { status: 400 }
      );
    }

    // Verify insight belongs to user (RLS enforcement)
    const { data: insight, error: fetchError } = await supabase
      .from('insights')
      .select('id, user_id, view_count, first_viewed_at, metadata_expanded_count')
      .eq('id', insightId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !insight) {
      return NextResponse.json(
        { success: false, error: 'Insight not found or access denied' },
        { status: 404 }
      );
    }

    // Track engagement event
    const now = new Date().toISOString();

    if (event === 'view') {
      // Increment view count and update timestamps
      const { error: updateError } = await supabase
        .from('insights')
        .update({
          view_count: (insight.view_count || 0) + 1,
          first_viewed_at: insight.first_viewed_at || now,
          last_viewed_at: now,
        })
        .eq('id', insightId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[Analytics] Error tracking view:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to track event' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: 'View tracked successfully',
          view_count: (insight.view_count || 0) + 1,
        },
        { status: 200 }
      );
    }

    if (event === 'metadata_expand') {
      // Increment metadata expansion count and update timestamp
      const { error: updateError } = await supabase
        .from('insights')
        .update({
          metadata_expanded_count: (insight.metadata_expanded_count || 0) + 1,
          last_metadata_expanded_at: now,
        })
        .eq('id', insightId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[Analytics] Error tracking metadata expansion:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to track event' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Metadata expansion tracked successfully',
          metadata_expanded_count: (insight.metadata_expanded_count || 0) + 1,
        },
        { status: 200 }
      );
    }

    // Should never reach here due to validation above
    return NextResponse.json(
      { success: false, error: 'Invalid event type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Analytics] Error tracking engagement:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track engagement event',
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
      error: 'Method not allowed. Use POST to track engagement events.',
    },
    { status: 405 }
  );
}
