/**
 * Budget Score Engine — Story 15.2 (FR29)
 *
 * Pure, deterministic 0-100 financial-health score from three factors:
 * budget adherence (50), logging consistency (30), goal progress (20).
 * Client-import-safe (no DB, no node APIs, no currency formatting — the
 * Epic-12/whatIfEngine/streakEngine precedent). The engine returns numbers
 * and enums only; ALL user-facing text is i18n keys in the component.
 *
 * Factors whose inputs don't exist yet are UNSCORED and the score
 * renormalizes over the scored weights — having no budgets or no goals
 * must never punish (no-guilt UX principle). Score computed read-time;
 * no persistence (documented ADR-012 deviation, see story Dev Notes).
 */

import { resolveBudget } from './budgetResolver';
import { fixedWindowMonthlyAverage } from './spendingAnalysis';
import { isStreakBroken, localDayKey } from './streakEngine';
import type {
  BudgetScore,
  BudgetScoreLevel,
  Category,
  Goal,
  ScoreFactor,
  StreakState,
  Transaction,
} from '@/types/database.types';

export interface BudgetScoreInput {
  /** Own expense transactions for the current calendar month (MTD) */
  currentMonthTransactions: Transaction[];
  /** Own expense transactions for the prior 3 calendar months */
  historicalTransactions: Transaction[];
  /** The user's own categories */
  categories: Category[];
  /** category_id → explicit monthly limit (ADR-025); may be empty */
  explicitBudgets: Map<string, number>;
  /** Own, unexpired goals (deadline null or in the future — filtered server-side) */
  goals: Goal[];
  /** Streak row from 15.1, or null (no row / streaks table unavailable) */
  streak: StreakState | null;
  today: Date;
}

// Factor weights — Σ = 100 when all three are scored
export const ADHERENCE_MAX = 50;
export const CONSISTENCY_MAX = 30;
export const GOALS_MAX = 20;

// Factor status thresholds (share of the factor's max)
export const HELPING_THRESHOLD = 0.7;
export const HURTING_THRESHOLD = 0.4;

// Adherence projection: sub-score 1 at projectedRatio<=1, 0 at >=RATIO_FLOOR
export const ADHERENCE_RATIO_CEILING = 1.5;
/** Month-progress floor so a day-1 purchase doesn't project ×30 */
export const MONTH_PROGRESS_FLOOR = 0.1;

// Consistency: daily streak capped at 30 days (20 pts), weekly at 8 weeks (10 pts)
export const DAILY_STREAK_CAP = 30;
export const WEEKLY_STREAK_CAP = 8;
const DAILY_POINTS = 20;
const WEEKLY_POINTS = 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function statusFor(earned: number, max: number): ScoreFactor['status'] {
  const share = earned / max;
  if (share >= HELPING_THRESHOLD) return 'helping';
  if (share < HURTING_THRESHOLD) return 'hurting';
  return 'neutral';
}

/** Level bands (inclusive): 0-24/25-49/50-74/75-89/90-100 */
export function levelFor(score: number): BudgetScoreLevel {
  if (score >= 90) return 'master';
  if (score >= 75) return 'strong';
  if (score >= 50) return 'steady';
  if (score >= 25) return 'building';
  return 'beginner';
}

/**
 * Budget adherence (0..50), or null when NO category has a resolvable budget.
 * Per budgeted category: projectedRatio = (spentMTD / monthProgress) / budget;
 * sub-score 1 when <=1, 0 when >=1.5, linear between.
 */
