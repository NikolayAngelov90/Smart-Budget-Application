/**
 * fixedWindowMonthlyAverage Tests — epic-14 retro action 3 (÷3 decision)
 *
 * Budget baselines divide by the FIXED window size, never by months present,
 * so a single spike month cannot pose as the user's "usual" monthly spend.
 */

import {
  fixedWindowMonthlyAverage,
  calculateMean,
  AVERAGE_WINDOW_MONTHS,
} from '../spendingAnalysis';

describe('fixedWindowMonthlyAverage', () => {
  it('divides a single spike month by the full window (the retro scenario)', () => {
    expect(fixedWindowMonthlyAverage([900])).toBe(300); // not 900
  });

  it('divides two months of history by 3', () => {
    expect(fixedWindowMonthlyAverage([300, 500])).toBeCloseTo(266.6667, 3);
  });

  it('matches calculateMean for a full 3-month window', () => {
    const totals = [120.5, 340.25, 99.99];
    expect(fixedWindowMonthlyAverage(totals)).toBeCloseTo(calculateMean(totals), 10);
  });

  it('never exceeds the true mean when given MORE buckets than the window', () => {
    // A wider fetch must degrade to a true mean — ÷3 on 4 buckets would
    // INFLATE the baseline, the exact defect this helper exists to kill
    expect(fixedWindowMonthlyAverage([100, 200, 300, 400])).toBe(250); // ÷4, not ÷3
    expect(fixedWindowMonthlyAverage([250, 250, 250, 250])).toBe(250); // steady spender stays steady
  });

  it('returns 0 for empty input so no-baseline guards keep firing', () => {
    expect(fixedWindowMonthlyAverage([])).toBe(0);
  });

  it('returns 0 for a non-positive or non-finite window', () => {
    expect(fixedWindowMonthlyAverage([100], 0)).toBe(0);
    expect(fixedWindowMonthlyAverage([100], -1)).toBe(0);
    expect(fixedWindowMonthlyAverage([100], NaN)).toBe(0);
    expect(fixedWindowMonthlyAverage([100], Infinity)).toBe(0);
  });

  it('supports custom window sizes', () => {
    expect(fixedWindowMonthlyAverage([600], 6)).toBe(100);
  });

  it('exposes the shared window constant', () => {
    expect(AVERAGE_WINDOW_MONTHS).toBe(3);
  });
});
