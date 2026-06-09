/**
 * API Route: Household-level AI insights
 * Story 13.10
 *
 * GET /api/households/insights - household-framed spending insights (computed on-demand;
 * aggregates only, private excluded server-side).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdInsights } from '@/lib/services/householdInsightService';
import { logger } from '@/lib/utils/logger';

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

    const insights = await getHouseholdInsights(user.id);
    return NextResponse.json({ data: insights });
  } catch (error) {
    logger.error('HouseholdInsights', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load insights' } }, { status: 500 });
  }
}
