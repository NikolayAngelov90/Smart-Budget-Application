/**
 * insightGroups — Story 16.4 taxonomy helper.
 *
 * Guards the two things the redesigned Insights page depends on: every enum
 * value maps to a group + tone (including the Epic-12 types the old card map
 * missed), and the lead/group selection preserves the server's priority order.
 */

import {
  getInsightMeta,
  getInsightTone,
  groupInsights,
  selectLeadInsight,
  GROUP_ORDER,
} from '@/lib/utils/insightGroups';
import type { Insight } from '@/types/database.types';

const ins = (over: Partial<Insight>): Insight =>
  ({
    id: 'i1',
    user_id: 'u1',
    type: 'budget_recommendation',
    title: 't',
    description: 'd',
    priority: 3,
    is_dismissed: false,
    metadata: null,
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  }) as Insight;

// Every value of the insight_type enum (migrations 001 + 016).
const ALL_TYPES = [
  'spending_increase',
  'budget_recommendation',
  'unusual_expense',
  'positive_reinforcement',
  'spending_anomaly',
  'new_high_spend_category',
];

describe('getInsightMeta / getInsightTone', () => {
  it('maps ALL six enum types to a known group + tone', () => {
    for (const type of ALL_TYPES) {
      const meta = getInsightMeta(type);
      expect(GROUP_ORDER).toContain(meta.group);
      expect(['expense', 'warning', 'accent', 'income']).toContain(meta.tone);
    }
  });

  it('gives the Epic-12 types real (non-fallback) mappings', () => {
    // These previously fell through to grey/InfoIcon in AIInsightCard.
    expect(getInsightMeta('spending_anomaly')).toEqual({ group: 'attention', tone: 'expense' });
    expect(getInsightMeta('new_high_spend_category')).toEqual({ group: 'changed', tone: 'warning' });
  });

  it('uses semantic tones: warnings clay, changes amber, progress income', () => {
    expect(getInsightTone('unusual_expense')).toBe('expense');
    expect(getInsightTone('spending_increase')).toBe('warning');
    expect(getInsightTone('budget_recommendation')).toBe('accent');
    expect(getInsightTone('positive_reinforcement')).toBe('income');
  });

  it('falls back safely for an unknown/future type', () => {
    const meta = getInsightMeta('some_future_type');
    expect(meta.group).toBe('recommend');
    expect(meta.tone).toBe('accent');
  });
});

describe('groupInsights', () => {
  it('buckets into ordered groups and omits empty ones', () => {
    const groups = groupInsights([
      ins({ id: 'a', type: 'positive_reinforcement' }),
      ins({ id: 'b', type: 'unusual_expense' }),
      ins({ id: 'c', type: 'spending_increase' }),
    ]);

    // No 'recommend' group here → omitted; the rest keep GROUP_ORDER.
    expect(groups.map((g) => g.key)).toEqual(['attention', 'changed', 'progress']);
    expect(groups[0]!.insights.map((i) => i.id)).toEqual(['b']);
  });

  it('preserves the server ordering within a group (never re-sorts)', () => {
    const groups = groupInsights([
      ins({ id: 'first', type: 'unusual_expense', priority: 2 }),
      ins({ id: 'second', type: 'spending_anomaly', priority: 5 }),
    ]);

    expect(groups).toHaveLength(1);
    // Same group; the low-priority one stays first because the API ordered it so.
    expect(groups[0]!.insights.map((i) => i.id)).toEqual(['first', 'second']);
  });

  it('keeps dismissed insights in their group', () => {
    const groups = groupInsights([ins({ id: 'd', type: 'unusual_expense', is_dismissed: true })]);
    expect(groups[0]!.insights.map((i) => i.id)).toEqual(['d']);
  });

  it('returns [] for no insights', () => {
    expect(groupInsights([])).toEqual([]);
  });
});

describe('selectLeadInsight', () => {
  it('picks the highest-priority undismissed insight and removes it from the rest', () => {
    const list = [
      ins({ id: 'low', priority: 2 }),
      ins({ id: 'top', priority: 5 }),
      ins({ id: 'mid', priority: 3 }),
    ];

    const { lead, rest } = selectLeadInsight(list);

    expect(lead?.id).toBe('top');
    expect(rest.map((i) => i.id)).toEqual(['low', 'mid']);
  });

  it('never picks a dismissed insight, even at higher priority', () => {
    const { lead } = selectLeadInsight([
      ins({ id: 'dismissed-high', priority: 5, is_dismissed: true }),
      ins({ id: 'live-low', priority: 1 }),
    ]);

    expect(lead?.id).toBe('live-low');
  });

  it('returns lead=null and the untouched list when everything is dismissed', () => {
    const list = [
      ins({ id: 'a', is_dismissed: true }),
      ins({ id: 'b', is_dismissed: true }),
    ];

    const { lead, rest } = selectLeadInsight(list);

    expect(lead).toBeNull();
    expect(rest.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('keeps the server order on a priority tie (first wins)', () => {
    const { lead } = selectLeadInsight([
      ins({ id: 'first', priority: 4 }),
      ins({ id: 'second', priority: 4 }),
    ]);

    expect(lead?.id).toBe('first');
  });

  it('handles an empty list', () => {
    expect(selectLeadInsight([])).toEqual({ lead: null, rest: [] });
  });
});
