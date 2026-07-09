'use client';

/**
 * useStreak Hook — Story 15.1
 *
 * SWR hook for the caller's logging streak. The localStorage SWR provider
 * persists this cache across page loads, so the badge paints instantly
 * (<100ms, no network); background revalidation reconciles with server truth.
 */

import useSWR, { type KeyedMutator } from 'swr';
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
  const { data, error, isLoading, mutate } = useSWR<StreakResponse>(STREAK_KEY, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
