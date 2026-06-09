/**
 * API Route: A single value
 * Story 14.1: Values-Based Spending Plan
 *
 * PATCH  /api/values/[id] { name?, priority? } - rename / reprioritize
 * DELETE /api/values/[id]                       - delete (cascade removes mappings)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { updateValue, deleteValue } from '@/lib/services/valuesService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    priority: z.number().int().min(0).optional(),
  })
  .refine((d) => d.name !== undefined || d.priority !== undefined, {
    message: 'Provide a name or priority to update',
  });

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
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { message: 'A valid name or priority is required' } }, { status: 400 });
    }

    await updateValue(user.id, id, parsed.data);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: { message: error.message } }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes('characters')) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    logger.error('Values', 'PATCH failed:', error);
    return NextResponse.json({ error: { message: 'Failed to update value' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await deleteValue(user.id, id);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    logger.error('Values', 'DELETE failed:', error);
    return NextResponse.json({ error: { message: 'Failed to delete value' } }, { status: 500 });
  }
}
