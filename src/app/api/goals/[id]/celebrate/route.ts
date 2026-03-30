/**
 * Goal Milestone Celebrate API Route
 * Story 11.6: Goal Milestone Celebrations
 *
 * POST /api/goals/[id]/celebrate — marks a milestone threshold as celebrated
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced via user-scoped client
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { markMilestoneCelebrated } from '@/lib/services/goalService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

const VALID_THRESHOLDS = [25, 50, 75, 100];

/**
 * POST /api/goals/[id]/celebrate
 * Body: { threshold: number }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const body = await request.json() as Record<string, unknown>;
    const threshold = Number(body.threshold);

    if (!VALID_THRESHOLDS.includes(threshold)) {
      return NextResponse.json(
        { error: { message: 'threshold must be one of 25, 50, 75, 100' } },
        { status: 400 }
      );
    }

    await markMilestoneCelebrated(supabase, user.id, id, threshold);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('GoalsAPI', 'Error marking milestone celebrated:', error);
    return NextResponse.json(
      { error: { message: 'Failed to mark milestone' } },
      { status: 500 }
    );
  }
}
