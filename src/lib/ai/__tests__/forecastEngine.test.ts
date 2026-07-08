/**
 * Forecast Engine Tests — Story 12.2
 *
 * Pure unit tests — no mocks needed.
 * Fixed reference: today = 2026-06-10 (day 10 of June, 30-day month)
 *   → daysElapsed=10, daysInMonth=30, daysRemaining=20
 *   → projectedEOM = spentSoFar × 3  (ratio 30/10)
 */

import { computeEndOfMonthForecasts } from '../forecastEngine';
import type { Category, Transaction } from '@/types/database.types';

// ============================================================================
// FIXTURES
// ============================================================================

const TODAY = new Date('2026-06-10');

function makeCat(id: string, name: string): Category {
  return { id, user_id: 'u1', name, color: '#aaa', type: 'expense', is_predefined: false, household_id: null, visibility_level: 'shared', created_at: '2026-01-01T00:00:00Z' };
}

function makeTx(id: string, categoryId: string, amount: number, date: string, type: 'expense' | 'income' = 'expense'): Transaction {
  return { id, user_id: 'u1', category_id: categoryId, amount, date, type, notes: null, currency: 'USD', exchange_rate: null, household_id: null, allowance_id: null, goal_contribution_id: null, created_at: `${date}T00:00:00Z`, updated_at: `${date}T00:00:00Z` };
}

const CAT_DINING = makeCat('cat-d', 'Dining');
const CAT_TRANSPORT = makeCat('cat-t', 'Transport');

// ============================================================================
// TESTS
// ============================================================================

