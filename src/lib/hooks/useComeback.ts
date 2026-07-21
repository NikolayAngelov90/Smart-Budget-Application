'use client';

/**
 * useComeback Hook — Story 15.4
 *
 * SWR hook for the active comeback challenge (+ derived progress). The GET
 * returns STATE only (never one-shot events — 15-3 HIGH lesson), so caching
 * is safe. Revalidated after every transaction save (both lists) so the
 * progress bar advances immediately.
 */

import useSWR, { type KeyedMutator } from 'swr';
import { useGamification } from '@/lib/hooks/useGamification';
import type { ComebackResponse } from '@/types/database.types';

export const COMEBACK_KEY = '/api/comeback';

async function fetcher(url: string): Promise<ComebackResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch comeback challenge');
  }
  return response.json();
}

export interface UseComebackResult {
  data: ComebackResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<ComebackResponse>;
}

export function useComeback(): UseComebackResult {
  // Story 15.6: null key while opted out. The comeback GET is create-on-read
  // (15-4); the hook + the gated imperative revalidations (AppLayout, dashboard
  // refresh) together reduce opted-out browsers creating challenges. The tx
  // POST create-on-log path still runs by design (data continuity, card hidden)
  // — so challenges may still be created; that is AC3-preserved accrual, not a
  // leak (the card is gated).
  const { enabled } = useGamification();
  const { data, error, isLoading, mutate } = useSWR<ComebackResponse>(enabled ? COMEBACK_KEY : null, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
