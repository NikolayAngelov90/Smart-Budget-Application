/**
 * Story 13.10: Household-Level AI Insights
 * Custom Hook: useHouseholdInsights
 *
 * Household-framed spending insights for the caller's household (computed on-demand).
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { HouseholdInsight } from '@/types/database.types';

interface HouseholdInsightsResponse {
  data: HouseholdInsight[];
}

export interface UseHouseholdInsightsResult {
  insights: HouseholdInsight[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<HouseholdInsightsResponse>;
}

export function useHouseholdInsights(): UseHouseholdInsightsResult {
  const { data, error, isLoading, mutate } = useSWR<HouseholdInsightsResponse>(
    '/api/households/insights',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch household insights');
      }
      return response.json();
    }
  );

  return {
    insights: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}
