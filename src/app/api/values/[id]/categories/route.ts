/**
 * API Route: A value's category assignments
 * Story 14.1: Values-Based Spending Plan
 *
 * PUT /api/values/[id]/categories { categoryIds } - replace the value's mapped categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { setValueCategories } from '@/lib/services/valuesService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const schema = z.object({ categoryIds: z.array(z.string().uuid()) });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: { message: 'categoryIds must be an array of ids' } }, { status: 400 });
    }

    await setValueCategories(user.id, id, parsed.data.categoryIds);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: { message: error.message } }, { status: 404 });
    }
    logger.error('Values', 'PUT categories failed:', error);
    return NextResponse.json({ error: { message: 'Failed to update value categories' } }, { status: 500 });
  }
}
