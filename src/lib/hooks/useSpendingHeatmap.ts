/**
 * Story 11.3: Spending Heatmap
 * Custom Hook: useSpendingHeatmap
 *
 * Fetches daily spending data for heatmap visualization.
 * Re-fetches automatically when year/month parameters change.
 * Uses SWR for caching and automatic revalidation.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { DailySpendingEntry, HeatmapResponse } from '@/types/database.types';

interface UseSpendingHeatmapResult {
  data: DailySpendingEntry[];
  year: number;
  month: number;
  hasEnoughData: boolean;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<HeatmapResponse>;
}

/**
 * Hook to fetch daily spending aggregations for the heatmap.
 * The SWR key changes when year/month change, triggering a refetch.
 *
 * @param year - The year to fetch data for
 * @param month - The month (1-12) to fetch data for
 */
export function useSpendingHeatmap(year: number, month: number): UseSpendingHeatmapResult {
  const { data, error, isLoading, mutate } = useSWR<HeatmapResponse>(
    `/api/heatmap?year=${year}&month=${month}`,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch heatmap data');
      }
      return response.json();
    }
  );

  return {
    data: data?.data ?? [],
    year: data?.year ?? year,
    month: data?.month ?? month,
    hasEnoughData: data?.hasEnoughData ?? false,
    isLoading,
    error,
    mutate,
  };
}