describe('computeEndOfMonthForecasts', () => {
  describe('empty / guard cases', () => {
    it('returns [] when currentMonthTransactions is empty', () => {
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: [],
        historicalTransactions: [],
        categories: [CAT_DINING],
        today: TODAY,
      });
      expect(result).toHaveLength(0);
    });

    it('returns [] when no category has current-month spending (only income)', () => {
      const transactions = [makeTx('t1', 'cat-d', 500, '2026-06-05', 'income')];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: transactions,
        historicalTransactions: [],
        categories: [CAT_DINING],
        today: TODAY,
      });
      expect(result).toHaveLength(0);
    });

    it('excludes categories with zero current-month expense spend', () => {
      // Dining has current spend, Transport does not
      const current = [makeTx('t1', 'cat-d', 300, '2026-06-05')];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: [],
        categories: [CAT_DINING, CAT_TRANSPORT],
        today: TODAY,
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.category_id).toBe('cat-d');
    });
  });

  describe('projection math', () => {
    it('projects $900 when $300 spent in 10 days of a 30-day month', () => {
      // day 10 of 30 → dailyRate = $30/day → projectedEOM = $300 + $30×20 = $900
      const current = [makeTx('t1', 'cat-d', 300, '2026-06-05')];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: [],
        categories: [CAT_DINING],
        today: TODAY,
      });
      expect(result[0]!.projected_eom).toBe(900);
      expect(result[0]!.spent_so_far).toBe(300);
      expect(result[0]!.days_elapsed).toBe(10);
      expect(result[0]!.days_in_month).toBe(30);
    });

    it('rounds projected_eom to 2 decimal places', () => {
      // $100 / 10 days = $10/day; $100 + $10×20 = $300 exactly — use odd number for rounding check
      const current = [makeTx('t1', 'cat-d', 101, '2026-06-05')];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: [],
        categories: [CAT_DINING],
        today: TODAY,
      });
      // $101/10 × 30 = $303.00 — should be clean
      expect(result[0]!.projected_eom).toBe(303);
    });

    it('sums multiple transactions in same category for spent_so_far', () => {
      const current = [
        makeTx('t1', 'cat-d', 100, '2026-06-01'),
        makeTx('t2', 'cat-d', 200, '2026-06-05'),
      ];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: [],
        categories: [CAT_DINING],
        today: TODAY,
      });
      expect(result[0]!.spent_so_far).toBe(300);
      expect(result[0]!.projected_eom).toBe(900);
    });
  });

  describe('at-risk detection', () => {
    it('marks at-risk when projected > historical avg', () => {
      // Current: $300 spent → projects to $900
      // History: avg $400/month → at risk (900 > 400)
      const current = [makeTx('t1', 'cat-d', 300, '2026-06-05')];
      const historical = [
        makeTx('h1', 'cat-d', 400, '2026-05-15'),
        makeTx('h2', 'cat-d', 420, '2026-04-15'),
        makeTx('h3', 'cat-d', 380, '2026-03-15'),
      ];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_DINING],
        today: TODAY,
      });
      expect(result[0]!.is_at_risk).toBe(true);
    });

    it('does NOT mark at-risk when projected ≤ historical avg', () => {
      // Current: $50 spent → projects to $150
      // History: avg $400/month → on track (150 < 400)
      const current = [makeTx('t1', 'cat-d', 50, '2026-06-05')];
      const historical = [
        makeTx('h1', 'cat-d', 400, '2026-05-15'),
        makeTx('h2', 'cat-d', 400, '2026-04-15'),
      ];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_DINING],
        today: TODAY,
      });
      expect(result[0]!.is_at_risk).toBe(false);
    });

    it('does NOT mark at-risk when no historical data (new category)', () => {
      const current = [makeTx('t1', 'cat-d', 1000, '2026-06-05')];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: [],
        categories: [CAT_DINING],
        today: TODAY,
      });
      expect(result[0]!.is_at_risk).toBe(false);
      expect(result[0]!.historical_avg).toBe(0);
    });
  });

  describe('sorting', () => {
    it('places at-risk categories before on-track categories', () => {
      // Dining: at-risk (projects $900, history $400)
      // Transport: on-track (projects $150, history $400)
      const current = [
        makeTx('t1', 'cat-d', 300, '2026-06-05'),
        makeTx('t2', 'cat-t', 50, '2026-06-05'),
      ];
      const historical = [
        makeTx('h1', 'cat-d', 400, '2026-05-15'),
        makeTx('h2', 'cat-t', 400, '2026-05-15'),
      ];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_TRANSPORT, CAT_DINING], // transport first in input
        today: TODAY,
      });
      // Dining (at-risk) should come first despite transport being first in input
      expect(result[0]!.category_id).toBe('cat-d');
      expect(result[1]!.category_id).toBe('cat-t');
    });

    it('within at-risk group, sorts by projected_eom descending', () => {
      const current = [
        makeTx('t1', 'cat-d', 300, '2026-06-05'),  // projects $900
        makeTx('t2', 'cat-t', 200, '2026-06-05'),  // projects $600
      ];
      const historical = [
        makeTx('h1', 'cat-d', 100, '2026-05-15'),  // history $100 → at-risk
        makeTx('h2', 'cat-t', 100, '2026-05-15'),  // history $100 → at-risk
      ];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_TRANSPORT, CAT_DINING],
        today: TODAY,
      });
      expect(result[0]!.category_id).toBe('cat-d'); // $900 > $600
    });
  });

  describe('historical average calculation', () => {
    it('computes per-month totals then divides by the FIXED 3-month window', () => {
      // May: $400+$100=$500; Apr: $300 → avg = ($500+$300)/3 = $266.67 (retro ÷3)
      const historical = [
        makeTx('h1', 'cat-d', 400, '2026-05-10'),
        makeTx('h2', 'cat-d', 100, '2026-05-20'),
        makeTx('h3', 'cat-d', 300, '2026-04-10'),
      ];
      const current = [makeTx('t1', 'cat-d', 1000, '2026-06-05')]; // projects way above
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_DINING],
        today: TODAY,
      });
      expect(result[0]!.historical_avg).toBe(266.67);
    });

    it('ignores income transactions in historical data', () => {
      const historical = [
        makeTx('h1', 'cat-d', 300, '2026-05-10', 'expense'),
        makeTx('h2', 'cat-d', 9999, '2026-05-15', 'income'), // should not count
      ];
      const current = [makeTx('t1', 'cat-d', 100, '2026-06-05')];
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_DINING],
        today: TODAY,
      });
      expect(result[0]!.historical_avg).toBe(100); // 300 / fixed 3-month window
    });
  });

  // ADR-025: at-risk compares against the resolved budget (explicit limit when set)
  describe('explicit budgets (ADR-025)', () => {
    // avg = $1200/3 = $400/mo (fixed window); current $100 → projects to $300
    // (under the average, over a $250 limit)
    const historical = [
      makeTx('h1', 'cat-d', 600, '2026-05-15'),
      makeTx('h2', 'cat-d', 600, '2026-04-15'),
    ];
    const current = [makeTx('t1', 'cat-d', 100, '2026-06-05')];

    it('is zero-config identical when no budgets map is passed', () => {
      const without = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_DINING],
        today: TODAY,
      });
      const withEmpty = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_DINING],
        today: TODAY,
        budgets: new Map(),
      });
      expect(without).toEqual(withEmpty);
      expect(without[0]!.is_at_risk).toBe(false); // $300 projected < $400 avg
      expect(without[0]!.budget_amount).toBe(400);
      expect(without[0]!.budget_source).toBe('historical_average');
    });

    it('flags at-risk against an explicit limit below the average', () => {
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_DINING],
        today: TODAY,
        budgets: new Map([['cat-d', 250]]),
      });
      // $300 projected > $250 limit, even though it's under the $400 average
      expect(result[0]!.is_at_risk).toBe(true);
      expect(result[0]!.budget_amount).toBe(250);
      expect(result[0]!.budget_source).toBe('explicit');
      // historical_avg stays reported for transparency
      expect(result[0]!.historical_avg).toBe(400);
    });

    it('clears at-risk with a generous explicit limit above the projection', () => {
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: current,
        historicalTransactions: historical,
        categories: [CAT_DINING],
        today: TODAY,
        budgets: new Map([['cat-d', 1000]]),
      });
      expect(result[0]!.is_at_risk).toBe(false);
      expect(result[0]!.budget_amount).toBe(1000);
      expect(result[0]!.budget_source).toBe('explicit');
    });

    it('gives a new category a baseline via an explicit limit (no history)', () => {
      const result = computeEndOfMonthForecasts({
        currentMonthTransactions: [makeTx('t1', 'cat-t', 200, '2026-06-05')],
        historicalTransactions: [],
        categories: [CAT_TRANSPORT],
        today: TODAY,
        budgets: new Map([['cat-t', 300]]),
      });
      // $600 projected > $300 limit — at risk even with zero history
      expect(result[0]!.is_at_risk).toBe(true);
      expect(result[0]!.budget_amount).toBe(300);
      expect(result[0]!.budget_source).toBe('explicit');
      expect(result[0]!.historical_avg).toBe(0);
    });
  });
});
