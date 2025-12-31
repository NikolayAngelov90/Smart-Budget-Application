/**
 * Dismiss Insight API Endpoint
 *
 * PUT /api/insights/:id/dismiss - Dismiss an insight
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
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
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get insight ID from params (await in Next.js 15)
    const { id: insightId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(insightId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid insight ID format' },
        { status: 400 }
      );
    }

    // Prepare update payload - this endpoint always dismisses (sets to true)
    const updatePayload = {
      is_dismissed: true,
      dismissed_at: new Date().toISOString(),
    }

    // Update insight (RLS will enforce user can only update their own insights)
    const { data: insight, error } = await supabase
      .from('insights')
      .update(updatePayload)
      .eq('id', insightId)
      .eq('user_id', user.id) // Explicit user_id check for clarity
      .select()
      .single();

    // Handle errors
    if (error) {
      // Check if insight doesn't exist or doesn't belong to user
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'Insight not found or you do not have permission to modify it',
          },
          { status: 404 }
        );
      }

      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update insight' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        insight,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error dismissing insight:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to dismiss insight',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
