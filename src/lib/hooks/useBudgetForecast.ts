/**
 * Story 12.2: End-of-Month Budget Projections
 * Custom Hook: useBudgetForecast
 *
 * Fetches end-of-month spending forecasts for the authenticated user.
 * Uses SWR for caching and automatic revalidation.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { CategoryForecast, ForecastResponse } from '@/types/database.types';
import { clientTodayParam } from '@/lib/utils/date';

/** PREFIX, not a whole key — requests carry the client's local `?today=`. */
export const BUDGET_FORECAST_KEY = '/api/dashboard/budget-forecast';

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
    `${BUDGET_FORECAST_KEY}?today=${clientTodayParam()}`,
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
