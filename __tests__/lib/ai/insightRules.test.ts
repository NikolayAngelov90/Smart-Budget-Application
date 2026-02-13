/**
 * Unit tests for Insight Rules Engine
 */

import { subMonths, subDays, format } from 'date-fns';
import {
  detectSpendingIncrease,
  recommendBudgetLimit,
  flagUnusualExpense,
  generatePositiveReinforcement,
  executeRulesForCategory,
} from '@/lib/ai/insightRules';
import type { Transaction, InsightMetadata } from '@/types/database.types';

// Helper to create mock transactions
function createMockTransaction(
  amount: number,
  date: Date,
  categoryId: string = 'cat-1',
  userId: string = 'user-1'
): Transaction {
  return {
    id: `tx-${Math.random()}`,
    user_id: userId,
    category_id: categoryId,
    amount,
    type: 'expense',
    date: format(date, 'yyyy-MM-dd'),
    notes: null,
    currency: 'EUR',
    exchange_rate: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('detectSpendingIncrease', () => {
  const currentMonth = new Date('2025-01-15');
  const userId = 'user-1';
  const categoryId = 'cat-dining';
  const categoryName = 'Dining';

  it('should detect 25% spending increase (above 20% threshold)', () => {
    // Previous month: $400, Current month: $500 = 25% increase
    const transactions: Transaction[] = [
      createMockTransaction(200, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(200, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(250, currentMonth, categoryId),
      createMockTransaction(250, currentMonth, categoryId),
    ];

    const result = detectSpendingIncrease({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('spending_increase');
    expect(result!.priority).toBe(4);
    expect(result!.title).toContain('25%');
    expect((result!.metadata as InsightMetadata).percent_change).toBe(25);
  });

  it('should NOT trigger for exactly 20% increase (threshold boundary)', () => {
    // Previous month: $500, Current month: $600 = exactly 20%
    const transactions: Transaction[] = [
      createMockTransaction(500, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(600, currentMonth, categoryId),
    ];

    const result = detectSpendingIncrease({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).toBeNull();
  });

  it('should NOT trigger for 15% increase (below threshold)', () => {
    // Previous month: $400, Current month: $460 = 15% increase
    const transactions: Transaction[] = [
      createMockTransaction(400, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(460, currentMonth, categoryId),
    ];

    const result = detectSpendingIncrease({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).toBeNull();
  });

  it('should NOT trigger for spending decrease', () => {
    const transactions: Transaction[] = [
      createMockTransaction(500, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(300, currentMonth, categoryId),
    ];

    const result = detectSpendingIncrease({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).toBeNull();
  });

  it('should return null if no previous month data', () => {
    const transactions: Transaction[] = [
      createMockTransaction(500, currentMonth, categoryId),
    ];

    const result = detectSpendingIncrease({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).toBeNull();
  });

  it('should use coaching tone in description', () => {
    const transactions: Transaction[] = [
      createMockTransaction(340, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(480, currentMonth, categoryId),
    ];

    const result = detectSpendingIncrease({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).not.toBeNull();
    expect(result!.description).toContain('Consider reviewing');
    expect(result!.description).not.toContain('overspent');
    expect(result!.description).not.toContain('failed');
  });
});

describe('recommendBudgetLimit', () => {
  const currentMonth = new Date('2025-01-15');
  const userId = 'user-1';
  const categoryId = 'cat-dining';
  const categoryName = 'Dining';

  it('should recommend budget with 3 months of data', () => {
    // Last 3 months: Current month (Jan), -1 month (Dec), -2 months (Nov)
    // $300 + $340 + $360 = $1000 / 3 = $333.33 => recommend $367 (with 10% buffer)
    // Need at least 5 transactions for the rule to trigger
    const transactions: Transaction[] = [
      createMockTransaction(300, subMonths(currentMonth, 2), categoryId), // Nov
      createMockTransaction(340, subMonths(currentMonth, 1), categoryId), // Dec
      createMockTransaction(100, subMonths(currentMonth, 1), categoryId), // Dec
      createMockTransaction(360, currentMonth, categoryId), // Jan
      createMockTransaction(100, currentMonth, categoryId), // Jan
    ];

    const result = recommendBudgetLimit({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('budget_recommendation');
    expect(result!.priority).toBe(3);
    // Avg of $300, $440, $460 = $400, with 10% buffer = $440
    expect((result!.metadata as InsightMetadata).recommended_budget).toBe(440);
  });

  it('should return null with insufficient data (< 5 transactions)', () => {
    const transactions: Transaction[] = [
      createMockTransaction(300, subMonths(currentMonth, 2), categoryId),
      createMockTransaction(340, subMonths(currentMonth, 1), categoryId),
    ];

    const result = recommendBudgetLimit({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).toBeNull();
  });

  it('should return null if recommended budget is too small (< $20)', () => {
    const transactions: Transaction[] = [
      createMockTransaction(5, subMonths(currentMonth, 3), categoryId),
      createMockTransaction(5, subMonths(currentMonth, 2), categoryId),
      createMockTransaction(5, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(5, currentMonth, categoryId),
      createMockTransaction(5, currentMonth, categoryId),
    ];

    const result = recommendBudgetLimit({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).toBeNull();
  });

  it('should return null if current budget is already close to recommendation', () => {
    const transactions: Transaction[] = [
      createMockTransaction(300, subMonths(currentMonth, 3), categoryId),
      createMockTransaction(340, subMonths(currentMonth, 2), categoryId),
      createMockTransaction(360, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(100, currentMonth, categoryId),
      createMockTransaction(100, currentMonth, categoryId),
    ];

    const result = recommendBudgetLimit({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
      currentBudget: 365, // Very close to recommended ~367
    });

    expect(result).toBeNull();
  });

  it('should use supportive tone in description', () => {
    const transactions: Transaction[] = [
      createMockTransaction(300, subMonths(currentMonth, 2), categoryId),
      createMockTransaction(340, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(100, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(360, currentMonth, categoryId),
      createMockTransaction(100, currentMonth, categoryId),
    ];

    const result = recommendBudgetLimit({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(result).not.toBeNull();
    expect(result!.description).toContain('consider');
    expect(result!.description).toContain('comfortable');
  });
});

describe('flagUnusualExpense', () => {
  const userId = 'user-1';
  const categoryId = 'cat-shopping';
  const categoryName = 'Shopping';

  it('should flag transaction 3 standard deviations from mean', () => {
    // Mean: ~50, StdDev: ~15, Outlier: 500 (30 stdDevs away)
    const transactions: Transaction[] = [
      ...Array(10).fill(0).map((_, i) => createMockTransaction(50, subDays(new Date(), i * 7), categoryId)),
      createMockTransaction(500, new Date(), categoryId), // Huge outlier
    ];

    const result = flagUnusualExpense({
      userId,
      categoryId,
      categoryName,
      transactions,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('unusual_expense');
    expect(result!.priority).toBe(5);
    expect((result!.metadata as InsightMetadata).transaction_amount).toBe(500);
  });

  it('should NOT flag transaction within 2 standard deviations', () => {
    // All values close to mean, no outliers
    const transactions: Transaction[] = Array(15).fill(0).map((_, i) =>
      createMockTransaction(50 + (i % 3) * 5, subDays(new Date(), i * 7), categoryId)
    );

    const result = flagUnusualExpense({
      userId,
      categoryId,
      categoryName,
      transactions,
    });

    expect(result).toBeNull();
  });

  it('should return null with insufficient data (< 10 transactions)', () => {
    const transactions: Transaction[] = [
      createMockTransaction(50, new Date(), categoryId),
      createMockTransaction(500, new Date(), categoryId),
    ];

    const result = flagUnusualExpense({
      userId,
      categoryId,
      categoryName,
      transactions,
    });

    expect(result).toBeNull();
  });

  it('should use concerned but supportive tone', () => {
    const transactions: Transaction[] = [
      ...Array(10).fill(0).map((_, i) => createMockTransaction(50, subDays(new Date(), i * 7), categoryId)),
      createMockTransaction(500, new Date(), categoryId),
    ];

    const result = flagUnusualExpense({
      userId,
      categoryId,
      categoryName,
      transactions,
    });

    expect(result).not.toBeNull();
    expect(result!.description).toContain('noticed');
    expect(result!.description).toContain('might want to review');
    expect(result!.description).not.toContain('error');
    expect(result!.description).not.toContain('mistake');
  });
});

describe('generatePositiveReinforcement', () => {
  const currentMonth = new Date('2025-01-15');
  const userId = 'user-1';
  const categoryId = 'cat-transport';
  const categoryName = 'Transport';

  it('should generate positive feedback for 89% budget usage (below 90% threshold)', () => {
    const budget = 100;
    const transactions: Transaction[] = [
      createMockTransaction(89, currentMonth, categoryId),
    ];

    const result = generatePositiveReinforcement({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
      currentBudget: budget,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('positive_reinforcement');
    expect(result!.priority).toBe(2);
    expect(result!.title).toContain('Great job');
    expect((result!.metadata as InsightMetadata).savings_amount).toBe(11);
  });

  it('should NOT trigger for 91% budget usage (above 90% threshold)', () => {
    const budget = 100;
    const transactions: Transaction[] = [
      createMockTransaction(91, currentMonth, categoryId),
    ];

    const result = generatePositiveReinforcement({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
      currentBudget: budget,
    });

    expect(result).toBeNull();
  });

  it('should return null if no budget is set', () => {
    const transactions: Transaction[] = [
      createMockTransaction(50, currentMonth, categoryId),
    ];

    const result = generatePositiveReinforcement({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
      currentBudget: undefined,
    });

    expect(result).toBeNull();
  });

  it('should return null if no transactions in current month', () => {
    const transactions: Transaction[] = [
      createMockTransaction(50, subMonths(currentMonth, 1), categoryId),
    ];

    const result = generatePositiveReinforcement({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
      currentBudget: 100,
    });

    expect(result).toBeNull();
  });

  it('should use enthusiastic, encouraging tone', () => {
    const transactions: Transaction[] = [
      createMockTransaction(70, currentMonth, categoryId),
    ];

    const result = generatePositiveReinforcement({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
      currentBudget: 100,
    });

    expect(result).not.toBeNull();
    expect(result!.description).toContain('Great job');
    expect(result!.description).toContain('Keep up');
    expect(result!.description).toContain('excellent');
  });
});

describe('executeRulesForCategory', () => {
  const currentMonth = new Date('2025-01-15');
  const userId = 'user-1';
  const categoryId = 'cat-dining';
  const categoryName = 'Dining';

  it('should execute all applicable rules', () => {
    // Create scenario where multiple rules might trigger
    const transactions: Transaction[] = [
      // 3 months ago
      createMockTransaction(300, subMonths(currentMonth, 3), categoryId),
      createMockTransaction(50, subMonths(currentMonth, 3), categoryId),
      // 2 months ago
      createMockTransaction(340, subMonths(currentMonth, 2), categoryId),
      createMockTransaction(50, subMonths(currentMonth, 2), categoryId),
      // 1 month ago
      createMockTransaction(300, subMonths(currentMonth, 1), categoryId),
      createMockTransaction(50, subMonths(currentMonth, 1), categoryId),
      // Current month
      createMockTransaction(400, currentMonth, categoryId), // Increase from last month
      createMockTransaction(50, currentMonth, categoryId),
    ];

    const results = executeRulesForCategory({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
      currentBudget: 500,
    });

    // Should get multiple insights
    expect(results.length).toBeGreaterThan(0);

    // Check that returned insights have required fields
    results.forEach((insight) => {
      expect(insight.user_id).toBe(userId);
      expect(insight.type).toBeDefined();
      expect(insight.priority).toBeGreaterThan(0);
      expect(insight.title).toBeTruthy();
      expect(insight.description).toBeTruthy();
    });
  });

  it('should return empty array if no rules trigger', () => {
    // Minimal data that won't trigger any rules
    const transactions: Transaction[] = [
      createMockTransaction(100, currentMonth, categoryId),
    ];

    const results = executeRulesForCategory({
      userId,
      categoryId,
      categoryName,
      transactions,
      currentMonth,
    });

    expect(results).toEqual([]);
  });
});
