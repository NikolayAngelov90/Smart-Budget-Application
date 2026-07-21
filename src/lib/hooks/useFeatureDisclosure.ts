'use client';

/**
 * useFeatureDisclosure Hook — Story 15.7 (FR37)
 *
 * SWR hook for the caller's progressive-disclosure state. The localStorage SWR
 * provider persists the cache across page loads (warm loads are instant), so
 * feature gates resolve without a network wait.
 *
 * FAIL-OPEN by design: isUnlocked returns true while loading or on error. A
 * data feature the user has already earned must NOT be hidden by a transient
 * disclosure fetch failure — the opposite fail direction from 15-6's
 * gamification gate (which fails closed to avoid flashing opted-out UI). Here
 * the harm is hiding something earned, so we fail open.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { DisclosureResponse } from '@/types/database.types';
import type { FeatureKey } from '@/lib/ai/disclosureCatalog';

export const DISCLOSURE_KEY = '/api/feature-disclosure';

async function fetcher(url: string): Promise<DisclosureResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch feature disclosure');
  }
  return response.json();
}

export interface UseFeatureDisclosureResult {
  unlocked: FeatureKey[];
  pending: FeatureKey[];
  isUnlocked: (key: FeatureKey) => boolean;
  acknowledge: (key: FeatureKey) => Promise<void>;
  isLoading: boolean;
  mutate: KeyedMutator<DisclosureResponse>;
}

export function useFeatureDisclosure(): UseFeatureDisclosureResult {
  const { data, isLoading, mutate } = useSWR<DisclosureResponse>(DISCLOSURE_KEY, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const unlocked = (data?.unlocked ?? []) as FeatureKey[];
  const pending = (data?.pending ?? []) as FeatureKey[];

  // Fail OPEN: no data yet (loading / error) -> treat as unlocked so an earned
  // feature never flashes hidden. Once data lands, honor the real set.
  const isUnlocked = (key: FeatureKey): boolean => (data ? unlocked.includes(key) : true);

  const acknowledge = async (key: FeatureKey): Promise<void> => {
    try {
      const res = await fetch('/api/feature-disclosure/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: key }),
      });
      if (!res.ok) return; // leave the cache; the intro re-shows next load
      const updated = (await res.json()) as DisclosureResponse;
      // Persist-first already done server-side; scrub the pending entry locally
      // with no revalidation (the response IS the truth).
      await mutate(updated, { revalidate: false });
    } catch {
      // Non-fatal — acknowledgment retries on the next dismiss
    }
  };

  return { unlocked, pending, isUnlocked, acknowledge, isLoading, mutate };
}
