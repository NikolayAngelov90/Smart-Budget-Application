/**
 * API Route: Personal Allowance
 * Story 13.6: Personal Allowance System
 *
 * GET    /api/allowance - the caller's allowance status (allowance + spent + remaining)
 * PUT    /api/allowance - create or update the caller's allowance { monthly_amount, currency }
 * DELETE /api/allowance - remove the caller's allowance
 *
 * Privacy: personal_allowances has owner-only RLS, so the auth-scoped client used here
 * can never read or write another member's allowance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  getAllowanceStatus,
  upsertAllowance,
  deleteAllowance,
} from '@/lib/services/allowanceService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const upsertSchema = z.object({
  monthly_amount: z.number().nonnegative('Allowance amount must be non-negative'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Invalid currency code').optional(),
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
    if (!user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    const status = await getAllowanceStatus(user.id);
    return NextResponse.json({ data: status });
  } catch (error) {
    logger.error('Allowance', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load allowance' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: 'A valid allowance amount is required' } },
        { status: 400 }
      );
    }
    const allowance = await upsertAllowance(user.id, parsed.data);
    return NextResponse.json({ data: allowance });
  } catch (error) {
    if (error instanceof NotHouseholdMemberError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    logger.error('Allowance', 'PUT failed:', error);
    return NextResponse.json({ error: { message: 'Failed to save allowance' } }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    await deleteAllowance(user.id);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    logger.error('Allowance', 'DELETE failed:', error);
    return NextResponse.json({ error: { message: 'Failed to delete allowance' } }, { status: 500 });
  }
}
