/**
 * API Route: Contribute to a shared household goal
 * Story 13.9
 *
 * POST /api/households/goals/[id]/contribute { amount, note? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { contributeToHouseholdGoal, GoalNotFoundError } from '@/lib/services/householdGoalService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const schema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  note: z.string().max(100).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { message: 'A valid amount is required' } }, { status: 400 });
    }

    const goal = await contributeToHouseholdGoal(user.id, id, parsed.data);
    return NextResponse.json({ data: goal });
  } catch (error) {
    if (error instanceof GoalNotFoundError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 404 });
    }
    if (error instanceof NotHouseholdMemberError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    logger.error('HouseholdGoalContribute', 'POST failed:', error);
    return NextResponse.json({ error: { message: 'Failed to contribute' } }, { status: 500 });
  }
}
