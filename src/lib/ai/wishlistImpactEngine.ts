/**
 * Wishlist Impact Engine — Story 14.3 (FR15)
 *
 * Pure computation of a wishlist item's projected impact on the current month's
 * remaining budget and the nearest savings goal. Epic-12 style: typed input →
 * typed output, no Supabase, no currency formatting, no user-facing text
 * (the card renders copy; names/numbers/flags only).
 *
 * Budget note (ADR-025): only an EXPLICIT category budget is meaningful here —
 * a wishlist purchase isn't spend yet, so comparing it to the historical-average
 * fallback would tell the user nothing intentional. The route passes the explicit
 * `category_budgets` row only; there is deliberately no resolveBudget fallback.
 */

import type { WishlistItemImpact } from '@/types/database.types';

export interface WishlistImpactInput {
  price: number;
  /** Current-month income total (preferred currency) */
  monthIncome: number;
  /** Current-month expense total (preferred currency) */
  monthExpenses: number;
  /** Explicit budget of the linked category, if any */
  categoryBudget?: {
    categoryName: string;
    limitAmount: number;
    /** Current-month spend already recorded against the category */
    spent: number;
  } | null;
  /** The active goal with the soonest future deadline and unmet target, if any */
  nearestGoal?: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    /** DATE string YYYY-MM-DD */
    deadline: string;
  } | null;
  /** Highest-priority value mapped to the linked category, if any */
  alignedValueName?: string | null;
  today: Date;
}

const MS_PER_DAY = 86_400_000;

/** Parse a YYYY-MM-DD DATE string as LOCAL midnight — never new Date('YYYY-MM-DD')
 *  (UTC-midnight parse misdates by a day in non-UTC timezones; 14-2 review lesson). */
function parseLocalDate(dateString: string): Date | null {
  const [y, m, d] = dateString.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeWishlistImpact(input: WishlistImpactInput): WishlistItemImpact {
  const { price, monthIncome, monthExpenses, categoryBudget, nearestGoal, alignedValueName, today } = input;

  // Month balance impact — always present
  const monthBalanceAfter = round2(monthIncome - monthExpenses - price);

  // Category budget impact — explicit budgets only (see module docblock)
  let budgetImpact: WishlistItemImpact['category_budget'] = null;
  if (categoryBudget) {
    const remainingAfter = round2(categoryBudget.limitAmount - categoryBudget.spent - price);
    budgetImpact = {
      category_name: categoryBudget.categoryName,
      limit_amount: categoryBudget.limitAmount,
      remaining_after: remainingAfter,
      exceeds_budget: remainingAfter < 0,
    };
  }

  // Goal delay — delayDays = ceil(price / dailyRequired)
  let goalDelay: WishlistItemImpact['goal_delay'] = null;
  if (nearestGoal) {
    const deadline = parseLocalDate(nearestGoal.deadline);
    const remainingToTarget = nearestGoal.targetAmount - nearestGoal.currentAmount;
    if (deadline && remainingToTarget > 0) {
      const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const daysToDeadline = Math.ceil((deadline.getTime() - todayLocal.getTime()) / MS_PER_DAY);
      if (daysToDeadline > 0) {
        const dailyRequired = remainingToTarget / daysToDeadline;
        goalDelay = {
          goal_name: nearestGoal.name,
          delay_days: Math.ceil(price / dailyRequired),
        };
      }
    }
  }

  return {
    month_balance_after: monthBalanceAfter,
    category_budget: budgetImpact,
    goal_delay: goalDelay,
    aligned_value: alignedValueName ?? null,
  };
}
