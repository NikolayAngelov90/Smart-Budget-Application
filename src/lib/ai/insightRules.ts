/**
 * Insight Rules Engine
 *
 * Implements 4 rule types for generating personalized budget insights:
 * 1. Spending Increase Detection (Priority 4 - High)
 * 2. Budget Limit Recommendations (Priority 3 - Medium)
 * 3. Unusual Expense Flagging (Priority 5 - Critical)
 * 4. Positive Reinforcement (Priority 2 - Low)
 *
 * All insights use a friendly, coaching tone.
 */

import { startOfMonth, endOfMonth, subMonths, format, parseISO } from 'date-fns';
import {
  calculateMean,
  calculateStdDev,
  calculateMonthOverMonth,
  isOutlier,
} from './spendingAnalysis';
import type {
  Transaction,
  InsightInsert,
  InsightMetadata,
} from '@/types/database.types';

// ============================================================================
// TYPES
// ============================================================================

export interface RuleInput {
  userId: string;
  categoryId: string;
  categoryName: string;
  transactions: Transaction[];
  currentMonth?: Date;
}

export interface BudgetRuleInput extends RuleInput {
  currentBudget?: number; // Optional current budget for the category
}

// ============================================================================
// RULE 1: SPENDING INCREASE DETECTION (Priority 4 - High)
// ============================================================================

/**
 * Detects significant spending increases (>20%) month-over-month
 *
 * Triggers when category spending is more than 20% higher than previous month.
 * Uses encouraging, non-judgmental language.
 *
 * @example
 * "Your Dining spending increased by 40% this month ($480 vs $340 last month).
 *  Consider reviewing recent expenses to see if this aligns with your goals."
 */
export function detectSpendingIncrease(input: RuleInput): InsightInsert | null {
  const { userId, categoryId, categoryName, transactions, currentMonth = new Date() } = input;

  // Filter transactions for current month
  const currentMonthStart = startOfMonth(currentMonth);
  const currentMonthEnd = endOfMonth(currentMonth);

  const currentMonthTransactions = transactions.filter((t) => {
    const txDate = parseISO(t.date);
    return txDate >= currentMonthStart && txDate <= currentMonthEnd;
  });

  // Filter transactions for previous month
  const previousMonthStart = startOfMonth(subMonths(currentMonth, 1));
  const previousMonthEnd = endOfMonth(subMonths(currentMonth, 1));

  const previousMonthTransactions = transactions.filter((t) => {
    const txDate = parseISO(t.date);
    return txDate >= previousMonthStart && txDate <= previousMonthEnd;
  });

  // Need data from both months
  if (currentMonthTransactions.length === 0 || previousMonthTransactions.length === 0) {
    return null;
  }

  // Calculate totals
  const currentAmount = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
  const previousAmount = previousMonthTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Calculate percentage change
  const percentChange = calculateMonthOverMonth(currentAmount, previousAmount);

  // Trigger threshold: >20% increase
  if (percentChange <= 20) {
    return null;
  }

  // Generate insight with coaching tone
  const metadata: InsightMetadata = {
    category_id: categoryId,
    category_name: categoryName,
    current_amount: currentAmount,
    previous_amount: previousAmount,
    percent_change: Math.round(percentChange * 10) / 10,
    transaction_count_current: currentMonthTransactions.length,
    transaction_count_previous: previousMonthTransactions.length,
    current_month: format(currentMonth, 'yyyy-MM'),
    previous_month: format(subMonths(currentMonth, 1), 'yyyy-MM'),
  };

  return {
    user_id: userId,
    type: 'spending_increase',
    priority: 4, // High priority
    title: `${categoryName} spending increased ${Math.round(percentChange)}%`,
    description: `Your ${categoryName} spending increased by ${Math.round(percentChange)}% this month ($${currentAmount.toFixed(0)} vs $${previousAmount.toFixed(0)} last month). Consider reviewing recent expenses to see if this aligns with your goals.`,
    metadata,
    is_dismissed: false,
  };
}

// ============================================================================
// RULE 2: BUDGET LIMIT RECOMMENDATIONS (Priority 3 - Medium)
// ============================================================================

