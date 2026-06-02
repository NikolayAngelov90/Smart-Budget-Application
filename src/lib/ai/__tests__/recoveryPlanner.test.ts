/**
 * Recovery Planner Tests — Story 12.4 / FR4
 * Pure unit tests — no mocks.
 */

import { buildRecoveryPlanTargets } from '../recoveryPlanner';
import type { Category, Transaction } from '@/types/database.types';

function makeCat(id: string, name: string): Category {
  return { id, user_id: 'u1', name, color: '#abc', type: 'expense', is_predefined: false, created_at: '2026-01-01T00:00:00Z' };
}

function makeTx(id: string, categoryId: string, amount: number, date: string, type: 'expense' | 'income' = 'expense'): Transaction {
  return { id, user_id: 'u1', category_id: categoryId, amount, date, type, notes: null, currency: 'USD', exchange_rate: null, created_at: `${date}T00:00:00Z`, updated_at: `${date}T00:00:00Z` };
}

const CAT_DINING = makeCat('cat-d', 'Dining');
const CAT_TRANSPORT = makeCat('cat-t', 'Transport');

describe('buildRecoveryPlanTargets', () => {
  describe('guards / no plan needed', () => {
    it('returns [] when no current-month spend', () => {
      const result = buildRecoveryPlanTargets({
        currentMonthTransactions: [],
        historicalTransactions: [makeTx('h1', 'cat-d', 300, '2026-05-10')],
        categories: [CAT_DINING],
      });
      expect(result).toHaveLength(0);
    });

    it('returns [] when category has no prior-month history (cannot derive min/avg)', () => {
      const result = buildRecoveryPlanTargets({
        currentMonthTransactions: [makeTx('t1', 'cat-d', 500, '2026-06-05')],
        historicalTransactions: [],
        categories: [CAT_DINING],
      });
      expect(result).toHaveLength(0);
    });

    it('returns [] when current spend does NOT exceed historical average', () => {
      // avg of [300, 400] = 350; current 200 → not overspent
      const result = buildRecoveryPlanTargets({
        currentMonthTransactions: [makeTx('t1', 'cat-d', 200, '2026-06-05')],
        historicalTransactions: [
          makeTx('h1', 'cat-d', 300, '2026-05-10'),
          makeTx('h2', 'cat-d', 400, '2026-04-10'),
        ],
        categories: [CAT_DINING],
      });
      expect(result).toHaveLength(0);
    });

    it('ignores income transactions', () => {
      const result = buildRecoveryPlanTargets({
        currentMonthTransactions: [makeTx('t1', 'cat-d', 9999, '2026-06-05', 'income')],
        historicalTransactions: [makeTx('h1', 'cat-d', 300, '2026-05-10')],
        categories: [CAT_DINING],
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('overspent detection + target math', () => {
    it('identifies an overspent category and targets the historical minimum', () => {
      // history: May 400, Apr 200 → avg 300, min 200; current 500 > 300 → overspent
      const result = buildRecoveryPlanTargets({
        currentMonthTransactions: [makeTx('t1', 'cat-d', 500, '2026-06-05')],
        historicalTransactions: [
          makeTx('h1', 'cat-d', 400, '2026-05-10'),
          makeTx('h2', 'cat-d', 200, '2026-04-10'),
        ],
        categories: [CAT_DINING],
      });
      expect(result).toHaveLength(1);
      const t = result[0]!;
      expect(t.historical_avg).toBe(300);
      expect(t.historical_min).toBe(200);
      expect(t.monthly_target).toBe(200);
      expect(t.current_spend).toBe(500);
    });

    it('derives daily and weekly targets from the monthly target, rounded 2dp', () => {
      // min = 210 → monthly 210; daily 7; weekly 49
      const result = buildRecoveryPlanTargets({
        currentMonthTransactions: [makeTx('t1', 'cat-d', 600, '2026-06-05')],
        historicalTransactions: [
          makeTx('h1', 'cat-d', 500, '2026-05-10'),
          makeTx('h2', 'cat-d', 210, '2026-04-10'),
        ],
        categories: [CAT_DINING],
      });
      const t = result[0]!;
      expect(t.monthly_target).toBe(210);
      expect(t.daily_target).toBe(7);    // 210 / 30
      expect(t.weekly_target).toBe(49);  // 210 / (30/7)
    });

    it('sorts overspent categories by severity (current − avg) descending', () => {
      const result = buildRecoveryPlanTargets({
        currentMonthTransactions: [
          makeTx('t1', 'cat-d', 500, '2026-06-05'), // avg 300 → severity 200
          makeTx('t2', 'cat-t', 800, '2026-06-05'), // avg 300 → severity 500
        ],
        historicalTransactions: [
          makeTx('h1', 'cat-d', 400, '2026-05-10'),
          makeTx('h2', 'cat-d', 200, '2026-04-10'),
          makeTx('h3', 'cat-t', 400, '2026-05-10'),
          makeTx('h4', 'cat-t', 200, '2026-04-10'),
        ],
        categories: [CAT_DINING, CAT_TRANSPORT],
      });
      expect(result).toHaveLength(2);
      expect(result[0]!.category_id).toBe('cat-t'); // higher severity first
      expect(result[1]!.category_id).toBe('cat-d');
    });

    it('only includes overspent categories, not on-track ones', () => {
      const result = buildRecoveryPlanTargets({
        currentMonthTransactions: [
          makeTx('t1', 'cat-d', 500, '2026-06-05'), // overspent
          makeTx('t2', 'cat-t', 100, '2026-06-05'), // on track (avg 300)
        ],
        historicalTransactions: [
          makeTx('h1', 'cat-d', 400, '2026-05-10'),
          makeTx('h2', 'cat-d', 200, '2026-04-10'),
          makeTx('h3', 'cat-t', 400, '2026-05-10'),
          makeTx('h4', 'cat-t', 200, '2026-04-10'),
        ],
        categories: [CAT_DINING, CAT_TRANSPORT],
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.category_id).toBe('cat-d');
    });
  });
});
