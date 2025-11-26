'use client';

/**
 * useMonthOverMonth Hook
 * Story 5.5: Month-over-Month Comparison Highlights
 *
 * SWR hook for fetching month-over-month spending comparison data
 */

import useSWR from 'swr';

/**
 * Category change data point
 */
export interface CategoryChangeData {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  currentAmount: number;              // Spending this month
  previousAmount: number;             // Spending last month
  percentChange: number;              // ((current - previous) / previous) * 100
  absoluteChange: number;             // current - previous
  direction: 'increase' | 'decrease'; // For rendering up/down arrows
}

/**
 * API response type for month-over-month comparison
 */
export interface MonthOverMonthResponse {
  changes: CategoryChangeData[];      // Filtered to significant changes (>20%)
  currentMonth: string;               // YYYY-MM
  previousMonth: string;              // YYYY-MM
}

/**
 * Fetcher function for SWR
 * @param url - API endpoint URL
 * @returns Month-over-month comparison response
 */
async function fetcher(url: string): Promise<MonthOverMonthResponse> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch month-over-month comparison');
  }

  return response.json();
}

/**
 * Hook return type
 */
export interface UseMonthOverMonthResult {
  data: MonthOverMonthResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => void;
}

/**
 * Custom hook for fetching month-over-month comparison with SWR
 * @param month - Optional month in YYYY-MM format (defaults to current month)
 * @returns Comparison data, error, loading state, and mutate function
 */
export function useMonthOverMonth(month?: string): UseMonthOverMonthResult {
  const url = month
    ? `/api/dashboard/month-over-month?month=${month}`
    : '/api/dashboard/month-over-month';

  const { data, error, isLoading, mutate } = useSWR<MonthOverMonthResponse>(
    url,
    fetcher,
    {
      // Deduplicate requests within 5 seconds for reasonable caching
      dedupingInterval: 5000,
      // Revalidate when window regains focus
      revalidateOnFocus: true,
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
