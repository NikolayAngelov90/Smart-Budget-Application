/**
 * API Route: Values plan
 * Story 14.1: Values-Based Spending Plan
 *
 * GET  /api/values            - list the caller's values (priority order) with category ids
 * POST /api/values { name, categoryIds? } - create a value
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getValuesPlan, createValue } from '@/lib/services/valuesService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(50),
  categoryIds: z.array(z.string().uuid()).optional(),
});

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

    const values = await getValuesPlan(user.id);
    return NextResponse.json({ data: values });
  } catch (error) {
    logger.error('Values', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load values' } }, { status: 500 });
  }
}

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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { message: 'A value name (1–50 chars) is required' } }, { status: 400 });
    }

    const value = await createValue(user.id, parsed.data);
    return NextResponse.json({ data: value }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: { message: error.message } }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes('characters')) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    logger.error('Values', 'POST failed:', error);
    return NextResponse.json({ error: { message: 'Failed to create value' } }, { status: 500 });
  }
}
