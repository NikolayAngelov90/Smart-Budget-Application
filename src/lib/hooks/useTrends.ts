'use client';

/**
 * useTrends Hook
 * Story 5.4: Spending Trends Over Time (Line Chart)
 *
 * SWR hook for fetching spending trends over time
 */

import useSWR from 'swr';

/**
 * Monthly trend data point
 */
export interface MonthlyTrendData {
  month: string;                      // YYYY-MM format
  monthLabel: string;                 // "Jan", "Feb", "Mar" for chart display
  income: number;                     // Total income for this month
  expenses: number;                   // Total expenses for this month
  net: number;                        // income - expenses
}

/**
 * API response type for spending trends
 */
export interface SpendingTrendsResponse {
  months: MonthlyTrendData[];         // Last N months (default 6)
  startDate: string;                  // ISO date of first month
  endDate: string;                    // ISO date of last month
}

/**
 * Fetcher function for SWR
 * @param url - API endpoint URL
 * @returns Spending trends response
 */
async function fetcher(url: string): Promise<SpendingTrendsResponse> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch spending trends');
  }

  return response.json();
}

/**
 * Hook return type
 */
export interface UseTrendsResult {
  data: SpendingTrendsResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => void;
}

/**
 * Custom hook for fetching spending trends with SWR
 * @param months - Optional number of months to fetch (defaults to 6)
 * @returns Trends data, error, loading state, and mutate function
 */
export function useTrends(months?: number): UseTrendsResult {
  const url = months
    ? `/api/dashboard/trends?months=${months}`
    : '/api/dashboard/trends';

  const { data, error, isLoading, mutate } = useSWR<SpendingTrendsResponse>(
    url,
    fetcher,
    {
      // Deduplicate requests within 5 seconds for reasonable caching
      dedupingInterval: 5000,
      // Revalidate when window regains focus
      revalidateOnFocus: true,
      // Revalidate on network reconnect
      revalidateOnReconnect: true,
      // Revalidate on mount
      revalidateOnMount: true,
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Disable automatic revalidation interval (we'll use Realtime instead)
      refreshInterval: 0,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}
