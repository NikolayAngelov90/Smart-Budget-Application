/**
 * Story 13.9: Shared Household Savings Goals
 * Custom Hook: useHouseholdGoals
 *
 * Shared goals for the caller's household, each with its per-member breakdown.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { HouseholdGoalWithBreakdown } from '@/types/database.types';

interface HouseholdGoalsResponse {
  data: HouseholdGoalWithBreakdown[];
}

export interface UseHouseholdGoalsResult {
  goals: HouseholdGoalWithBreakdown[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<HouseholdGoalsResponse>;
}

export function useHouseholdGoals(): UseHouseholdGoalsResult {
  const { data, error, isLoading, mutate } = useSWR<HouseholdGoalsResponse>(
    '/api/households/goals',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch household goals');
      }
      return response.json();
    }
  );

  return {
    goals: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}
