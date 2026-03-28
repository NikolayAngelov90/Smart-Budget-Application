/**
 * Goal Contribution API Route
 * Story 11.5: Savings Goals
 *
 * POST /api/goals/[id]/contribute — add a contribution to a savings goal
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced via user-scoped client
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addContribution } from '@/lib/services/goalService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/goals/[id]/contribute
 * Body: { amount: number, note?: string | null }
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
    const amount = Number(body.amount);
    const note = body.note != null ? String(body.note) : null;

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: { message: 'amount must be greater than 0' } },
        { status: 400 }
      );
    }

    const updatedGoal = await addContribution(supabase, user.id, id, { amount, note });
    return NextResponse.json(updatedGoal);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'Goal not found' || msg.includes('Goal not found')) {
      return NextResponse.json(
        { error: { message: 'Not found' } },
        { status: 404 }
      );
    }
    logger.error('GoalsAPI', 'Error adding contribution:', error);
    return NextResponse.json(
      { error: { message: 'Failed to manage goals' } },
      { status: 500 }
    );
  }
}
