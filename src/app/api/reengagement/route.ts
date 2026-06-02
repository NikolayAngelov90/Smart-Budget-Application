/**
 * Re-engagement API Route
 * Story 12.6 / FR8: Lapsed User Re-engagement Analysis
 *
 * GET /api/reengagement — returns the welcome-back summary for a returning
 * lapsed user, or { summary: null } when not applicable.
 *
 * Dismissal is handled via PUT /api/user/profile (preferences merge).
 *
 * Security: authentication required; RLS enforced via user-scoped client.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getReengagementSummary } from '@/lib/services/reengagementService';
import { logger } from '@/lib/utils/logger';
import type { UserPreferences } from '@/types/user.types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Load preferences for dismissal state
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle();

    const prefs = (profile?.preferences ?? null) as Partial<UserPreferences> | null;

    const summary = await getReengagementSummary(supabase, user.id, prefs);
    return NextResponse.json({ summary });
  } catch (error) {
    logger.error('ReengagementAPI', 'Error computing re-engagement summary:', error);
    return NextResponse.json(
      { error: { message: 'Failed to compute re-engagement summary' } },
      { status: 500 }
    );
  }
}
