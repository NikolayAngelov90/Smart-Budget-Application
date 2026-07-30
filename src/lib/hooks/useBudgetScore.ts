'use client';

/**
 * useBudgetScore Hook — Story 15.2
 *
 * SWR hook for the caller's Budget Score. The localStorage SWR provider
 * persists this cache across page loads (instant repaint); tx-save onSuccess
 * revalidates SCORE_KEY so the score updates after each transaction (AC #4).
 */

import useSWR, { type KeyedMutator } from 'swr';
import { useGamification } from '@/lib/hooks/useGamification';
import type { BudgetScoreResponse } from '@/types/database.types';
import { clientTodayParam } from '@/lib/utils/date';

/**
 * The KEY constants are now PREFIXES, not whole keys: each request carries the
 * client's local `?today=`, because the server runs UTC and would otherwise put
 * the month boundary in the wrong place for hours of every day. The param also
 * rolls the cache over at local midnight, so an open tab picks up the new day.
 *
 * Anything revalidating these must match by PREFIX — an exact-key mutate stops
 * matching and goes silently stale.
 */
export const SCORE_KEY = '/api/gamification/score';

/** Full request URL for the client's current local day. */
function scoreUrl(): string {
  return `${SCORE_KEY}?today=${clientTodayParam()}`;
}

async function fetcher(url: string): Promise<BudgetScoreResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch budget score');
  }
  return response.json();
}

export interface UseBudgetScoreResult {
  data: BudgetScoreResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<BudgetScoreResponse>;
}

export function useBudgetScore(): UseBudgetScoreResult {
  // Story 15.6: null key while opted out. Best-effort (the authoritative gate
  // is the component null-return + the pushService suppression): the score GET
  // is also a server-side achievement-evaluation point, so this reduces — but
  // does not alone guarantee — opted-out browsers triggering it. Imperative
  // revalidations (AppLayout quick-add, dashboard pull-to-refresh) are gated
  // separately on the same pref so the reduction actually holds.
  const { enabled } = useGamification();
  const { data, error, isLoading, mutate } = useSWR<BudgetScoreResponse>(enabled ? scoreUrl() : null, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
