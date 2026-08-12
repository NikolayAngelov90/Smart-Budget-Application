/**
 * Story 12.2: End-of-Month Budget Projections
 * Custom Hook: useBudgetForecast
 *
 * Fetches end-of-month spending forecasts for the authenticated user.
 * Uses SWR for caching and automatic revalidation.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { CategoryForecast, ForecastResponse } from '@/types/database.types';
import { useDatedParams } from '@/lib/hooks/useClientToday';

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

/**
 * HP-7: the day comes from `useClientToday()`, which re-renders when the
 * local day changes. Calling `clientTodayParam()` inline looked equivalent
 * but only recomputed on a render that happened for some OTHER reason — an
 * idle tab kept yesterday's key and `revalidateOnFocus` refetched that same
 * stale key, so a dashboard left open overnight showed last month on the 1st.
 */
export function useBudgetForecast(): UseBudgetForecastResult {
  const dated = useDatedParams();
  const { data, error, isLoading, mutate } = useSWR<ForecastResponse>(
    `${BUDGET_FORECAST_KEY}?${dated}`,
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
