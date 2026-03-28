/**
 * Goals [id] API Route
 * Story 11.5: Savings Goals
 *
 * GET    /api/goals/[id] — get a single goal
 * PUT    /api/goals/[id] — update a goal
 * DELETE /api/goals/[id] — delete a goal
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced via user-scoped client
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoal, updateGoal, deleteGoal } from '@/lib/services/goalService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/goals/[id]
 */
export async function GET(_request: NextRequest, context: RouteContext) {
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

    const goal = await getGoal(supabase, user.id, id);
    if (!goal) {
      return NextResponse.json(
        { error: { message: 'Not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json(goal);
  } catch (error) {
    logger.error('GoalsAPI', 'Error fetching goal:', error);
    return NextResponse.json(
      { error: { message: 'Failed to manage goals' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/goals/[id]
 * Body: { name?: string, target_amount?: number, deadline?: string | null }
 */
export async function PUT(request: NextRequest, context: RouteContext) {
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
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return NextResponse.json(
          { error: { message: 'Goal name cannot be empty' } },
          { status: 400 }
        );
      }
      if (name.length > 200) {
        return NextResponse.json(
          { error: { message: 'Goal name must be 200 characters or fewer' } },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    if (body.target_amount !== undefined) {
      const target_amount = Number(body.target_amount);
      if (isNaN(target_amount) || target_amount <= 0) {
        return NextResponse.json(
          { error: { message: 'target_amount must be greater than 0' } },
          { status: 400 }
        );
      }
      updates.target_amount = target_amount;
    }

    if ('deadline' in body) {
      const deadline = body.deadline != null ? String(body.deadline) : null;
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
      updates.deadline = deadline;
    }

    const goal = await updateGoal(supabase, user.id, id, updates);
    return NextResponse.json(goal);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'Goal not found') {
      return NextResponse.json(
        { error: { message: 'Not found' } },
        { status: 404 }
      );
    }
    logger.error('GoalsAPI', 'Error updating goal:', error);
    return NextResponse.json(
      { error: { message: 'Failed to manage goals' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/goals/[id]
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
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

    await deleteGoal(supabase, user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('GoalsAPI', 'Error deleting goal:', error);
    return NextResponse.json(
      { error: { message: 'Failed to manage goals' } },
      { status: 500 }
    );
  }
}
