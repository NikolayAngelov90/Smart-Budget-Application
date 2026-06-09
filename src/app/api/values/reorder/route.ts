/**
 * API Route: Reorder values
 * Story 14.1: Values-Based Spending Plan
 *
 * PATCH /api/values/reorder { orderedIds } - rewrite priority to the array index for each id
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { reorderValues } from '@/lib/services/valuesService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const schema = z.object({ orderedIds: z.array(z.string().uuid()) });

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
      return NextResponse.json({ error: { message: 'orderedIds must be an array of ids' } }, { status: 400 });
    }

    await reorderValues(user.id, parsed.data.orderedIds);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    logger.error('Values', 'reorder failed:', error);
    return NextResponse.json({ error: { message: 'Failed to reorder values' } }, { status: 500 });
  }
}
