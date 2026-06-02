/**
 * Recovery Plan API Route
 * Story 12.4 / FR4: 30-Day Budget Recovery Plans
 *
 * GET  /api/recovery-plan  — active plan with progress + canGenerate flag
 * POST /api/recovery-plan  — generate a new 30-day recovery plan
 *
 * Security: authentication required; RLS enforced via user-scoped client.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActivePlanWithProgress, generatePlan } from '@/lib/services/recoveryPlanService';
import { logger } from '@/lib/utils/logger';

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

    const result = await getActivePlanWithProgress(supabase, user.id);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('RecoveryPlanAPI', 'Error fetching recovery plan:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch recovery plan' } },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    try {
      const plan = await generatePlan(supabase, user.id);
      return NextResponse.json({ plan }, { status: 201 });
    } catch (genError) {
      // No overspent categories → nothing to recover
      if (genError instanceof Error && /no recovery plan needed/i.test(genError.message)) {
        return NextResponse.json(
          { error: { message: 'No overspent categories — no recovery plan needed' } },
          { status: 400 }
        );
      }
      throw genError;
    }
  } catch (error) {
    logger.error('RecoveryPlanAPI', 'Error generating recovery plan:', error);
    return NextResponse.json(
      { error: { message: 'Failed to generate recovery plan' } },
      { status: 500 }
    );
  }
}
