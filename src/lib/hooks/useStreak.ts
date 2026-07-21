'use client';

/**
 * useStreak Hook — Story 15.1
 *
 * SWR hook for the caller's logging streak. The localStorage SWR provider
 * persists this cache across page loads, so the badge paints instantly
 * (<100ms, no network); background revalidation reconciles with server truth.
 */

import useSWR, { type KeyedMutator } from 'swr';
import { useGamification } from '@/lib/hooks/useGamification';
import type { StreakResponse } from '@/types/database.types';

export const STREAK_KEY = '/api/streaks';

async function fetcher(url: string): Promise<StreakResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch streak');
  }
  return response.json();
}

export interface UseStreakResult {
  data: StreakResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  /** Full SWR mutator so callers can apply the optimistic client-engine advance */
  mutate: KeyedMutator<StreakResponse>;
}

export function useStreak(): UseStreakResult {
  // Story 15.6: gating INSIDE the hook covers every consumer at one point —
  // a null key means no fetch and no cache write while opted out. Scoped
  // mutates of STREAK_KEY elsewhere (dashboard/AppLayout onSuccess) become
  // harmless no-ops for the unmounted key.
  const { enabled } = useGamification();
  const { data, error, isLoading, mutate } = useSWR<StreakResponse>(enabled ? STREAK_KEY : null, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
