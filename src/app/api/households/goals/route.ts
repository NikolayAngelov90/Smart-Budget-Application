/**
 * API Route: Household shared savings goals
 * Story 13.9
 *
 * GET  /api/households/goals  - shared goals (with per-member breakdown) for the caller's household
 * POST /api/households/goals  - create a shared goal { name, target_amount, deadline? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdGoals, createHouseholdGoal } from '@/lib/services/householdGoalService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  target_amount: z.number().positive('Target must be greater than 0'),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    const goals = await getHouseholdGoals(user.id);
    return NextResponse.json({ data: goals });
  } catch (error) {
    logger.error('HouseholdGoals', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load goals' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { message: 'A valid name and target amount are required' } }, { status: 400 });
    }

    const goal = await createHouseholdGoal(user.id, parsed.data);
    return NextResponse.json({ data: goal });
  } catch (error) {
    if (error instanceof NotHouseholdMemberError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    logger.error('HouseholdGoals', 'POST failed:', error);
    return NextResponse.json({ error: { message: 'Failed to create goal' } }, { status: 500 });
  }
}
