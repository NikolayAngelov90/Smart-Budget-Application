/**
 * Insight taxonomy — Story 16.4
 *
 * The insights list used to be a flat, undifferentiated stream. This maps every
 * `insight_type` (migrations 001 + 016) to a semantic GROUP (so the page can show
 * "Needs attention / What changed / Recommendations / Progress" sections) and a
 * Quiet Ledger TONE token (so type colour comes from the design system rather
 * than raw Chakra colour schemes).
 *
 * Note both Epic-12 types (`spending_anomaly`, `new_high_spend_category`) are
 * mapped here — the card previously rendered them grey/generic because its local
 * colour map only knew the four original types.
 */

import type { Insight } from '@/types/database.types';

export type InsightGroupKey = 'attention' | 'changed' | 'recommend' | 'progress';

/** Semantic tone for an insight type (resolved to theme tokens by TONE_TOKENS). */
export type InsightTone = 'expense' | 'warning' | 'accent' | 'income';

/**
 * Tone -> actual semantic tokens. Kept here (not in the components) so every
 * insight surface colours identically. NOTE the amber pair is `warning.fg` /
 * `warning.subtle`: there is no bare `amber` semantic token in the theme.
 */
export const TONE_TOKENS: Record<InsightTone, { fg: string; subtle: string }> = {
  expense: { fg: 'expense', subtle: 'expense.subtle' },
  warning: { fg: 'warning.fg', subtle: 'warning.subtle' },
  accent: { fg: 'accent', subtle: 'accent.subtle' },
  income: { fg: 'income', subtle: 'income.subtle' },
};

/** Convenience: the `{ fg, subtle }` token pair for an insight type. */
export function getInsightToneTokens(type: string): { fg: string; subtle: string } {
  return TONE_TOKENS[getInsightTone(type)];
}

interface GroupMeta {
  group: InsightGroupKey;
  tone: InsightTone;
}

/**
 * type -> { group, tone }. Warnings read clay (money leaving / something wrong),
 * changes read amber (attention, not alarm), recommendations evergreen (the
 * app's guidance accent), progress evergreen-positive (income).
 */
const TYPE_META: Record<string, GroupMeta> = {
  unusual_expense: { group: 'attention', tone: 'expense' },
  spending_anomaly: { group: 'attention', tone: 'expense' },
  spending_increase: { group: 'changed', tone: 'warning' },
  new_high_spend_category: { group: 'changed', tone: 'warning' },
  budget_recommendation: { group: 'recommend', tone: 'accent' },
  positive_reinforcement: { group: 'progress', tone: 'income' },
};

/** Fallback for an unknown//future enum value — informational, never alarming. */
const FALLBACK: GroupMeta = { group: 'recommend', tone: 'accent' };

/** Section order: most actionable first. */
export const GROUP_ORDER: InsightGroupKey[] = [
  'attention',
  'changed',
  'recommend',
  'progress',
];

/** i18n key (insights namespace) for each group heading. */
export const GROUP_LABEL_KEY: Record<InsightGroupKey, string> = {
  attention: 'groupAttention',
  changed: 'groupChanged',
  recommend: 'groupRecommend',
  progress: 'groupProgress',
};

export function getInsightMeta(type: string): GroupMeta {
  return TYPE_META[type] ?? FALLBACK;
}

/** Semantic colour token for an insight type. */
export function getInsightTone(type: string): InsightTone {
  return getInsightMeta(type).tone;
}

export interface InsightGroup {
  key: InsightGroupKey;
  labelKey: string;
  insights: Insight[];
}

/**
 * Bucket insights into the ordered, NON-EMPTY groups.
 *
 * Order within a group is preserved exactly as received — the API already sorts
 * by priority, so re-sorting here would fight the server's ranking.
 */
export function groupInsights(insights: Insight[]): InsightGroup[] {
  const buckets = new Map<InsightGroupKey, Insight[]>();

  for (const insight of insights) {
    const { group } = getInsightMeta(insight.type);
    const bucket = buckets.get(group);
    if (bucket) {
      bucket.push(insight);
    } else {
      buckets.set(group, [insight]);
    }
  }

  return GROUP_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => ({
    key,
    labelKey: GROUP_LABEL_KEY[key],
    insights: buckets.get(key) as Insight[],
  }));
}

/**
 * Pick the spotlight insight: the highest-priority UNDISMISSED one.
 *
 * Returns `{ lead, rest }`. `lead` is null when nothing qualifies (e.g. the
 * "show dismissed" view, or an all-dismissed page) — the caller then renders a
 * plain grouped list. Ties keep the server's ordering (first wins).
 */
export function selectLeadInsight(insights: Insight[]): {
  lead: Insight | null;
  rest: Insight[];
} {
  let lead: Insight | null = null;

  for (const insight of insights) {
    if (insight.is_dismissed) continue;
    if (!lead || insight.priority > lead.priority) {
      lead = insight;
    }
  }

  if (!lead) return { lead: null, rest: insights };

  const leadId = lead.id;
  return { lead, rest: insights.filter((i) => i.id !== leadId) };
}
