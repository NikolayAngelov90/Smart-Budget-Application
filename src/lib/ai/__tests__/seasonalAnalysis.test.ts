/**
 * Seasonal Analysis Tests — Story 12.5 / FR6
 * Pure unit tests — no mocks.
 *
 * Reference today: 2026-06-15 → next 6 months are Jul..Dec 2026.
 */

import { analyzeSeasonalPatterns } from '../seasonalAnalysis';
import type { Transaction } from '@/types/database.types';

const TODAY = new Date('2026-06-15T12:00:00');

let seq = 0;
function tx(categoryId: string, amount: number, date: string, type: 'expense' | 'income' = 'expense'): Transaction {
  seq += 1;
  return {
    id: `t${seq}`, user_id: 'u1', category_id: categoryId, amount, date, type,
    notes: null, currency: 'USD', exchange_rate: null,
    created_at: `${date}T00:00:00Z`, updated_at: `${date}T00:00:00Z`,
  };
}

/** One transaction per month from 2025-07 .. 2026-06 (12 months), each `amount`. */
function twelveMonths(amount: number): Transaction[] {
  const months = [
    '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  ];
  return months.map((m) => tx('cat-1', amount, `${m}-10`));
}

describe('analyzeSeasonalPatterns', () => {
  it('returns hasEnoughData=false and empty timeline with < 6 distinct months', () => {
    const transactions = [
      tx('cat-1', 100, '2026-01-10'),
      tx('cat-1', 100, '2026-02-10'),
      tx('cat-1', 100, '2026-03-10'),
      tx('cat-1', 100, '2026-04-10'),
      tx('cat-1', 100, '2026-05-10'), // only 5 distinct months
    ];
    const result = analyzeSeasonalPatterns({ transactions, today: TODAY });
    expect(result.hasEnoughData).toBe(false);
    expect(result.timeline).toHaveLength(0);
    expect(result.months_analyzed).toBe(5);
  });

  it('returns a 6-month timeline when >= 6 months of history', () => {
    const result = analyzeSeasonalPatterns({ transactions: twelveMonths(100), today: TODAY });
    expect(result.hasEnoughData).toBe(true);
    expect(result.timeline).toHaveLength(6);
    expect(result.months_analyzed).toBe(12);
    // Next 6 months after Jun 2026
    expect(result.timeline.map((m) => m.month)).toEqual([
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ]);
  });

  it('flags a seasonal high when the historical month-of-year is >= 25% above baseline', () => {
    // 11 months at 100, December at 300 → baseline ~ (1100+300)/12 ≈ 116.7
    const base = twelveMonths(100).filter((t) => t.date.substring(0, 7) !== '2025-12');
    const transactions = [...base, tx('cat-1', 300, '2025-12-10')];
    const result = analyzeSeasonalPatterns({ transactions, today: TODAY });
    const december = result.timeline.find((m) => m.month === '2026-12');
    expect(december).toBeDefined();
    expect(december!.predicted_amount).toBe(300);
    expect(december!.is_seasonal_high).toBe(true);
    expect(december!.historical_basis).toBe('2025-12');
  });

  it('does NOT flag a month at/below baseline', () => {
    const result = analyzeSeasonalPatterns({ transactions: twelveMonths(100), today: TODAY });
    // all months equal → none are 25% above baseline
    expect(result.timeline.every((m) => m.is_seasonal_high === false)).toBe(true);
  });

  it('predicts 0 with null basis when no matching month-of-year exists', () => {
    // History only Jul 2025..Dec 2025 (6 months) → no Jan..Jun history
    const months = ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'];
    const transactions = months.map((m) => tx('cat-1', 100, `${m}-10`));
    const result = analyzeSeasonalPatterns({ transactions, today: TODAY });
    // Upcoming Jul..Dec 2026 DO have basis (Jul..Dec 2025) → all have history.
    // Confirm a month with basis is non-zero, then check a no-history scenario:
    const july = result.timeline.find((m) => m.month === '2026-07');
    expect(july!.predicted_amount).toBe(100);
    expect(july!.historical_basis).toBe('2025-07');

    // Now a history with only Jan..Jun 2026 → upcoming Jul..Dec have NO basis
    const h2 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].map((m) => tx('cat-1', 100, `${m}-10`));
    const r2 = analyzeSeasonalPatterns({ transactions: h2, today: TODAY });
    expect(r2.timeline.every((m) => m.predicted_amount === 0 && m.historical_basis === null)).toBe(true);
  });

  it('ignores income transactions', () => {
    const transactions = [...twelveMonths(100), tx('cat-1', 99999, '2026-06-20', 'income')];
    const result = analyzeSeasonalPatterns({ transactions, today: TODAY });
    expect(result.baseline_monthly).toBe(100); // income excluded
  });
});
