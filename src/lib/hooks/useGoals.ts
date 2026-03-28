/**
 * Story 11.5: Savings Goals
 * Custom Hook: useGoals
 *
 * Fetches savings goals for the authenticated user.
 * Uses SWR for caching and automatic revalidation.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { Goal, GoalsListResponse } from '@/types/database.types';

interface UseGoalsResult {
  goals: Goal[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<GoalsListResponse>;
}

/**
 * Hook to fetch and manage savings goals.
 * Static SWR key — no parameters needed.
 */
export function useGoals(): UseGoalsResult {
  const { data, error, isLoading, mutate } = useSWR<GoalsListResponse>(
    '/api/goals',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch goals');
      }
      return response.json() as Promise<GoalsListResponse>;
    }
  );

  return {
    goals: data?.goals ?? [],
    isLoading,
    error,
    mutate,
  };
}
