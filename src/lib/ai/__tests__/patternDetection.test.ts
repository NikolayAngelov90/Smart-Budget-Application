/**
 * Pattern Detection Engine Tests
 *
 * Unit tests for detectSpendingAnomalies and detectNewHighSpendCategories.
 * Both functions are pure (no DB/Next.js dependencies) — no mocking required.
 *
 * Fixed reference date: 2026-06-01 (used as currentMonth throughout).
 */

import { detectSpendingAnomalies, detectNewHighSpendCategories } from '../patternDetection';
import type { Category, InsightMetadata, Transaction } from '@/types/database.types';

// ============================================================================
// FIXTURES
// ============================================================================

const CURRENT_MONTH = new Date('2026-06-01');

function makeCategory(id: string, name: string): Category {
  return {
    id,
    user_id: 'user-1',
    name,
    color: '#000000',
    type: 'expense',
    is_predefined: false,
    household_id: null,
    visibility_level: 'shared',
    created_at: '2026-01-01T00:00:00Z',
  };
}

function makeTx(
  id: string,
  categoryId: string,
  amount: number,
  date: string
): Transaction {
  return {
    id,
    user_id: 'user-1',
    category_id: categoryId,
    amount,
    date,
    type: 'expense',
    notes: null,
    created_at: `${date}T00:00:00Z`,
    updated_at: `${date}T00:00:00Z`,
    currency: 'USD',
    exchange_rate: null,
    household_id: null,
  };
}

const CAT_DINING = makeCategory('cat-dining', 'Dining');
const CAT_TRANSPORT = makeCategory('cat-transport', 'Transport');
const CAT_UTILITIES = makeCategory('cat-utilities', 'Utilities');
const CAT_SHOPPING = makeCategory('cat-shopping', 'Shopping');
const CAT_HEALTH = makeCategory('cat-health', 'Health');
const CAT_ENTERTAINMENT = makeCategory('cat-entertainment', 'Entertainment');

// ============================================================================
// detectSpendingAnomalies
// ============================================================================

