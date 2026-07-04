/**
 * What-If Engine Tests — Story 14.4
 * Pure unit tests — no mocks needed.
 * Fixed reference: today = 2026-07-02 local.
 */

import { computeWhatIfProjection, DAYS_PER_MONTH } from '../whatIfEngine';

const TODAY = new Date(2026, 6, 2); // 2026-07-02 local

const BASE = {
  adjustments: [],
  cancelledMonthlyAmounts: [],
  goal: null,
  today: TODAY,
};

// 30 days out from TODAY; remaining 300 → dailyRequired 10
const GOAL_30D = { name: 'Vacation', targetAmount: 1300, currentAmount: 1000, deadline: '2026-08-01' };
// 365 days out; remaining 1200
const GOAL_1Y = { name: 'Car', targetAmount: 2200, currentAmount: 1000, deadline: '2027-07-02' };

describe('computeWhatIfProjection', () => {
  describe('savings math', () => {
    it('computes a single slider reduction', () => {
      const p = computeWhatIfProjection({
        ...BASE,
        adjustments: [{ avgMonthly: 400, reductionPct: 25 }],
      });
      expect(p.monthly_savings).toBe(100);
      expect(p.annual_savings).toBe(1200);
    });

    it('sums multiple sliders and cancelled subscriptions', () => {
      const p = computeWhatIfProjection({
        ...BASE,
        adjustments: [
          { avgMonthly: 400, reductionPct: 25 }, // 100
          { avgMonthly: 120, reductionPct: 50 }, // 60
        ],
        cancelledMonthlyAmounts: [9.99, 15.01], // 25
      });
      expect(p.monthly_savings).toBe(185);
      expect(p.annual_savings).toBe(2220);
    });

    it('handles the 0% and 100% slider bounds', () => {
      const zero = computeWhatIfProjection({
        ...BASE,
        adjustments: [{ avgMonthly: 400, reductionPct: 0 }],
      });
      expect(zero.monthly_savings).toBe(0);

      const full = computeWhatIfProjection({
        ...BASE,
        adjustments: [{ avgMonthly: 400, reductionPct: 100 }],
      });
      expect(full.monthly_savings).toBe(400);
    });

    it('returns zeros with no adjustments at all', () => {
      const p = computeWhatIfProjection(BASE);
      expect(p.monthly_savings).toBe(0);
      expect(p.annual_savings).toBe(0);
      expect(p.goal_impact).toBeNull();
    });

    it('never emits -0', () => {
      const p = computeWhatIfProjection({
        ...BASE,
        adjustments: [{ avgMonthly: 0.001, reductionPct: 100 }],
      });
      expect(Object.is(p.monthly_savings, -0)).toBe(false);
      expect(Object.is(p.annual_savings, -0)).toBe(false);
      expect(p.monthly_savings).toBe(0);
    });
  });

  describe('goal impact', () => {
    it('computes days/months earlier via the required-pace model', () => {
      // dailyRequired 10; +100/mo → newDaily 10 + 100/30.44 = 13.2852
      // newDays = ceil(300 / 13.2852) = 23 → 7 days earlier → 0.2 months
      const p = computeWhatIfProjection({
        ...BASE,
        adjustments: [{ avgMonthly: 400, reductionPct: 25 }],
        goal: GOAL_30D,
      });
      expect(p.goal_impact).toEqual({ goal_name: 'Vacation', days_earlier: 7, months_earlier: 0.2 });
    });

    it('reports the epic\'s "months earlier" case for a long-horizon goal', () => {
      // remaining 1200 over 365 days → dailyRequired 3.2877; +100/mo → newDaily 6.5729
      // newDays = ceil(1200 / 6.5729) = 183 → 182 days ≈ 6.0 months earlier
      const p = computeWhatIfProjection({
        ...BASE,
        adjustments: [{ avgMonthly: 400, reductionPct: 25 }],
        goal: GOAL_1Y,
      });
      expect(p.goal_impact!.days_earlier).toBe(182);
      expect(p.goal_impact!.months_earlier).toBe(6);
    });

    it('is null with zero savings even when a goal exists', () => {
      const p = computeWhatIfProjection({ ...BASE, goal: GOAL_30D });
      expect(p.goal_impact).toBeNull();
    });

    it('is null when the goal target is already met', () => {
      const p = computeWhatIfProjection({
        ...BASE,
        adjustments: [{ avgMonthly: 400, reductionPct: 25 }],
        goal: { ...GOAL_30D, currentAmount: 1300 },
      });
      expect(p.goal_impact).toBeNull();
    });

    it('is null when the deadline is today or past', () => {
      for (const deadline of ['2026-07-02', '2026-07-01']) {
        const p = computeWhatIfProjection({
          ...BASE,
          adjustments: [{ avgMonthly: 400, reductionPct: 25 }],
          goal: { ...GOAL_30D, deadline },
        });
        expect(p.goal_impact).toBeNull();
      }
    });

    it('is null for a malformed deadline', () => {
      const p = computeWhatIfProjection({
        ...BASE,
        adjustments: [{ avgMonthly: 400, reductionPct: 25 }],
        goal: { ...GOAL_30D, deadline: 'soon' },
      });
      expect(p.goal_impact).toBeNull();
    });

    it('rejects rollover garbage dates instead of normalizing them (2026-13-40)', () => {
      const p = computeWhatIfProjection({
        ...BASE,
        adjustments: [{ avgMonthly: 400, reductionPct: 25 }],
        goal: { ...GOAL_30D, deadline: '2026-13-40' },
      });
      expect(p.goal_impact).toBeNull();
    });
  });

  it('exposes the shared days-per-month constant', () => {
    expect(DAYS_PER_MONTH).toBeCloseTo(30.44);
  });
});
