/**
 * API Route: Household category totals (CURRENT MONTH)
 * Story 13.4 / 13.8 (current-month fix)
 *
 * GET /api/households/category-totals - per-category shared spending for the caller's
 * household THIS MONTH (shared + category_only; private excluded), via the membership-gated
 * date-bounded RPC (sums only, never rows). The dashboard's Combined Spending card uses this.
 */

import { NextResponse } from 'next/server';
import { startOfMonth, addMonths, format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { HouseholdCategoryTotal } from '@/types/database.types';

export const dynamic = 'force-dynamic';

function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
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

    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const householdId = membership?.household_id ?? null;
    if (!householdId) {
      return NextResponse.json({ data: [] });
    }

    // Current-month window [start, nextMonthStart). RPC is membership-gated by auth.uid().
    const now = new Date();
    const { data, error } = await supabase.rpc('household_category_period_totals', {
      p_household_id: householdId,
      p_start: isoDate(startOfMonth(now)),
      p_end: isoDate(startOfMonth(addMonths(now, 1))),
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
