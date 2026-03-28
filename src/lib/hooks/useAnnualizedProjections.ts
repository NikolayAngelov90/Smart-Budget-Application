/**
 * Story 11.4: Annualized Spending Projections
 * Custom Hook: useAnnualizedProjections
 *
 * Fetches annualized spending projections for the authenticated user.
 * Uses SWR for caching and automatic revalidation.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { CategoryProjection, ProjectionsResponse } from '@/types/database.types';

interface UseAnnualizedProjectionsResult {
  projections: CategoryProjection[];
  hasEnoughData: boolean;
  months_analyzed: number;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ProjectionsResponse>;
}

/**
 * Hook to fetch annualized spending projections.
 * Static SWR key — no parameters needed.
 */
export function useAnnualizedProjections(): UseAnnualizedProjectionsResult {
  const { data, error, isLoading, mutate } = useSWR<ProjectionsResponse>(
    '/api/dashboard/annualized-projections',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch projections');
      }
      return response.json();
    }
  );

  return {
    projections: data?.projections ?? [],
    hasEnoughData: data?.hasEnoughData ?? false,
    months_analyzed: data?.months_analyzed ?? 0,
    isLoading,
    error,
    mutate,
  };
}
