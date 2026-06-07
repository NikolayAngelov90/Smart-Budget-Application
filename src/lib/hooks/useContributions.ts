/**
 * Story 13.7: Income-Proportional Contribution Splits
 * Custom Hook: useContributions
 *
 * Fetches the household contribution summary (per-member percentage, fair share,
 * contributed, progress). Membership-gated server-side.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { ContributionSummary } from '@/types/database.types';

interface ContributionsResponse {
  data: ContributionSummary;
}

export interface UseContributionsResult {
  summary: ContributionSummary | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ContributionsResponse>;
}

export function useContributions(): UseContributionsResult {
  const { data, error, isLoading, mutate } = useSWR<ContributionsResponse>(
    '/api/households/contributions',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch contributions');
      }
      return response.json();
    }
  );

  return {
    summary: data?.data ?? null,
    isLoading,
    error,
    mutate,
  };
}
