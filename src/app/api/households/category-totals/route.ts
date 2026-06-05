/**
 * API Route: Household category totals
 * Story 13.4: Transparency Presets & Per-Category Controls
 *
 * GET /api/households/category-totals - per-category aggregate totals for the caller's
 * household (shared + category_only; private excluded), via the SECURITY DEFINER RPC.
 * This is how category_only totals are exposed without leaking individual rows.
 * Story 13.8 (shared dashboard) reuses the same RPC.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { HouseholdCategoryTotal } from '@/types/database.types';

export const dynamic = 'force-dynamic';

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

    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const householdId = membership?.household_id ?? null;
    if (!householdId) {
      return NextResponse.json({ data: [] });
    }

    // RPC runs SECURITY DEFINER but is membership-gated by auth.uid() (caller's JWT).
    const { data, error } = await supabase.rpc('household_category_totals', {
      p_household_id: householdId,
    });
    if (error) {
      logger.error('HouseholdCategoryTotals', 'RPC failed:', error);
      return NextResponse.json({ error: { message: 'Failed to load totals' } }, { status: 500 });
    }

    return NextResponse.json({ data: (data ?? []) as HouseholdCategoryTotal[] });
  } catch (error) {
    logger.error('HouseholdCategoryTotals', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load totals' } }, { status: 500 });
  }
}
