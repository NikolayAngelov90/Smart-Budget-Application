/**
 * API Route: Household members
 * Story 13.11
 *
 * GET /api/households/members - the caller's household roster (membership-gated).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listHouseholdMembers } from '@/lib/services/householdMemberService';
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
    const members = await listHouseholdMembers(user.id);
    return NextResponse.json({ data: members });
  } catch (error) {
    logger.error('HouseholdMembers', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load members' } }, { status: 500 });
  }
}
