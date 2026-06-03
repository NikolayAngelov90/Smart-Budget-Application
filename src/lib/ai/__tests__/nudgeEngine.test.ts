/**
 * Nudge Engine Tests — Story 12.3
 * Pure unit tests — no mocks needed.
 */

import { evaluateNudge } from '../nudgeEngine';

const BASE = {
  userId: 'u1',
  categoryId: 'cat-dining',
  categoryName: 'Dining',
  affectedGoalName: null,
  currency: 'USD',
};

describe('evaluateNudge', () => {
  describe('guard cases', () => {
    it('returns null when historicalAvg is 0 (new category)', () => {
      expect(evaluateNudge({ ...BASE, currentMonthTotal: 500, historicalAvg: 0 })).toBeNull();
    });

    it('returns null when pctOfAvg < 80', () => {
      // 79% — just below threshold
      expect(evaluateNudge({ ...BASE, currentMonthTotal: 79, historicalAvg: 100 })).toBeNull();
    });

    it('returns null at exactly 79%', () => {
      expect(evaluateNudge({ ...BASE, currentMonthTotal: 79, historicalAvg: 100 })).toBeNull();
    });
  });

  describe('approaching threshold (80–99%)', () => {
    it('triggers at exactly 80%', () => {
      const result = evaluateNudge({ ...BASE, currentMonthTotal: 80, historicalAvg: 100 });
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('approaching');
      expect(result!.pctOfAvg).toBe(80);
    });

    it('triggers at 85%', () => {
      const result = evaluateNudge({ ...BASE, currentMonthTotal: 85, historicalAvg: 100 });
      expect(result!.severity).toBe('approaching');
      expect(result!.pctOfAvg).toBe(85);
    });

    it('title mentions category name and percentage', () => {
      const result = evaluateNudge({ ...BASE, currentMonthTotal: 85, historicalAvg: 100 });
      expect(result!.title).toContain('Dining');
      expect(result!.title).toContain('85%');
    });

    it('body contains dollar amounts', () => {
      const result = evaluateNudge({ ...BASE, currentMonthTotal: 85, historicalAvg: 100 });
      expect(result!.body).toContain('$85');
      expect(result!.body).toContain('$100');
    });
  });

  describe('exceeded threshold (≥100%)', () => {
    it('triggers at exactly 100%', () => {
      const result = evaluateNudge({ ...BASE, currentMonthTotal: 100, historicalAvg: 100 });
      expect(result!.severity).toBe('exceeded');
      expect(result!.pctOfAvg).toBe(100);
    });

    it('triggers above 100%', () => {
      const result = evaluateNudge({ ...BASE, currentMonthTotal: 150, historicalAvg: 100 });
      expect(result!.severity).toBe('exceeded');
      expect(result!.pctOfAvg).toBe(150);
    });

    it('title uses coaching tone (no "overspent")', () => {
      const result = evaluateNudge({ ...BASE, currentMonthTotal: 120, historicalAvg: 100 });
      expect(result!.title).not.toMatch(/overspent|failed|bad/i);
      expect(result!.title).toContain('Dining');
    });
  });

  describe('goal impact', () => {
    it('includes goal name in body when affectedGoalName is set', () => {
      const result = evaluateNudge({
        ...BASE,
        currentMonthTotal: 90,
        historicalAvg: 100,
        affectedGoalName: 'Emergency Fund',
      });
      expect(result!.body).toContain('Emergency Fund');
    });

    it('does NOT include goal text when affectedGoalName is null', () => {
      const result = evaluateNudge({ ...BASE, currentMonthTotal: 90, historicalAvg: 100, affectedGoalName: null });
      expect(result!.body).not.toContain('goal');
    });
  });

  describe('payload fields', () => {
    it('returns correct payload shape', () => {
      const result = evaluateNudge({ ...BASE, currentMonthTotal: 80, historicalAvg: 100 });
      expect(result).toMatchObject({
        categoryId: 'cat-dining',
        categoryName: 'Dining',
        currentMonthTotal: 80,
        historicalAvg: 100,
        pctOfAvg: 80,
        affectedGoalName: null,
      });
      expect(typeof result!.title).toBe('string');
      expect(typeof result!.body).toBe('string');
    });
  });
});
