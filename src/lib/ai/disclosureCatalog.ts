/**
 * Feature Disclosure Catalog — Story 15.7 (FR37, ADR-022)
 *
 * The thresholds-in-a-constants-file that ADR-022 mandates. Each feature maps
 * a usage requirement to the intro copy key + deep link surfaced when the
 * threshold is first crossed. Client-safe and pure (no DB, no I/O).
 *
 * Thresholds are tuned so ESTABLISHED users already pass them (the disclosure
 * gate is non-regressive — see disclosureEngine): a user with 30+ transactions
 * already sees the heatmap; only genuinely new/low-usage users get the staged
 * reveal.
 */

export type FeatureKey = 'heatmap' | 'projections' | 'subscriptions';

export type DisclosureMetric = 'transactions_count' | 'days_active';

export interface FeatureDisclosure {
  /** The usage requirement that unlocks the feature */
  requirement: { metric: DisclosureMetric; value: number };
  /** i18n key under the `disclosure.intro` namespace */
  introKey: string;
  /** Where the intro's call-to-action links */
  url: string;
}

export const FEATURE_DISCLOSURE: Record<FeatureKey, FeatureDisclosure> = {
  // AC example verbatim: "You've logged 30 transactions — check out your
  // Spending Heatmap."
  heatmap: {
    requirement: { metric: 'transactions_count', value: 30 },
    introKey: 'heatmap',
    url: '/dashboard',
  },
  projections: {
    requirement: { metric: 'days_active', value: 14 },
    introKey: 'projections',
    url: '/dashboard',
  },
  subscriptions: {
    requirement: { metric: 'transactions_count', value: 50 },
    introKey: 'subscriptions',
    url: '/insights',
  },
};

/** All valid feature keys — for validating REST-exposed acknowledge writes */
export const FEATURE_KEYS = new Set<FeatureKey>(
  Object.keys(FEATURE_DISCLOSURE) as FeatureKey[]
);

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' && FEATURE_KEYS.has(value as FeatureKey);
}
