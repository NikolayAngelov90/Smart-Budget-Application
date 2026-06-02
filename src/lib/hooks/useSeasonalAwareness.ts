/**
 * Story 12.5 / FR6: Seasonal & Cyclical Spending Awareness
 * Custom Hook: useSeasonalAwareness
 *
 * Fetches the 6-month seasonal outlook via SWR.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { SeasonalAwarenessResponse, SeasonalMonth } from '@/types/database.types';

export interface UseSeasonalAwarenessResult {
  timeline: SeasonalMonth[];
  baselineMonthly: number;
  monthsAnalyzed: number;
  hasEnoughData: boolean;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<SeasonalAwarenessResponse>;
}

export function useSeasonalAwareness(): UseSeasonalAwarenessResult {
  const { data, error, isLoading, mutate } = useSWR<SeasonalAwarenessResponse>(
    '/api/dashboard/seasonal',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch seasonal awareness');
      }
      return response.json();
    }
  );

  return {
    timeline: data?.timeline ?? [],
    baselineMonthly: data?.baseline_monthly ?? 0,
    monthsAnalyzed: data?.months_analyzed ?? 0,
    hasEnoughData: data?.hasEnoughData ?? false,
    isLoading,
    error,
    mutate,
  };
}
