/**
 * End-of-Month Budget Forecast API Route
 * Story 12.2: End-of-Month Budget Projections
 *
 * GET /api/dashboard/budget-forecast
 * Returns per-category end-of-month spending forecasts based on the current
 * daily spending rate extrapolated against a 3-month historical average.
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced via user-scoped client
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeEndOfMonthForecasts } from '@/lib/ai/forecastEngine';
import { toLocalISODate } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/dashboard/budget-forecast
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

    const today = new Date();
    const currentMonthStart = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));
    const currentMonthEnd = toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    const threeMonthsAgo = toLocalISODate(new Date(today.getFullYear(), today.getMonth() - 3, 1));

    // Fetch current-month, prior-3-months, and categories in parallel
    const [currentResult, historicalResult, categoriesResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', currentMonthStart)
        .lte('date', currentMonthEnd),

      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', threeMonthsAgo)
        .lt('date', currentMonthStart),

      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id),
    ]);

    if (currentResult.error) throw currentResult.error;
    if (historicalResult.error) throw historicalResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

    const currentMonthTransactions = currentResult.data ?? [];
    const historicalTransactions = historicalResult.data ?? [];
    const categories = categoriesResult.data ?? [];

    if (currentMonthTransactions.length === 0) {
      return NextResponse.json({
        forecasts: [],
        hasCurrentMonthData: false,
        generated_at: today.toISOString(),
      });
    }

    const forecasts = computeEndOfMonthForecasts({
      currentMonthTransactions,
      historicalTransactions,
      categories,
      today,
    });

    return NextResponse.json({
      forecasts,
      hasCurrentMonthData: true,
      generated_at: today.toISOString(),
    });
  } catch (error) {
    logger.error('BudgetForecastAPI', 'Error computing forecast:', error);
    return NextResponse.json(
      { error: { message: 'Failed to compute budget forecast' } },
      { status: 500 }
    );
  }
}
