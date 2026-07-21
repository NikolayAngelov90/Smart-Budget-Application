/**
 * Feature Disclosure Engine — Story 15.7 (FR37, ADR-022)
 *
 * Pure, deterministic (Epic-12 style — no DB, no I/O). Given a user's usage
 * state + the show-all escape hatch, computes which features are unlocked and
 * which have a pending introduction (unlocked but not yet acknowledged).
 */

import {
  FEATURE_DISCLOSURE,
  FEATURE_KEYS,
  type FeatureKey,
} from '@/lib/ai/disclosureCatalog';

export interface DisclosureState {
  transactions_count: number;
  days_active: number;
  /** Feature keys the user has already been introduced to (persisted) */
  features_unlocked: string[];
}

export interface DisclosureResult {
  /** Features currently available to the user */
  unlocked: FeatureKey[];
  /** Unlocked features not yet introduced — at most surfaced once each */
  pending: FeatureKey[];
}

/**
 * @param showAll settings escape hatch (AC2): reveal everything, but WITHOUT
 *   forcing intros — opting in to see all features should not spam the user
 *   with a stack of "new feature!" cards.
 */
export function computeDisclosure(
  state: DisclosureState,
  showAll: boolean
): DisclosureResult {
  const metricValue = (metric: 'transactions_count' | 'days_active'): number => {
    const raw = state[metric];
    // unknowable / absent != met — treat as 0 (never over-unlock on bad data)
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
  };

  const acknowledged = new Set(state.features_unlocked ?? []);

  const unlocked: FeatureKey[] = [];
  const pending: FeatureKey[] = [];

  // Iterate catalog order for a deterministic result
  for (const key of FEATURE_KEYS) {
    const { requirement } = FEATURE_DISCLOSURE[key];
    const thresholdMet = metricValue(requirement.metric) >= requirement.value;

    if (showAll || thresholdMet) {
      unlocked.push(key);
      // Escape hatch reveals without nagging; a naturally-crossed threshold
      // surfaces the intro once (until acknowledged)
      if (!showAll && !acknowledged.has(key)) {
        pending.push(key);
      }
    }
  }

  return { unlocked, pending };
}
