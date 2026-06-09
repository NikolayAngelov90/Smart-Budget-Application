/**
 * householdInsightEngine tests — Story 13.10 (pure, deterministic)
 */

import {
  detectHouseholdCategoryChanges,
  detectHouseholdSpendChange,
  generateHouseholdInsights,
} from '@/lib/ai/householdInsightEngine';
import type { HouseholdPeriodTotal } from '@/types/database.types';

function cat(id: string, name: string, total: number): HouseholdPeriodTotal {
  return { category_id: id, category_name: name, total };
}

describe('detectHouseholdCategoryChanges', () => {
  it('frames a spend increase as "more" with the right percentage', () => {
    const insights = detectHouseholdCategoryChanges({
      currency: 'EUR',
      current: [cat('c1', 'Groceries', 120)],
      previous: [cat('c1', 'Groceries', 100)],
    });
    expect(insights).toHaveLength(1);
    expect(insights[0]!.title).toBe('Your household spent 20% more on Groceries this month');
    expect(insights[0]!.metadata.percent_change).toBe(20);
  });

  it('frames a decrease as "less"', () => {
    const insights = detectHouseholdCategoryChanges({
      currency: 'EUR',
      current: [cat('c1', 'Dining', 70)],
      previous: [cat('c1', 'Dining', 100)],
    });
    expect(insights[0]!.title).toBe('Your household spent 30% less on Dining this month');
  });

  it('suppresses changes below the 15% threshold', () => {
    const insights = detectHouseholdCategoryChanges({
      currency: 'EUR',
      current: [cat('c1', 'Groceries', 105)],
      previous: [cat('c1', 'Groceries', 100)],
    });
    expect(insights).toEqual([]);
  });

  it('suppresses categories below the baseline floor (avoids noise / divide-by-near-zero)', () => {
    const insights = detectHouseholdCategoryChanges({
      currency: 'EUR',
      current: [cat('c1', 'Tiny', 50)],
      previous: [cat('c1', 'Tiny', 5)], // below BASELINE_FLOOR (20)
    });
    expect(insights).toEqual([]);
  });

  it('does not divide by zero when previous is absent', () => {
    const insights = detectHouseholdCategoryChanges({
      currency: 'EUR',
      current: [cat('c1', 'New', 200)],
      previous: [],
    });
    expect(insights).toEqual([]);
  });

  it('caps at 3 and sorts by largest swing first', () => {
    const insights = detectHouseholdCategoryChanges({
      currency: 'EUR',
      current: [cat('a', 'A', 200), cat('b', 'B', 300), cat('c', 'C', 130), cat('d', 'D', 125)],
      previous: [cat('a', 'A', 100), cat('b', 'B', 100), cat('c', 'C', 100), cat('d', 'D', 100)],
    });
    expect(insights).toHaveLength(3);
    expect(insights[0]!.metadata.category_name).toBe('B'); // +200% biggest
  });
});

describe('detectHouseholdSpendChange', () => {
  it('reports overall higher spend', () => {
    const insights = detectHouseholdSpendChange({
      currency: 'EUR',
      current: [cat('a', 'A', 150), cat('b', 'B', 150)],
      previous: [cat('a', 'A', 100), cat('b', 'B', 100)],
    });
    expect(insights).toHaveLength(1);
    expect(insights[0]!.title).toContain('50% higher');
  });

  it('returns nothing below threshold', () => {
    expect(
      detectHouseholdSpendChange({ currency: 'EUR', current: [cat('a', 'A', 105)], previous: [cat('a', 'A', 100)] })
    ).toEqual([]);
  });
});

describe('generateHouseholdInsights', () => {
  it('returns [] for empty inputs', () => {
    expect(generateHouseholdInsights({ currency: 'EUR', current: [], previous: [] })).toEqual([]);
  });

  it('combines overall + per-category insights (overall first)', () => {
    const insights = generateHouseholdInsights({
      currency: 'EUR',
      current: [cat('c1', 'Groceries', 200)],
      previous: [cat('c1', 'Groceries', 100)],
    });
    expect(insights[0]!.type).toBe('household_spend_change');
    expect(insights.some((i) => i.type === 'household_category_change')).toBe(true);
  });
});
