/**
 * Seasonal Awareness API Route
 * Story 12.5 / FR6: Seasonal & Cyclical Spending Awareness
 *
 * GET /api/dashboard/seasonal — predicts the next 6 months of spend from
 * the user's monthly history and flags seasonal highs.
 *
 * Security: authentication required; RLS enforced via user-scoped client.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeSeasonalPatterns } from '@/lib/ai/seasonalAnalysis';
import { toLocalISODate } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import type { Transaction } from '@/types/database.types';

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

    const today = new Date();
    // 13 complete months back so the next 6 months can find a same-month-of-year
    // basis. Exclude the in-progress current month — a partial month would drag
    // the baseline down and inflate months_analyzed.
    const thirteenMonthsAgo = toLocalISODate(new Date(today.getFullYear(), today.getMonth() - 13, 1));
    const currentMonthStart = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', thirteenMonthsAgo)
      .lt('date', currentMonthStart);

    if (error) throw error;

    const result = analyzeSeasonalPatterns({
      transactions: (data ?? []) as Transaction[],
      today,
    });

    return NextResponse.json({ ...result, generated_at: today.toISOString() });
  } catch (error) {
    logger.error('SeasonalAPI', 'Error computing seasonal awareness:', error);
    return NextResponse.json(
      { error: { message: 'Failed to compute seasonal awareness' } },
      { status: 500 }
    );
  }
}