function adherenceEarned(input: BudgetScoreInput): number | null {
  const { currentMonthTransactions, historicalTransactions, categories, explicitBudgets, today } =
    input;

  // MTD spend per category
  const currentSpend = new Map<string, number>();
  for (const tx of currentMonthTransactions) {
    if (tx.type !== 'expense') continue;
    currentSpend.set(tx.category_id, (currentSpend.get(tx.category_id) ?? 0) + tx.amount);
  }

  // Historical per-category per-month totals (YYYY-MM string keys — never Date-parse
  // a DATE column, 14-2 lesson) → fixed ÷3 window average (epic-14 retro)
  const historicalMonthMap = new Map<string, Map<string, number>>();
  for (const tx of historicalTransactions) {
    if (tx.type !== 'expense') continue;
    const monthKey = tx.date.substring(0, 7);
    if (!historicalMonthMap.has(tx.category_id)) {
      historicalMonthMap.set(tx.category_id, new Map());
    }
    const monthly = historicalMonthMap.get(tx.category_id)!;
    monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + tx.amount);
  }

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthProgress = clamp(today.getDate() / daysInMonth, MONTH_PROGRESS_FLOOR, 1);

  const subScores: number[] = [];
  for (const category of categories) {
    const monthTotals = Array.from(historicalMonthMap.get(category.id)?.values() ?? []);
    // ADR-025: the resolver is the ONLY explicit-vs-average chooser
    const resolved = resolveBudget({
      explicitLimit: explicitBudgets.get(category.id) ?? null,
      threeMonthAverage: fixedWindowMonthlyAverage(monthTotals),
    });
    if (resolved.amount <= 0) continue; // 0 = "no baseline" to every consumer

    const spent = currentSpend.get(category.id) ?? 0;
    const projectedRatio = spent / monthProgress / resolved.amount;
    subScores.push(
      clamp((ADHERENCE_RATIO_CEILING - projectedRatio) / (ADHERENCE_RATIO_CEILING - 1), 0, 1)
    );
  }

  if (subScores.length === 0) return null; // unscored — nothing has a budget yet
  const mean = subScores.reduce((a, b) => a + b, 0) / subScores.length;
  return mean * ADHERENCE_MAX;
}

/**
 * Logging consistency (0..30) — ALWAYS scored: absence of logging is knowable.
 * A broken streak earns 0 (same invariant as the badge hiding dead streaks).
 */
function consistencyEarned(streak: StreakState | null, today: Date): number {
  if (!streak || streak.current_streak <= 0) return 0;
  if (isStreakBroken(streak, localDayKey(today))) return 0;
  const daily = (Math.min(streak.current_streak, DAILY_STREAK_CAP) / DAILY_STREAK_CAP) * DAILY_POINTS;
  const weekly =
    (Math.min(streak.weekly_streak, WEEKLY_STREAK_CAP) / WEEKLY_STREAK_CAP) * WEEKLY_POINTS;
  return daily + weekly;
}

/** Goal progress (0..20), or null when the user has no active goals */
function goalsEarned(goals: Goal[]): number | null {
  const progresses = goals
    .filter((g) => g.target_amount > 0) // DB-enforced, still guard ÷0
    .map((g) => clamp(g.current_amount / g.target_amount, 0, 1));
  if (progresses.length === 0) return null;
  const mean = progresses.reduce((a, b) => a + b, 0) / progresses.length;
  return mean * GOALS_MAX;
}

/**
 * Computes the Budget Score. Returns null when NO factor is scored
 * (the route pairs that with hasData:false).
 */
export function computeBudgetScore(input: BudgetScoreInput): BudgetScore | null {
  const adherence = adherenceEarned(input);
  const goals = goalsEarned(input.goals);

  // Consistency is only meaningful once the user logs at all; when there is
  // neither transaction history nor a streak row nor goals, nothing is scored.
  const hasAnyActivity =
    input.currentMonthTransactions.length > 0 ||
    input.historicalTransactions.length > 0 ||
    input.streak !== null ||
    input.goals.length > 0;
  if (!hasAnyActivity) return null;

  const consistency = consistencyEarned(input.streak, input.today);

  const factors: ScoreFactor[] = [
    {
      key: 'adherence',
      earned: adherence === null ? 0 : Math.round(adherence * 10) / 10,
      max: ADHERENCE_MAX,
      status: adherence === null ? 'unscored' : statusFor(adherence, ADHERENCE_MAX),
    },
    {
      key: 'consistency',
      earned: Math.round(consistency * 10) / 10,
      max: CONSISTENCY_MAX,
      status: statusFor(consistency, CONSISTENCY_MAX),
    },
    {
      key: 'goals',
      earned: goals === null ? 0 : Math.round(goals * 10) / 10,
      max: GOALS_MAX,
      status: goals === null ? 'unscored' : statusFor(goals, GOALS_MAX),
    },
  ];

  // Renormalize over scored weights only — unscored factors neither help nor hurt
  const scored = factors.filter((f) => f.status !== 'unscored');
  const earnedSum = scored.reduce((a, f) => a + f.earned, 0);
  const maxSum = scored.reduce((a, f) => a + f.max, 0);
  const score = clamp(Math.round((earnedSum / maxSum) * 100), 0, 100);

  return { score, level: levelFor(score), factors };
}
