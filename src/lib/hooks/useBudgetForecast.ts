/**
 * Story 12.2: End-of-Month Budget Projections
 * Custom Hook: useBudgetForecast
 *
 * Fetches end-of-month spending forecasts for the authenticated user.
 * Uses SWR for caching and automatic revalidation.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { CategoryForecast, ForecastResponse } from '@/types/database.types';

export interface UseBudgetForecastResult {
  forecasts: CategoryForecast[];
  hasCurrentMonthData: boolean;
  generated_at: string | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ForecastResponse>;
}

export function useBudgetForecast(): UseBudgetForecastResult {
  const { data, error, isLoading, mutate } = useSWR<ForecastResponse>(
    '/api/dashboard/budget-forecast',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch budget forecast');
      }
      return response.json();
    }
  );

  return {
    forecasts: data?.forecasts ?? [],
    hasCurrentMonthData: data?.hasCurrentMonthData ?? false,
    generated_at: data?.generated_at ?? null,
    isLoading,
    error,
    mutate,
  };
}
