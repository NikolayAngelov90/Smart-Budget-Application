/**
 * Achievement Engine — Story 15.3 (FR30)
 *
 * Pure, deterministic evaluator: given the signals a caller has in hand,
 * returns the achievement keys that are newly earned (condition true AND not
 * already unlocked), in catalog order.
 *
 * Every signal is OPTIONAL: an undefined signal SKIPS its conditions
 * entirely — missing data is unknowable, never zero (degradation policy;
 * the 15-2 consistency lesson applied at engine level). Callers evaluate
 * with whatever they already computed:
 *   - tx POST: transactionCount + streak (post-advance state)
 *   - score GET: score + hasBudget + goals
 *
 * Client-import-safe: no DB, no node APIs (streakEngine precedent).
 */

import { ACHIEVEMENTS } from './achievementCatalog';
import type { AchievementKey, Goal, StreakState } from '@/types/database.types';

export interface AchievementEvaluationInput {
  /** All-time transaction count; undefined = signal unavailable */
  transactionCount?: number;
  /** Current streak state (fresh, post-advance); null = no row; undefined = unavailable */
  streak?: StreakState | null;
  /** Budget Score 0-100; undefined = not computed (an outage must not lock OR unlock) */
  score?: number;
  /** Whether at least one explicit category budget exists (ADR-025 source) */
  hasBudget?: boolean;
  /** Own, unexpired goals; undefined = signal unavailable */
  goals?: Goal[];
  /** Keys the user has already unlocked */
  alreadyUnlocked: Set<string>;
}

// Thresholds (inclusive)
export const WEEK_STREAK_DAYS = 7;
export const MONTH_STREAK_DAYS = 30;
export const TEN_TRANSACTIONS = 10;
export const HUNDRED_TRANSACTIONS = 100;
export const SCORE_STEADY_MIN = 50;
export const SCORE_MASTER_MIN = 90;

/** Condition table: undefined signal ⇒ condition not evaluable ⇒ false */
function conditionFor(key: AchievementKey, input: AchievementEvaluationInput): boolean {
  const { transactionCount, streak, score, hasBudget, goals } = input;
  switch (key) {
    case 'first_transaction':
      return transactionCount !== undefined && transactionCount >= 1;
    case 'ten_transactions':
      return transactionCount !== undefined && transactionCount >= TEN_TRANSACTIONS;
    case 'hundred_transactions':
      return transactionCount !== undefined && transactionCount >= HUNDRED_TRANSACTIONS;
    case 'week_streak':
      return !!streak && streak.current_streak >= WEEK_STREAK_DAYS;
    case 'month_streak':
      return !!streak && streak.current_streak >= MONTH_STREAK_DAYS;
    case 'first_budget':
      return hasBudget === true;
    case 'first_goal':
      return goals !== undefined && goals.length >= 1;
    case 'goal_reached':
      return (
        goals !== undefined &&
        goals.some((g) => g.target_amount > 0 && g.current_amount >= g.target_amount)
      );
    case 'score_steady':
      return score !== undefined && score >= SCORE_STEADY_MIN;
    case 'score_master':
      return score !== undefined && score >= SCORE_MASTER_MIN;
  }
}

/** Newly earned achievement keys, in catalog order */
export function evaluateAchievements(input: AchievementEvaluationInput): AchievementKey[] {
  return ACHIEVEMENTS.filter(
    ({ key }) => !input.alreadyUnlocked.has(key) && conditionFor(key, input)
  ).map(({ key }) => key);
}
