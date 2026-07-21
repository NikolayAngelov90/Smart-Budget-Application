/**
 * API Route: Feature disclosure state (Story 15.7 / FR37)
 *
 * GET /api/feature-disclosure — the caller's usage-driven disclosure state:
 * which features are unlocked and which have a pending introduction. This is
 * STATE (re-derivable from persisted counts + acknowledgments), NOT a vanishing
 * one-shot, so it is safely cacheable. Activity is tracked server-side inside
 * POST /api/transactions; acknowledgments via POST /api/feature-disclosure/acknowledge.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFeatureState } from '@/lib/services/featureStateService';
import { computeDisclosure } from '@/lib/ai/disclosureEngine';
import { logger } from '@/lib/utils/logger';
import type { DisclosureResponse } from '@/types/database.types';

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

    // Core inputs: usage state + the show-all escape-hatch pref. A read failure
    // must 500 (degradation policy: error-as-empty would poison the SWR cache
    // AND wrongly lock features the user earned).
    const state = await getFeatureState(user.id);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle();
    const prefs = (profile?.preferences ?? {}) as Record<string, unknown>;
    const showAll = prefs.disclosure_show_all === true;

    const { unlocked, pending } = computeDisclosure(state, showAll);

    const response: DisclosureResponse = {
      transactionsCount: state.transactions_count,
      daysActive: state.days_active,
      unlocked,
      pending,
    };
    return NextResponse.json(response);
  } catch (error) {
    logger.error('FeatureDisclosure', 'GET failed:', error);
    return NextResponse.json(
      { error: { message: 'Failed to load feature disclosure' } },
      { status: 500 }
    );
  }
}