/**
 * Recommends budget limits based on 3-month average + 10% buffer
 *
 * Analyzes last 3 months of spending and suggests a realistic budget.
 * Uses supportive, guidance-oriented language.
 *
 * @example
 * "Based on your 3-month average of $340, consider setting a $375 budget for Dining.
 *  This gives you a comfortable 10% buffer while keeping spending mindful."
 */
export function recommendBudgetLimit(input: BudgetRuleInput): InsightInsert | null {
  const { userId, categoryId, categoryName, transactions, currentMonth = new Date(), currentBudget } = input;

  // Need at least 3 months of data
  const threeMonthsAgo = subMonths(currentMonth, 3);

  const recentTransactions = transactions.filter((t) => {
    const txDate = parseISO(t.date);
    return txDate >= threeMonthsAgo && txDate <= endOfMonth(currentMonth);
  });

  // Need sufficient data (at least 5 transactions across 3 months)
  if (recentTransactions.length < 5) {
    return null;
  }

  // Calculate monthly spending for last 3 months
  const monthlyTotals: number[] = [];
  const monthsAnalyzed: string[] = [];

  for (let i = 0; i < 3; i++) {
    const month = subMonths(currentMonth, i);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    const monthTransactions = recentTransactions.filter((t) => {
      const txDate = parseISO(t.date);
      return txDate >= monthStart && txDate <= monthEnd;
    });

    if (monthTransactions.length > 0) {
      const total = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
      monthlyTotals.push(total);
      monthsAnalyzed.push(format(month, 'yyyy-MM'));
    }
  }

  // Need at least 2 months of data
  if (monthlyTotals.length < 2) {
    return null;
  }

  // Calculate 3-month average
  const averageMonthly = calculateMean(monthlyTotals);

  // Add 10% buffer for recommended budget
  const recommendedBudget = Math.round(averageMonthly * 1.1);

  // Don't generate if recommended budget is very small (< $20) or if they already have a similar budget
  if (recommendedBudget < 20) {
    return null;
  }

  if (currentBudget && Math.abs(recommendedBudget - currentBudget) < currentBudget * 0.15) {
    return null; // Budget is already close to recommendation (within 15%)
  }

  const metadata: InsightMetadata = {
    category_id: categoryId,
    category_name: categoryName,
    three_month_average: Math.round(averageMonthly),
    recommended_budget: recommendedBudget,
    calculation_explanation: `Based on 3-month average of $${Math.round(averageMonthly)} + 10% buffer`,
    months_analyzed: monthsAnalyzed,
  };

  return {
    user_id: userId,
    type: 'budget_recommendation',
    priority: 3, // Medium priority
    title: `Consider a $${recommendedBudget} budget for ${categoryName}`,
    description: `Based on your 3-month average of $${Math.round(averageMonthly)}, consider setting a $${recommendedBudget} budget for ${categoryName}. This gives you a comfortable 10% buffer while keeping spending mindful.`,
    metadata,
    is_dismissed: false,
  };
}

// ============================================================================
// RULE 3: UNUSUAL EXPENSE FLAGGING (Priority 5 - Critical)
// ============================================================================

/**
 * Flags transactions that are >2 standard deviations from category mean
 *
 * Detects outlier expenses that might need attention.
 * Uses concerned but supportive language.
 *
 * @example
 * "We noticed an unusual Shopping expense of $500 - much higher than your typical $50.
 *  You might want to review this transaction to make sure everything looks right."
 */
