/**
 * valuesSpendingEngine tests — Story 14.2
 * Pure functions, no mocks: feed inputs, assert the view.
 */

import { computeValuesSpending } from '@/lib/ai/valuesSpendingEngine';
import type { ValueWithCategories } from '@/types/database.types';

function value(id: string, name: string, priority: number, category_ids: string[]): ValueWithCategories {
  return { id, name, priority, category_ids };
}

describe('computeValuesSpending', () => {
  it('groups spend by value, computes share, and surfaces unassigned spend', () => {
    const view = computeValuesSpending({
      values: [value('v1', 'Health', 0, ['cHealth']), value('v2', 'Fun', 1, ['cFun'])],
      currentByCategory: { cHealth: 100, cFun: 300, cOther: 100 },
      previousByCategory: {},
    });

    expect(view.hasPlan).toBe(true);
    expect(view.totalSpend).toBe(500);
    expect(view.values).toHaveLength(2);
    expect(view.values[0]).toMatchObject({ id: 'v1', rank: 1, amount: 100, percentage: 20 });
    expect(view.values[1]).toMatchObject({ id: 'v2', rank: 2, amount: 300, percentage: 60 });
    expect(view.unassigned).toEqual({ amount: 100, percentage: 20 });
  });

  it('uses a DEDUPED total as the denominator when a category maps to multiple values', () => {
    const view = computeValuesSpending({
      values: [value('v1', 'Health', 0, ['cShared']), value('v2', 'Fun', 1, ['cShared', 'cFun'])],
      currentByCategory: { cShared: 100, cFun: 100 },
      previousByCategory: {},
    });

    // total is 200 (cShared counted once), NOT 300 (sum of per-value amounts).
    expect(view.totalSpend).toBe(200);
    expect(view.values[0]).toMatchObject({ amount: 100, percentage: 50 }); // v1: cShared
    expect(view.values[1]).toMatchObject({ amount: 200, percentage: 100 }); // v2: cShared + cFun
    expect(view.unassigned).toEqual({ amount: 0, percentage: 0 });
  });

  it('computes trend up/down/flat with a baseline floor', () => {
    const view = computeValuesSpending({
      values: [
        value('up', 'Up', 0, ['a']),
        value('down', 'Down', 1, ['b']),
        value('steady', 'Steady', 2, ['c']),
        value('nobaseline', 'New', 3, ['d']),
      ],
      currentByCategory: { a: 130, b: 70, c: 105, d: 100 },
      previousByCategory: { a: 100, b: 100, c: 100, d: 10 },
    });

    expect(view.values[0]).toMatchObject({ trendDirection: 'up', trendPct: 30 });
    expect(view.values[1]).toMatchObject({ trendDirection: 'down', trendPct: 30 });
    expect(view.values[2]).toMatchObject({ trendDirection: 'flat', trendPct: 0 });
    // previous below the baseline floor → no meaningful trend
    expect(view.values[3]).toMatchObject({ trendDirection: 'flat', trendPct: 0 });
  });

  it('flags a low-priority value that takes a large share of spend', () => {
    const view = computeValuesSpending({
      values: [
        value('v1', 'Health', 0, ['a']),
        value('v2', 'Family', 1, ['b']),
        value('v3', 'Growth', 2, ['c']),
        value('v4', 'Fun', 3, ['d']),
      ],
      currentByCategory: { a: 10, b: 10, c: 10, d: 70 },
      previousByCategory: {},
    });

    const fun = view.values.find((v) => v.id === 'v4')!;
    expect(fun).toMatchObject({ rank: 4, percentage: 70, misaligned: true });
    // High-priority, modest share → never misaligned.
    expect(view.values.find((v) => v.id === 'v1')!.misaligned).toBe(false);
  });

  it('does NOT flag the top-priority value even when it has the largest share', () => {
    const view = computeValuesSpending({
      values: [value('v1', 'Health', 0, ['a']), value('v2', 'Fun', 1, ['b'])],
      currentByCategory: { a: 70, b: 30 },
      previousByCategory: {},
    });
    expect(view.values.find((v) => v.id === 'v1')!.misaligned).toBe(false);
  });

  it('returns hasPlan=false for an empty plan', () => {
    const view = computeValuesSpending({ values: [], currentByCategory: { a: 50 }, previousByCategory: {} });
    expect(view).toEqual({
      hasPlan: false,
      totalSpend: 50,
      values: [],
      unassigned: { amount: 50, percentage: 100 },
    });
  });

  it('guards divide-by-zero when there is no spend', () => {
    const view = computeValuesSpending({
      values: [value('v1', 'Health', 0, ['a'])],
      currentByCategory: {},
      previousByCategory: {},
    });
    expect(view.totalSpend).toBe(0);
    expect(view.values[0]).toMatchObject({ amount: 0, percentage: 0, trendDirection: 'flat' });
    expect(view.unassigned).toEqual({ amount: 0, percentage: 0 });
  });
});
