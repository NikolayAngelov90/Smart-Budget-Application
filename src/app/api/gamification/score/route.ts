/**
 * Budget Score API Route — Story 15.2 (FR29)
 *
 * GET /api/gamification/score
 * Computes the 0-100 Budget Score read-time via the pure budgetScoreEngine.
 * No persistence (documented ADR-012 deviation — the 15-1 no-cron precedent);
 * "updates after each transaction" = SWR revalidation of SCORE_KEY on tx save.
 *
 * Degradation (docs/api-conventions.md#degradation-policy):
 * - transactions/categories are CORE inputs → error = 500 (never fake a score)
 * - category_budgets error → warn + no explicit limits (032 may be unapplied)
 * - streaks error → warn + null (034 may be unapplied)
 * - goals error → warn + empty
 * - empty results ≠ errors
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { computeBudgetScore } from '@/lib/ai/budgetScoreEngine';
import { AVERAGE_WINDOW_MONTHS } from '@/lib/ai/spendingAnalysis';
import { localDayKey } from '@/lib/ai/streakEngine';
import { getStreak } from '@/lib/services/streakService';
import { toLocalISODate } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import type { BudgetScoreResponse, Goal } from '@/types/database.types';

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
    const todayKey = localDayKey(today);
    // DATE columns compare as YYYY-MM-DD strings (never toISOString) — house rule
    const currentMonthStart = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));
    const currentMonthEnd = toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    const threeMonthsAgo = toLocalISODate(
      new Date(today.getFullYear(), today.getMonth() - AVERAGE_WINDOW_MONTHS, 1)
    );

    // Own-scoped queries mirroring /api/dashboard/budget-forecast EXACTLY —
    // the score's adherence must agree with BudgetHealthCard/BudgetForecast
    // (deliberately NOT the what-if RLS-visible widening; see story Data scope)
    const [currentResult, historicalResult, categoriesResult, budgetsResult, goalsResult, streakResult] =
      await Promise.all([
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

        supabase.from('categories').select('*').eq('user_id', user.id),

        // ADR-025 explicit limits — enrichment, degrade on error
        supabase
          .from('category_budgets')
          .select('category_id, limit_amount')
          .eq('user_id', user.id)
          .eq('period', 'monthly')
          .is('household_id', null),

        // Own, unexpired goals only (14-3 lesson: expired filtered SERVER-side).
        // goals aren't in the typed Database schema (13-9 gotcha) — generic client.
        (supabase as unknown as SupabaseClient)
          .from('goals')
          .select('*')
          .eq('user_id', user.id)
          .or(`deadline.is.null,deadline.gt.${todayKey}`),

        // Streak enrichment — 034 may be unapplied; never let it 500 the score
        getStreak(user.id).catch((error) => {
          logger.warn('BudgetScoreAPI', 'streaks unavailable, consistency scores 0:', error);
          return null;
        }),
      ]);

    // Core inputs — a score computed without them would be fabricated
    if (currentResult.error) throw currentResult.error;
    if (historicalResult.error) throw historicalResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

    if (budgetsResult.error) {
      logger.warn('BudgetScoreAPI', 'category_budgets unavailable, using averages:', budgetsResult.error);
    }
    if (goalsResult.error) {
      logger.warn('BudgetScoreAPI', 'goals unavailable, factor unscored:', goalsResult.error);
    }

    const currentMonthTransactions = currentResult.data ?? [];
    const historicalTransactions = historicalResult.data ?? [];
    const categories = categoriesResult.data ?? [];
    const explicitBudgets = new Map<string, number>(
      (budgetsResult.error ? [] : (budgetsResult.data ?? [])).map((b) => [
        b.category_id,
        b.limit_amount,
      ])
    );
    const goals = (goalsResult.error ? [] : (goalsResult.data ?? [])) as Goal[];
    const streak = streakResult;

    const budgetScore = computeBudgetScore({
      currentMonthTransactions,
      historicalTransactions,
      categories,
      explicitBudgets,
      goals,
      streak,
      today,
    });

    const response: BudgetScoreResponse = {
      hasData: budgetScore !== null,
      budgetScore,
    };
    return NextResponse.json(response);
  } catch (error) {
    logger.error('BudgetScoreAPI', 'Error computing budget score:', error);
    return NextResponse.json(
      { error: { message: 'Failed to compute budget score' } },
      { status: 500 }
    );
  }
}
