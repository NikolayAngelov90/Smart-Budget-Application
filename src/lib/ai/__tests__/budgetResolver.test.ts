/**
 * Budget Resolver Tests — ADR-025
 *
 * The resolver is the single source of truth for explicit-vs-average budget
 * selection. Covers the spec's I/O matrix plus the status thresholds shared
 * by the Budget Health card, nudges, and forecasts.
 */

import { resolveBudget, budgetStatusFor, BUDGET_WARNING_THRESHOLD } from '../budgetResolver';

describe('resolveBudget', () => {
  it('returns the explicit limit when one is set', () => {
    expect(resolveBudget({ explicitLimit: 300, threeMonthAverage: 412 })).toEqual({
      amount: 300,
      source: 'explicit',
    });
  });

  it('falls back to the historical average when no limit is set', () => {
    expect(resolveBudget({ threeMonthAverage: 412 })).toEqual({
      amount: 412,
      source: 'historical_average',
    });
  });

  it('treats null explicitLimit as unset', () => {
    expect(resolveBudget({ explicitLimit: null, threeMonthAverage: 100 })).toEqual({
      amount: 100,
      source: 'historical_average',
    });
  });

  it('returns zero average as a zero fallback (no baseline)', () => {
    expect(resolveBudget({ threeMonthAverage: 0 })).toEqual({
      amount: 0,
      source: 'historical_average',
    });
  });

  it('passes an explicit 0 through mechanically (API rejects 0 so consumers never see it)', () => {
    // All consumers treat a resolved amount of 0 as "no baseline"; PUT /api/budgets
    // requires a positive limit precisely so this case cannot arise from user data.
    expect(resolveBudget({ explicitLimit: 0, threeMonthAverage: 250 })).toEqual({
      amount: 0,
      source: 'explicit',
    });
  });

  it('prefers the explicit limit even when the average is zero', () => {
    expect(resolveBudget({ explicitLimit: 50, threeMonthAverage: 0 })).toEqual({
      amount: 50,
      source: 'explicit',
    });
  });
});

describe('budgetStatusFor', () => {
  it('is ok below the warning threshold', () => {
    expect(budgetStatusFor(79.99, 100)).toBe('ok');
    expect(budgetStatusFor(0, 100)).toBe('ok');
  });

  it('warns from 80% up to and including 100%', () => {
    expect(budgetStatusFor(80, 100)).toBe('warning');
    expect(budgetStatusFor(100, 100)).toBe('warning');
  });

  it('is over above 100%', () => {
    expect(budgetStatusFor(100.01, 100)).toBe('over');
  });

  it('treats any spend against a zero budget as over', () => {
    expect(budgetStatusFor(1, 0)).toBe('over');
    expect(budgetStatusFor(0, 0)).toBe('ok');
  });

  it('exposes the shared 80% threshold', () => {
    expect(BUDGET_WARNING_THRESHOLD).toBe(0.8);
  });
});
