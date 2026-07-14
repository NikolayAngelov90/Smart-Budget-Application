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
import { evaluateAchievements } from '@/lib/ai/achievementEngine';
import { getUnlocked, unlockAchievements } from '@/lib/services/achievementService';
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

        // ALL own goals — the score factor needs only unexpired ones (filtered
        // in code below; DATE strings compare lexicographically), but the
        // achievement evaluation must see expired goals too: unlocks are
        // once-ever, and a goal reached ON its deadline day must still count
        // (15-3 review MED — the old server-side .gt filter permanently lost
        // first_goal/goal_reached for goals that expired before the next
        // dashboard visit). Own goals are few; no LIMIT starvation risk here.
        // goals aren't in the typed Database schema (13-9 gotcha) — generic client.
        (supabase as unknown as SupabaseClient).from('goals').select('*').eq('user_id', user.id),

        // Streak enrichment — 034 may be unapplied; never let it 500 the score.
        // Unknowable ≠ zero: an unreadable table marks consistency UNSCORED
        // (degradation policy), while a missing row legitimately scores 0.
        getStreak(user.id).then(
          (state) => ({ state, unavailable: false }),
          (error) => {
            logger.warn('BudgetScoreAPI', 'streaks unavailable, consistency unscored:', error);
            return { state: null, unavailable: true };
          }
        ),
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
    const allGoals = (goalsResult.error ? [] : (goalsResult.data ?? [])) as Goal[];
    // Score factor: ACTIVE goals only (deadline null or in the future)
    const activeGoals = allGoals.filter((g) => g.deadline === null || g.deadline > todayKey);

    const budgetScore = computeBudgetScore({
      currentMonthTransactions,
      historicalTransactions,
      categories,
      explicitBudgets,
      goals: activeGoals,
      streak: streakResult.state,
      streakUnavailable: streakResult.unavailable,
      today,
    });

    // Story 15.3: score-side achievement evaluation (score / budgets / goals —
    // all already in hand). Best-effort enrichment: failure warns and returns
    // [] — NEVER breaks the score response (degradation policy).
    const newlyUnlocked = await (async () => {
      const unlocked = await getUnlocked(user.id);
      const earned = evaluateAchievements({
        score: budgetScore?.score,
        // Errored queries are UNKNOWABLE signals — skip, don't evaluate as false.
        // Achievements see ALL goals incl. expired (unlocks are once-ever).
        hasBudget: budgetsResult.error ? undefined : explicitBudgets.size > 0,
        goals: goalsResult.error ? undefined : allGoals,
        alreadyUnlocked: new Set(unlocked.map((a) => a.achievement_key)),
      });
      if (earned.length === 0) return [];
      const inserted = await unlockAchievements(user.id, earned);
      return inserted.map((a) => a.achievement_key);
    })().catch((err) => {
      logger.warn('BudgetScoreAPI', 'Achievement evaluation failed (non-fatal):', err);
      return [];
    });

    const response: BudgetScoreResponse = {
      hasData: budgetScore !== null,
      budgetScore,
      newlyUnlocked,
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
