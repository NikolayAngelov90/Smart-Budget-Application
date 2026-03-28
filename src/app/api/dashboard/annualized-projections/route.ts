/**
 * Annualized Projections API Route
 * Story 11.4: Annualized Spending Projections
 *
 * GET /api/dashboard/annualized-projections
 * Returns annualized spending projections per expense category.
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced via user-scoped client
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAnnualizedProjections,
  hasEnoughDataForProjections,
} from '@/lib/services/projectionsService';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering — projection data changes with new transactions
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/dashboard/annualized-projections
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const hasEnoughData = await hasEnoughDataForProjections(supabase, user.id);

    if (!hasEnoughData) {
      return NextResponse.json({
        projections: [],
        hasEnoughData: false,
        months_analyzed: 0,
      });
    }

    const result = await getAnnualizedProjections(supabase, user.id);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('ProjectionsAPI', 'Error fetching annualized projections:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch projections' } },
      { status: 500 }
    );
  }
}
