/**
 * Goals API Route
 * Story 11.5: Savings Goals
 *
 * GET  /api/goals — list all goals for the authenticated user
 * POST /api/goals — create a new savings goal
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced via user-scoped client
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoals, createGoal } from '@/lib/services/goalService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/goals
 * Returns all savings goals for the authenticated user.
 */
export async function GET() {
  try {
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

    const goals = await getGoals(supabase, user.id);
    return NextResponse.json({ goals });
  } catch (error) {
    logger.error('GoalsAPI', 'Error fetching goals:', error);
    return NextResponse.json(
      { error: { message: 'Failed to manage goals' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals
 * Creates a new savings goal.
 * Body: { name: string, target_amount: number, deadline?: string | null }
 */
export async function POST(request: NextRequest) {
  try {
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
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const target_amount = Number(body.target_amount);
    const deadline = body.deadline != null ? String(body.deadline) : null;

    // Validate
    if (!name) {
      return NextResponse.json(
        { error: { message: 'Goal name is required' } },
        { status: 400 }
      );
    }
    if (name.length > 200) {
      return NextResponse.json(
        { error: { message: 'Goal name must be 200 characters or fewer' } },
        { status: 400 }
      );
    }
    if (isNaN(target_amount) || target_amount <= 0) {
      return NextResponse.json(
        { error: { message: 'target_amount must be greater than 0' } },
        { status: 400 }
      );
    }
    if (deadline !== null) {
      const deadlineDate = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadlineDate.setHours(0, 0, 0, 0);
      if (isNaN(deadlineDate.getTime()) || deadlineDate <= today) {
        return NextResponse.json(
          { error: { message: 'deadline must be a valid future date' } },
          { status: 400 }
        );
      }
    }

    const goal = await createGoal(supabase, user.id, { name, target_amount, deadline });
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    logger.error('GoalsAPI', 'Error creating goal:', error);
    return NextResponse.json(
      { error: { message: 'Failed to manage goals' } },
      { status: 500 }
    );
  }
}
