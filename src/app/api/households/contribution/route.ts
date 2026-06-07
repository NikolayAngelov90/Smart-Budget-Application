/**
 * API Route: Household contribution percentage
 * Story 13.7: Income-Proportional Contribution Splits
 *
 * PATCH /api/households/contribution { percentage } - set the caller's own percentage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { setContribution } from '@/lib/services/contributionService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const schema = z.object({
  percentage: z.number().min(0, 'Percentage must be 0–100').max(100, 'Percentage must be 0–100'),
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { message: 'A valid percentage (0–100) is required' } }, { status: 400 });
    }

    const percentage = await setContribution(user.id, parsed.data.percentage);
    return NextResponse.json({ data: { percentage } });
  } catch (error) {
    if (error instanceof NotHouseholdMemberError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    logger.error('Contribution', 'PATCH failed:', error);
    return NextResponse.json({ error: { message: 'Failed to save contribution' } }, { status: 500 });
  }
}
