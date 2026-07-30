/**
 * Wishlist Impact Engine Tests — Story 14.3
 * Pure unit tests — no mocks needed.
 * Fixed reference: today = 2026-07-02.
 */

import { computeWishlistImpact, WISHLIST_MAX_DELAY_DAYS } from '../wishlistImpactEngine';

const TODAY = new Date(2026, 6, 2); // 2026-07-02 local

const BASE = {
  price: 100,
  monthIncome: 2000,
  monthExpenses: 1500,
  today: TODAY,
};

describe('computeWishlistImpact', () => {
  describe('month balance (always present)', () => {
    it('computes income − expenses − price', () => {
      const impact = computeWishlistImpact(BASE);
      expect(impact.month_balance_after).toBe(400); // 2000 - 1500 - 100
    });

    it('goes negative when the purchase exceeds the month surplus', () => {
      const impact = computeWishlistImpact({ ...BASE, price: 600 });
      expect(impact.month_balance_after).toBe(-100);
    });

    it('handles a zero-config month (no income/expenses)', () => {
      const impact = computeWishlistImpact({ ...BASE, monthIncome: 0, monthExpenses: 0 });
      expect(impact.month_balance_after).toBe(-100);
      expect(impact.category_budget).toBeNull();
      expect(impact.goal_delay).toBeNull();
      expect(impact.aligned_value).toBeNull();
    });

    it('rounds to 2 decimals', () => {
      const impact = computeWishlistImpact({
        ...BASE,
        monthIncome: 100.111,
        monthExpenses: 50.055,
        price: 10.01,
      });
      expect(impact.month_balance_after).toBe(40.05);
    });

    it('normalizes -0 so the UI never renders "-€0.00"', () => {
      // 100 − 50 − 50.001 = −0.001 → rounds to −0 → normalized to 0
      const impact = computeWishlistImpact({
        ...BASE,
        monthIncome: 100,
        monthExpenses: 50,
        price: 50.001,
      });
      expect(Object.is(impact.month_balance_after, -0)).toBe(false);
      expect(impact.month_balance_after).toBe(0);
    });

    it('handles the minimum price granularity (0.01)', () => {
      const impact = computeWishlistImpact({ ...BASE, price: 0.01 });
      expect(impact.month_balance_after).toBe(499.99);
    });
  });

  describe('category budget impact (explicit budgets only)', () => {
    it('reports remaining budget after the purchase', () => {
      const impact = computeWishlistImpact({
        ...BASE,
        categoryBudget: { categoryName: 'Electronics', limitAmount: 300, spent: 120 },
      });
      expect(impact.category_budget).toEqual({
        category_name: 'Electronics',
        limit_amount: 300,
        remaining_after: 80, // 300 - 120 - 100
        exceeds_budget: false,
      });
    });

    it('flags when the purchase exceeds the budget', () => {
      const impact = computeWishlistImpact({
        ...BASE,
        price: 250,
        categoryBudget: { categoryName: 'Electronics', limitAmount: 300, spent: 120 },
      });
      expect(impact.category_budget!.remaining_after).toBe(-70);
      expect(impact.category_budget!.exceeds_budget).toBe(true);
    });

    it('is null when no category budget is provided', () => {
      expect(computeWishlistImpact(BASE).category_budget).toBeNull();
      expect(computeWishlistImpact({ ...BASE, categoryBudget: null }).category_budget).toBeNull();
    });
  });

  describe('goal delay', () => {
    // 2026-07-02 → 2026-08-01 is 30 days out
    const GOAL = { name: 'Vacation', targetAmount: 1300, currentAmount: 1000, deadline: '2026-08-01' };

    it('caps an absurd delay and flags it, rather than printing 30,000 days', () => {
      // A goal 1 cent short with a distant deadline: dailyRequired is minuscule,
      // so price / dailyRequired runs away. Correct arithmetic, useless copy.
      const impact = computeWishlistImpact({
        ...BASE,
        price: 100,
        nearestGoal: {
          ...GOAL,
          targetAmount: 1000,
          currentAmount: 999.99,
          deadline: '2030-01-01',
        },
      });

      expect(impact.goal_delay).not.toBeNull();
      expect(impact.goal_delay!.exceeds_cap).toBe(true);
      // Clamped, never the raw runaway figure.
      expect(impact.goal_delay!.delay_days).toBe(WISHLIST_MAX_DELAY_DAYS);
    });

    it('leaves a delay at the cap boundary unflagged', () => {
      const impact = computeWishlistImpact({ ...BASE, nearestGoal: GOAL });
      expect(impact.goal_delay!.delay_days).toBeLessThanOrEqual(WISHLIST_MAX_DELAY_DAYS);
      expect(impact.goal_delay!.exceeds_cap).toBe(false);
    });

    it('computes delayDays = ceil(price / dailyRequired)', () => {
      // remaining 300 over 30 days → 10/day; 100 / 10 = 10 days
      const impact = computeWishlistImpact({ ...BASE, nearestGoal: GOAL });
      expect(impact.goal_delay).toEqual({
        goal_name: 'Vacation',
        delay_days: 10,
        exceeds_cap: false,
      });
    });

    it('ceils fractional delays', () => {
      // 105 / 10 = 10.5 → 11 days
      const impact = computeWishlistImpact({ ...BASE, price: 105, nearestGoal: GOAL });
      expect(impact.goal_delay!.delay_days).toBe(11);
    });

    it('is null when the goal target is already met', () => {
      const impact = computeWishlistImpact({
        ...BASE,
        nearestGoal: { ...GOAL, currentAmount: 1300 },
      });
      expect(impact.goal_delay).toBeNull();
    });

    it('is null when the deadline has passed', () => {
      const impact = computeWishlistImpact({
        ...BASE,
        nearestGoal: { ...GOAL, deadline: '2026-07-01' },
      });
      expect(impact.goal_delay).toBeNull();
    });

    it('is null when the deadline is today (zero days remaining)', () => {
      const impact = computeWishlistImpact({
        ...BASE,
        nearestGoal: { ...GOAL, deadline: '2026-07-02' },
      });
      expect(impact.goal_delay).toBeNull();
    });

    it('is null when no goal is provided', () => {
      expect(computeWishlistImpact(BASE).goal_delay).toBeNull();
      expect(computeWishlistImpact({ ...BASE, nearestGoal: null }).goal_delay).toBeNull();
    });

    it('is null for a malformed deadline string', () => {
      const impact = computeWishlistImpact({
        ...BASE,
        nearestGoal: { ...GOAL, deadline: 'not-a-date' },
      });
      expect(impact.goal_delay).toBeNull();
    });
  });

  describe('value alignment (pass-through)', () => {
    it('carries the aligned value name', () => {
      const impact = computeWishlistImpact({ ...BASE, alignedValueName: 'Health' });
      expect(impact.aligned_value).toBe('Health');
    });

    it('is null when absent', () => {
      expect(computeWishlistImpact(BASE).aligned_value).toBeNull();
      expect(computeWishlistImpact({ ...BASE, alignedValueName: null }).aligned_value).toBeNull();
    });
  });
});
