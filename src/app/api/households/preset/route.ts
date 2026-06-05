/**
 * API Route: Household transparency preset
 * Story 13.4: Transparency Presets & Per-Category Controls
 *
 * PATCH /api/households/preset { preset } - save the caller's preset and apply its
 * default visibility_level to the caller's own shared categories.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { applyPreset, NotHouseholdMemberError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const presetSchema = z.object({
  preset: z.enum(['newlyweds', 'roommates', 'partners', 'custom']),
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
    const parsed = presetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { message: 'A valid preset is required' } }, { status: 400 });
    }

    const preset = await applyPreset(user.id, parsed.data.preset);
    return NextResponse.json({ data: { preset } });
  } catch (error) {
    if (error instanceof NotHouseholdMemberError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    logger.error('HouseholdPreset', 'PATCH failed:', error);
    return NextResponse.json({ error: { message: 'Failed to apply preset' } }, { status: 500 });
  }
}
