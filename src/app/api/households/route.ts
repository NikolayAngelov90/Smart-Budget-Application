/**
 * API Route: Households
 * Story 13.1: Household Creation & Database Foundation
 *
 * POST /api/households  - create a household (caller becomes admin)
 * GET  /api/households   - return the caller's household (+ role) or null
 *
 * Security: authentication required; RLS enforces household isolation at the DB layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createHousehold, getCurrentHousehold, HouseholdExistsError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const createHouseholdSchema = z.object({
  name: z.string().trim().min(1, 'Household name is required').max(100, 'Household name is too long'),
});

export async function POST(request: NextRequest) {
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
    const parsed = createHouseholdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: 'Validation failed', details: parsed.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const household = await createHousehold(user.id, parsed.data.name);
    return NextResponse.json({ data: household }, { status: 201 });
  } catch (error) {
    if (error instanceof HouseholdExistsError) {
      return NextResponse.json(
        { error: { message: 'You already belong to a household' } },
        { status: 409 }
      );
    }
    logger.error('Households', 'POST failed:', error);
    return NextResponse.json({ error: { message: 'Failed to create household' } }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const household = await getCurrentHousehold(user.id);
    return NextResponse.json({ data: household });
  } catch (error) {
    logger.error('Households', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to fetch household' } }, { status: 500 });
  }
}