describe('detectSpendingAnomalies', () => {
  describe('insufficient data guards', () => {
    it('returns [] when there are no transactions at all', () => {
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions: [],
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(0);
    });

    it('returns [] when a category only has current-month data (no month-1)', () => {
      const transactions = [
        makeTx('t1', 'cat-dining', 480, '2026-06-05'),
        makeTx('t2', 'cat-dining', 200, '2026-06-15'),
      ];
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(0);
    });

    it('returns [] when a category has month-1 data but no month-2 data', () => {
      const transactions = [
        makeTx('t1', 'cat-dining', 480, '2026-06-10'),
        makeTx('t2', 'cat-dining', 300, '2026-05-10'), // month-1 only
      ];
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(0);
    });

    it('returns [] when baseline is below the $20 noise guard', () => {
      // baseline = avg(5, 8) = 6.5 → below $20
      const transactions = [
        makeTx('t1', 'cat-dining', 15, '2026-06-05'),
        makeTx('t2', 'cat-dining', 5, '2026-05-05'),
        makeTx('t3', 'cat-dining', 8, '2026-04-05'),
      ];
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('anomaly detection', () => {
    it('triggers when current month is 60% above 2-month average', () => {
      // month-1: $280, month-2: $320 → baseline = $300; current = $480 → 60% above
      const transactions = [
        makeTx('t1', 'cat-dining', 480, '2026-06-10'),
        makeTx('t2', 'cat-dining', 280, '2026-05-10'),
        makeTx('t3', 'cat-dining', 320, '2026-04-10'),
      ];
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe('spending_anomaly');
      expect(result[0]!.priority).toBe(4);
    });

    it('does NOT trigger when spike is only 10% above baseline (below 50% threshold)', () => {
      // baseline = avg($290, $310) = $300; current = $330 → 10% above
      const transactions = [
        makeTx('t1', 'cat-dining', 330, '2026-06-10'),
        makeTx('t2', 'cat-dining', 290, '2026-05-10'),
        makeTx('t3', 'cat-dining', 310, '2026-04-10'),
      ];
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(0);
    });

    it('triggers at exactly 50% above baseline', () => {
      // baseline = $200; current = $300 → exactly 50%
      const transactions = [
        makeTx('t1', 'cat-dining', 300, '2026-06-10'),
        makeTx('t2', 'cat-dining', 200, '2026-05-10'),
        makeTx('t3', 'cat-dining', 200, '2026-04-10'),
      ];
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(1);
    });

    it('insight contains correct metadata with dollar amounts', () => {
      const transactions = [
        makeTx('t1', 'cat-dining', 480, '2026-06-10'),
        makeTx('t2', 'cat-dining', 280, '2026-05-10'),
        makeTx('t3', 'cat-dining', 320, '2026-04-10'),
      ];
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      const insight = result[0]!;
      const meta = insight.metadata as InsightMetadata;
      expect(meta.category_id).toBe('cat-dining');
      expect(meta.category_name).toBe('Dining');
      expect(meta.current_amount).toBe(480);
      expect(meta.two_month_average).toBe(300);
      expect(insight.description).toContain('$480');
      expect(insight.description).toContain('$300');
    });

    it('uses coaching tone (no blame language)', () => {
      const transactions = [
        makeTx('t1', 'cat-dining', 480, '2026-06-10'),
        makeTx('t2', 'cat-dining', 280, '2026-05-10'),
        makeTx('t3', 'cat-dining', 320, '2026-04-10'),
      ];
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      const { description } = result[0]!;
      expect(description).not.toMatch(/overspent|exceeded budget|bad|failed/i);
      // Coaching language present
      expect(description).toMatch(/worth keeping|no action needed/i);
    });

    it('caps results at 3 even when 5 categories trigger', () => {
      const categories = [CAT_DINING, CAT_TRANSPORT, CAT_UTILITIES, CAT_SHOPPING, CAT_HEALTH];
      const transactions: Transaction[] = [];
      let idx = 0;
      for (const cat of categories) {
        // All categories: current = 600 vs baseline 200 (200% above)
        transactions.push(makeTx(`t${idx++}`, cat.id, 600, '2026-06-10'));
        transactions.push(makeTx(`t${idx++}`, cat.id, 200, '2026-05-10'));
        transactions.push(makeTx(`t${idx++}`, cat.id, 200, '2026-04-10'));
      }
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories,
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(3);
    });

    it('sorts anomalies by severity (highest % spike first)', () => {
      // Dining: 200% above; Transport: 100% above; Utilities: 60% above
      const transactions = [
        // Dining: baseline 200, current 600 (200%)
        makeTx('t1', 'cat-dining', 600, '2026-06-10'),
        makeTx('t2', 'cat-dining', 200, '2026-05-10'),
        makeTx('t3', 'cat-dining', 200, '2026-04-10'),
        // Transport: baseline 200, current 400 (100%)
        makeTx('t4', 'cat-transport', 400, '2026-06-10'),
        makeTx('t5', 'cat-transport', 200, '2026-05-10'),
        makeTx('t6', 'cat-transport', 200, '2026-04-10'),
        // Utilities: baseline 200, current 320 (60%)
        makeTx('t7', 'cat-utilities', 320, '2026-06-10'),
        makeTx('t8', 'cat-utilities', 200, '2026-05-10'),
        makeTx('t9', 'cat-utilities', 200, '2026-04-10'),
      ];
      const result = detectSpendingAnomalies({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING, CAT_TRANSPORT, CAT_UTILITIES],
        currentMonth: CURRENT_MONTH,
      });
      expect((result[0]!.metadata as InsightMetadata).category_name).toBe('Dining');
      expect((result[1]!.metadata as InsightMetadata).category_name).toBe('Transport');
      expect((result[2]!.metadata as InsightMetadata).category_name).toBe('Utilities');
    });
  });
});

// ============================================================================
// detectNewHighSpendCategories
// ============================================================================

describe('detectNewHighSpendCategories', () => {
  describe('guards', () => {
    it('returns [] when there are no transactions', () => {
      const result = detectNewHighSpendCategories({
        userId: 'user-1',
        currency: 'USD',
        transactions: [],
        categories: [CAT_DINING],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(0);
    });

    it('returns [] when current month has fewer than 5 transactions (early-month guard)', () => {
      // Only 4 transactions in June
      const transactions = [
        makeTx('t1', 'cat-utilities', 200, '2026-06-01'),
        makeTx('t2', 'cat-utilities', 200, '2026-06-05'),
        makeTx('t3', 'cat-dining', 100, '2026-06-10'),
        makeTx('t4', 'cat-transport', 80, '2026-06-12'),
      ];
      const result = detectNewHighSpendCategories({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_UTILITIES, CAT_DINING, CAT_TRANSPORT],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(0);
    });

    it('returns [] when user has no prior-month transaction history (new user)', () => {
      // 5 current-month transactions but zero history in prior 2 months
      const transactions: Transaction[] = [
        makeTx('t1', 'cat-dining', 300, '2026-06-01'),
        makeTx('t2', 'cat-transport', 250, '2026-06-02'),
        makeTx('t3', 'cat-utilities', 200, '2026-06-03'),
        makeTx('t4', 'cat-dining', 50, '2026-06-04'),
        makeTx('t5', 'cat-transport', 50, '2026-06-05'),
      ];
      const result = detectNewHighSpendCategories({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING, CAT_TRANSPORT, CAT_UTILITIES],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(0);
    });

    it('returns [] when all current top-3 categories were already in historical top-5', () => {
      // Dining, Transport, Utilities are top-3 now AND were in historical top-5
      const transactions: Transaction[] = [
        // 5 current-month transactions
        makeTx('t1', 'cat-dining', 300, '2026-06-01'),
        makeTx('t2', 'cat-transport', 250, '2026-06-02'),
        makeTx('t3', 'cat-utilities', 200, '2026-06-03'),
        makeTx('t4', 'cat-dining', 50, '2026-06-04'),
        makeTx('t5', 'cat-transport', 50, '2026-06-05'),
        // Historical (month-1 and month-2): same top categories
        makeTx('t6', 'cat-dining', 280, '2026-05-10'),
        makeTx('t7', 'cat-transport', 220, '2026-05-10'),
        makeTx('t8', 'cat-utilities', 180, '2026-05-10'),
        makeTx('t9', 'cat-dining', 270, '2026-04-10'),
        makeTx('t10', 'cat-transport', 210, '2026-04-10'),
      ];
      const result = detectNewHighSpendCategories({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING, CAT_TRANSPORT, CAT_UTILITIES],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('new entrant detection', () => {
    it('detects a category newly in top-3 that was not in historical top-5', () => {
      // Entertainment is new top-2 this month but had no historical spend
      const transactions: Transaction[] = [
        // Current month (≥5 tx)
        makeTx('t1', 'cat-dining', 300, '2026-06-01'),
        makeTx('t2', 'cat-entertainment', 280, '2026-06-02'),
        makeTx('t3', 'cat-transport', 200, '2026-06-03'),
        makeTx('t4', 'cat-dining', 50, '2026-06-04'),
        makeTx('t5', 'cat-transport', 50, '2026-06-05'),
        // Historical: Entertainment was NOT a top spender
        makeTx('t6', 'cat-dining', 280, '2026-05-10'),
        makeTx('t7', 'cat-transport', 220, '2026-05-10'),
        makeTx('t8', 'cat-utilities', 180, '2026-05-10'),
        makeTx('t9', 'cat-shopping', 160, '2026-05-10'),
        makeTx('t10', 'cat-health', 140, '2026-05-10'),
        makeTx('t11', 'cat-dining', 270, '2026-04-10'),
        makeTx('t12', 'cat-transport', 210, '2026-04-10'),
      ];
      const result = detectNewHighSpendCategories({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING, CAT_ENTERTAINMENT, CAT_TRANSPORT, CAT_UTILITIES, CAT_SHOPPING, CAT_HEALTH],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe('new_high_spend_category');
      expect(result[0]!.priority).toBe(3);
      expect((result[0]!.metadata as InsightMetadata).category_name).toBe('Entertainment');
    });

    it('returns max 1 insight even when multiple new categories appear', () => {
      // Both Entertainment and Health are new top spenders this month
      const transactions: Transaction[] = [
        // Current month (≥5 tx)
        makeTx('t1', 'cat-entertainment', 400, '2026-06-01'),
        makeTx('t2', 'cat-health', 380, '2026-06-02'),
        makeTx('t3', 'cat-dining', 200, '2026-06-03'),
        makeTx('t4', 'cat-entertainment', 50, '2026-06-04'),
        makeTx('t5', 'cat-health', 50, '2026-06-05'),
        // Historical: only Dining and Transport were significant
        makeTx('t6', 'cat-dining', 280, '2026-05-10'),
        makeTx('t7', 'cat-transport', 220, '2026-05-10'),
        makeTx('t8', 'cat-dining', 270, '2026-04-10'),
        makeTx('t9', 'cat-transport', 210, '2026-04-10'),
      ];
      const result = detectNewHighSpendCategories({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_ENTERTAINMENT, CAT_HEALTH, CAT_DINING, CAT_TRANSPORT],
        currentMonth: CURRENT_MONTH,
      });
      expect(result).toHaveLength(1);
    });

    it('insight uses coaching tone (no blame language)', () => {
      const transactions: Transaction[] = [
        makeTx('t1', 'cat-dining', 300, '2026-06-01'),
        makeTx('t2', 'cat-entertainment', 280, '2026-06-02'),
        makeTx('t3', 'cat-transport', 200, '2026-06-03'),
        makeTx('t4', 'cat-dining', 50, '2026-06-04'),
        makeTx('t5', 'cat-transport', 50, '2026-06-05'),
        makeTx('t6', 'cat-dining', 280, '2026-05-10'),
        makeTx('t7', 'cat-transport', 220, '2026-05-10'),
        makeTx('t8', 'cat-dining', 270, '2026-04-10'),
        makeTx('t9', 'cat-transport', 210, '2026-04-10'),
      ];
      const result = detectNewHighSpendCategories({
        userId: 'user-1',
        currency: 'USD',
        transactions,
        categories: [CAT_DINING, CAT_ENTERTAINMENT, CAT_TRANSPORT],
        currentMonth: CURRENT_MONTH,
      });
      const { description } = result[0]!;
      expect(description).not.toMatch(/overspent|exceeded|bad|failed/i);
      expect(description).toContain('Entertainment');
      expect(description).toContain('$280');
    });
  });
});
