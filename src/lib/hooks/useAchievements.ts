'use client';

/**
 * useAchievements Hook — Story 15.3
 *
 * SWR hook for the caller's unlocked achievements (gallery). The localStorage
 * SWR provider persists the cache across page loads; revalidates on focus.
 * Immediate unlock feedback travels via toasts (tx POST / score GET payloads),
 * so this key does NOT need to join the dashboard revalidation lists.
 */

import useSWR, { type KeyedMutator } from 'swr';
import { useGamification } from '@/lib/hooks/useGamification';
import type { AchievementsResponse } from '@/types/database.types';

export const ACHIEVEMENTS_KEY = '/api/achievements';

async function fetcher(url: string): Promise<AchievementsResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch achievements');
  }
  return response.json();
}

export interface UseAchievementsResult {
  data: AchievementsResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<AchievementsResponse>;
}

export function useAchievements(): UseAchievementsResult {
  // Story 15.6: null key while opted out — no fetch, no cache write
  const { enabled } = useGamification();
  const { data, error, isLoading, mutate } = useSWR<AchievementsResponse>(
    enabled ? ACHIEVEMENTS_KEY : null,
    fetcher,
    {
      dedupingInterval: 5000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    }
  );

  return { data, error, isLoading, mutate };
}
