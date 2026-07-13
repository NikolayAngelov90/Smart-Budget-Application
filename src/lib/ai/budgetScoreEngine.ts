/**
 * Budget Score Engine — Story 15.2 (FR29)
 *
 * Pure, deterministic 0-100 financial-health score from three factors:
 * budget adherence (50), logging consistency (30), goal progress (20).
 * Client-import-safe (no DB, no node APIs, no currency formatting — the
 * Epic-12/whatIfEngine/streakEngine precedent). The engine returns numbers
 * and enums only; ALL user-facing text is i18n keys in the component.
 *
 * Factors whose inputs don't exist yet — or are UNKNOWABLE (streak data
 * unavailable) — are UNSCORED and the score renormalizes over the scored
 * weights: missing budgets, goals, or a broken streaks table must never
 * punish (no-guilt UX + degradation policy). Score computed read-time;
 * no persistence (documented ADR-012 deviation, see story Dev Notes).
 *
 * Adherence scores ACTUAL month-to-date spend against the resolved budget
 * (review decision 2026-07-13): pace projection punished on-budget lumpy
 * spending (rent paid on the 1st), and early warning is already the job of
 * nudges + BudgetForecast. Categories without spend this month are skipped
 * (forecastEngine precedent) — dormant categories neither help nor hurt.
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
  /** Streak row from 15.1, or null when the user has no row yet */
  streak: StreakState | null;
  /**
   * True when streak state could not be READ (e.g. migration 034 unapplied).
   * Unknowable ≠ zero: consistency goes UNSCORED instead of scoring 0
   * ("hurting") for an infra failure — degradation policy.
   */
  streakUnavailable?: boolean;
  today: Date;
}

// Factor weights — Σ = 100 when all three are scored
export const ADHERENCE_MAX = 50;
export const CONSISTENCY_MAX = 30;
export const GOALS_MAX = 20;

// Factor status thresholds (share of the factor's max)
export const HELPING_THRESHOLD = 0.7;
export const HURTING_THRESHOLD = 0.4;

// Adherence: sub-score 1 while spent/budget <= 1, 0 at >= ADHERENCE_RATIO_CEILING
export const ADHERENCE_RATIO_CEILING = 1.5;

// Consistency: daily streak capped at 30 days (20 pts), weekly at 8 weeks (10 pts)
export const DAILY_STREAK_CAP = 30;
export const WEEKLY_STREAK_CAP = 8;
const DAILY_POINTS = 20;
const WEEKLY_POINTS = 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Round to one decimal — the display precision factors carry */
const roundTenth = (v: number) => Math.round(v * 10) / 10;

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
 * Budget adherence (0..50), or null when no ACTIVE category has a resolvable
 * budget. Per category with MTD spend and a budget: ratio = spent / budget;
 * sub-score 1 while <=1, 0 at >=1.5, linear between. Zero-spend categories
 * are skipped (forecastEngine precedent) — an untouched seasonal category
 * must not hand out free perfect sub-scores that dilute real overspend.
 */
function adherenceEarned(input: BudgetScoreInput): number | null {
  const { currentMonthTransactions, historicalTransactions, categories, explicitBudgets } = input;

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

  const subScores: number[] = [];
  for (const category of categories) {
    const spent = currentSpend.get(category.id) ?? 0;
    if (spent <= 0) continue; // dormant this month — neither helps nor hurts

    const monthTotals = Array.from(historicalMonthMap.get(category.id)?.values() ?? []);
    // ADR-025: the resolver is the ONLY explicit-vs-average chooser
    const resolved = resolveBudget({
      explicitLimit: explicitBudgets.get(category.id) ?? null,
      threeMonthAverage: fixedWindowMonthlyAverage(monthTotals),
    });
    if (resolved.amount <= 0) continue; // 0 = "no baseline" to every consumer

    const ratio = spent / resolved.amount;
    subScores.push(clamp((ADHERENCE_RATIO_CEILING - ratio) / (ADHERENCE_RATIO_CEILING - 1), 0, 1));
  }

  if (subScores.length === 0) return null; // unscored — nothing budgeted is active yet
  const mean = subScores.reduce((a, b) => a + b, 0) / subScores.length;
  return mean * ADHERENCE_MAX;
}

/**
 * Logging consistency (0..30), or null when unknowable. Scored — including a
 * legitimate 0 — whenever streak state was readable and the user has logged
 * before (a streak row or any transaction history): absence of logging is
 * knowable. Unscored when the streak read failed (never punish an infra
 * error) or the user has never logged anything. A broken streak earns 0
 * (same invariant as the badge hiding dead streaks).
 */
function consistencyEarned(input: BudgetScoreInput): number | null {
  const { streak, streakUnavailable, today } = input;
  if (streakUnavailable) return null;
  const hasLogged =
    streak !== null ||
    input.currentMonthTransactions.length > 0 ||
    input.historicalTransactions.length > 0;
  if (!hasLogged) return null;
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

function toFactor(key: ScoreFactor['key'], raw: number | null, max: number): ScoreFactor {
  if (raw === null) return { key, earned: 0, max, status: 'unscored' };
  // Status derives from the same rounded value the breakdown displays, so
  // "35/50" can never carry a tag that contradicts the visible number
  const earned = roundTenth(raw);
  return { key, earned, max, status: statusFor(earned, max) };
}

/**
 * Computes the Budget Score. Returns null when NO factor is scored
 * (the route pairs that with hasData:false).
 */
export function computeBudgetScore(input: BudgetScoreInput): BudgetScore | null {
  const raw: Array<[ScoreFactor['key'], number | null, number]> = [
    ['adherence', adherenceEarned(input), ADHERENCE_MAX],
    ['consistency', consistencyEarned(input), CONSISTENCY_MAX],
    ['goals', goalsEarned(input.goals), GOALS_MAX],
  ];

  const factors: ScoreFactor[] = raw.map(([key, value, max]) => toFactor(key, value, max));

  // Renormalize over scored weights only — unscored factors neither help nor
  // hurt. The 0-100 score sums the RAW values (display rounding must not be
  // able to flip a level band edge).
  const scored = raw.filter(([, value]) => value !== null);
  if (scored.length === 0) return null;
  const earnedSum = scored.reduce((a, [, value]) => a + (value as number), 0);
  const maxSum = scored.reduce((a, [, , max]) => a + max, 0);
  const score = clamp(Math.round((earnedSum / maxSum) * 100), 0, 100);

  return { score, level: levelFor(score), factors };
}
