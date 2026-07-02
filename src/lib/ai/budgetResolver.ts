/**
 * Budget Resolver — ADR-025
 *
 * The single source of truth for "what is this category's budget".
 * Every engine/route that needs a budget MUST resolve it here — never choose
 * between an explicit limit and the historical average inline (ADR-025 invariant).
 *
 * Pure module: no Supabase, no side effects.
 */

export type BudgetSource = 'explicit' | 'historical_average';

export interface ResolvedBudget {
  amount: number;
  source: BudgetSource;
}

export interface ResolveBudgetInput {
  /** The user-set monthly limit for the category, if any */
  explicitLimit?: number | null;
  /** 3-month rolling average monthly spend (0 = no history) */
  threeMonthAverage: number;
}

/**
 * Resolves a category's budget: the explicit limit when one is set,
 * otherwise the historical average (today's zero-config behavior).
 *
 * A resolved amount of 0 means "no baseline" to every consumer (no nudge,
 * no at-risk flag, no status). Zero explicit limits are rejected at the API
 * (PUT /api/budgets requires a positive amount) so the surfaces never disagree.
 */
export function resolveBudget(input: ResolveBudgetInput): ResolvedBudget {
  const { explicitLimit, threeMonthAverage } = input;

  if (explicitLimit !== undefined && explicitLimit !== null) {
    return { amount: explicitLimit, source: 'explicit' };
  }

  return { amount: threeMonthAverage, source: 'historical_average' };
}

export type BudgetStatus = 'ok' | 'warning' | 'over';

/** Shared thresholds so the Budget Health card, nudges, and forecasts agree. */
export const BUDGET_WARNING_THRESHOLD = 0.8;

/**
 * Classifies month-to-date spend against a budget amount.
 * ok < 80% <= warning <= 100% < over. A zero budget with any spend is 'over'.
 */
export function budgetStatusFor(spent: number, budgetAmount: number): BudgetStatus {
  if (budgetAmount <= 0) {
    return spent > 0 ? 'over' : 'ok';
  }
  const ratio = spent / budgetAmount;
  if (ratio > 1) return 'over';
  if (ratio >= BUDGET_WARNING_THRESHOLD) return 'warning';
  return 'ok';
}
