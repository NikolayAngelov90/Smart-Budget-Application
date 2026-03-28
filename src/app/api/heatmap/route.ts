/**
 * Heatmap API Route
 * Story 11.3: Spending Heatmap
 *
 * GET /api/heatmap?year=2026&month=3
 * Returns daily expense spending aggregations for heatmap visualization.
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced via user-scoped client
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDailySpending, hasEnoughDataForHeatmap } from '@/lib/services/heatmapService';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering — heatmap data changes with new transactions
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/heatmap
 * Query params:
 *   - year: number (default: current year)
 *   - month: number 1-12 (default: current month)
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 1900 || year > 2100) {
      return NextResponse.json(
        { error: { message: 'Invalid year or month parameter' } },
        { status: 400 }
      );
    }

    const [data, hasEnoughData] = await Promise.all([
      getDailySpending(supabase, user.id, year, month),
      hasEnoughDataForHeatmap(supabase, user.id),
    ]);

    return NextResponse.json({ data, year, month, hasEnoughData });
  } catch (error) {
    logger.error('HeatmapAPI', 'Error fetching heatmap data:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch heatmap data' } },
      { status: 500 }
    );
  }
}
