/**
 * API Route: Household contribution summary
 * Story 13.7: Income-Proportional Contribution Splits
 *
 * GET /api/households/contributions - per-member percentage, fair share, contributed, and
 * progress for the caller's household (via the membership-gated household_contributions RPC).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getContributionSummary } from '@/lib/services/contributionService';
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

    const summary = await getContributionSummary(user.id);
    return NextResponse.json({ data: summary });
  } catch (error) {
    logger.error('Contributions', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load contributions' } }, { status: 500 });
  }
}