export function flagUnusualExpense(input: RuleInput): InsightInsert | null {
  const { userId, categoryId, categoryName, transactions } = input;

  // Need at least 10 transactions for meaningful statistics
  if (transactions.length < 10) {
    return null;
  }

  // Calculate mean and standard deviation for all transactions
  const amounts = transactions.map((t) => t.amount);
  const mean = calculateMean(amounts);
  const stdDev = calculateStdDev(amounts, mean);

  // Find outlier transactions (>2 standard deviations)
  const outliers = transactions.filter((t) => isOutlier(t.amount, mean, stdDev, 2));

  if (outliers.length === 0) {
    return null;
  }

  // Get the most recent/largest outlier
  const mostSignificantOutlier = outliers.reduce((max, t) =>
    t.amount > max.amount ? t : max
  );

  const metadata: InsightMetadata = {
    category_id: categoryId,
    category_name: categoryName,
    transaction_amount: mostSignificantOutlier.amount,
    category_average: Math.round(mean),
    standard_deviation: Math.round(stdDev),
    std_devs_from_mean: Math.round((mostSignificantOutlier.amount - mean) / stdDev * 10) / 10,
    transaction_id: mostSignificantOutlier.id,
    transaction_date: mostSignificantOutlier.date,
  };

  const typicalAmount = Math.round(mean);

  return {
    user_id: userId,
    type: 'unusual_expense',
    priority: 5, // Critical priority
    title: `Unusual ${categoryName} expense: $${mostSignificantOutlier.amount.toFixed(0)}`,
    description: `We noticed an unusual ${categoryName} expense of $${mostSignificantOutlier.amount.toFixed(0)} - much higher than your typical $${typicalAmount}. You might want to review this transaction to make sure everything looks right.`,
    metadata,
    is_dismissed: false,
  };
}

// ============================================================================
// RULE 4: POSITIVE REINFORCEMENT (Priority 2 - Low)
// ============================================================================

/**
 * Celebrates categories where spending is <90% of recommended budget
 *
 * Provides positive feedback for good budget management.
 * Uses enthusiastic, encouraging language.
 *
 * @example
 * "Great job on Transport! You're 30% under budget this month, saving $120.
 *  Keep up the excellent work!"
 */
export function generatePositiveReinforcement(input: BudgetRuleInput): InsightInsert | null {
  const { userId, categoryId, categoryName, transactions, currentMonth = new Date(), currentBudget } = input;

  // Must have a budget set to compare against
  if (!currentBudget || currentBudget <= 0) {
    return null;
  }

  // Filter transactions for current month
  const currentMonthStart = startOfMonth(currentMonth);
  const currentMonthEnd = endOfMonth(currentMonth);

  const currentMonthTransactions = transactions.filter((t) => {
    const txDate = parseISO(t.date);
    return txDate >= currentMonthStart && txDate <= currentMonthEnd;
  });

  // Need at least one transaction
  if (currentMonthTransactions.length === 0) {
    return null;
  }

  // Calculate current spending
  const currentSpending = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Calculate percentage of budget used
  const percentUsed = (currentSpending / currentBudget) * 100;

  // Trigger threshold: <90% of budget (doing well!)
  if (percentUsed >= 90) {
    return null;
  }

  const savings = currentBudget - currentSpending;
  const percentUnder = 100 - percentUsed;

  const metadata: InsightMetadata = {
    category_id: categoryId,
    category_name: categoryName,
    budget_amount: currentBudget,
    actual_spending: Math.round(currentSpending),
    savings_amount: Math.round(savings),
    percent_under_budget: Math.round(percentUnder),
    current_month: format(currentMonth, 'yyyy-MM'),
  };

  return {
    user_id: userId,
    type: 'positive_reinforcement',
    priority: 2, // Low priority (positive message)
    title: `Great job on ${categoryName}!`,
    description: `Great job on ${categoryName}! You're ${Math.round(percentUnder)}% under budget this month, saving $${Math.round(savings)}. Keep up the excellent work!`,
    metadata,
    is_dismissed: false,
  };
}

// ============================================================================
// RULE EXECUTION HELPERS
// ============================================================================

/**
 * Execute all applicable rules for a given category
 *
 * Returns an array of generated insights (may be empty if no rules trigger)
 */
export function executeRulesForCategory(input: BudgetRuleInput): InsightInsert[] {
  const insights: InsightInsert[] = [];

  // Try each rule
  const spendingIncrease = detectSpendingIncrease(input);
  if (spendingIncrease) {
    insights.push(spendingIncrease);
  }

  const budgetRecommendation = recommendBudgetLimit(input);
  if (budgetRecommendation) {
    insights.push(budgetRecommendation);
  }

  const unusualExpense = flagUnusualExpense(input);
  if (unusualExpense) {
    insights.push(unusualExpense);
  }

  const positiveReinforcement = generatePositiveReinforcement(input);
  if (positiveReinforcement) {
    insights.push(positiveReinforcement);
  }

  return insights;
}
