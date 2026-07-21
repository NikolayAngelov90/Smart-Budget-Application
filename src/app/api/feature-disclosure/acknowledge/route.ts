/**
 * API Route: Acknowledge a feature introduction (Story 15.7 / FR37)
 *
 * POST /api/feature-disclosure/acknowledge — persists that the caller has been
 * introduced to a feature so its intro stops surfacing (persist-first; the
 * client hides only after this succeeds). Returns the recomputed disclosure so
 * the client can mutate its cache without a round-trip.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { acknowledgeFeature, getFeatureState } from '@/lib/services/featureStateService';
import { computeDisclosure } from '@/lib/ai/disclosureEngine';
import { FEATURE_KEYS, type FeatureKey } from '@/lib/ai/disclosureCatalog';
import { logger } from '@/lib/utils/logger';
import type { DisclosureResponse } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  feature: z.enum([...FEATURE_KEYS] as [FeatureKey, ...FeatureKey[]]),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: 'Invalid or unknown feature key' } },
        { status: 400 }
      );
    }

    await acknowledgeFeature(user.id, parsed.data.feature);

    // Recompute from fresh state so the client cache matches the server
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
    logger.error('FeatureDisclosure', 'acknowledge failed:', error);
    return NextResponse.json(
      { error: { message: 'Failed to acknowledge feature' } },
      { status: 500 }
    );
  }
}
