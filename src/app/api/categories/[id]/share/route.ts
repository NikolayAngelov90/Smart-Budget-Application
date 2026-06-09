/**
 * API Route: Share / un-share a category with the household
 * Story 13.5 follow-up.
 *
 * PATCH /api/categories/[id]/share { shared: boolean }
 * Works for any of the caller's own categories — predefined/default included.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { setCategoryShared, CategoryNotFoundError } from '@/lib/services/categoryShareService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const schema = z.object({ shared: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: { message: 'A boolean "shared" flag is required' } }, { status: 400 });
    }

    const category = await setCategoryShared(user.id, id, parsed.data.shared);
    return NextResponse.json({ data: category });
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 404 });
    }
    if (error instanceof NotHouseholdMemberError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    logger.error('CategoryShare', 'PATCH failed:', error);
    return NextResponse.json({ error: { message: 'Failed to update sharing' } }, { status: 500 });
  }
}
