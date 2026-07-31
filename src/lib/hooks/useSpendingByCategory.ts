'use client';

/**
 * useSpendingByCategory Hook
 * Story 5.3: Monthly Spending by Category (Pie/Donut Chart)
 *
 * SWR hook for fetching spending breakdown by category
 */

import useSWR from 'swr';
import { clientTodayParam } from '@/lib/utils/date';
import type { DashboardPeriod } from '@/lib/utils/dashboardPeriod';

/** PREFIX, not a whole key — requests carry `?today=` and may carry `?period=`. */
export const SPENDING_BY_CATEGORY_KEY = '/api/dashboard/spending-by-category';

/**
 * API response type for spending by category
 */
export interface SpendingByCategoryResponse {
  month: string; // YYYY-MM format
  /** The window the server actually aggregated — label from this, not from the
   *  pending selection (see the hook's note below). */
  period?: DashboardPeriod;
  total: number; // Total expenses for the window
  categories: Array<{
    category_id: string;
    category_name: string;
    category_color: string;
    amount: number;
    percentage: number; // 0-100
    transaction_count: number;
  }>;
}

/**
 * Fetcher function for SWR
 * @param url - API endpoint URL
 * @returns Spending by category response
 */
async function fetcher(url: string): Promise<SpendingByCategoryResponse> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch spending by category');
  }

  return response.json();
}

/**
 * Hook return type
 */
export interface UseSpendingByCategoryResult {
  data: SpendingByCategoryResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => void;
}

/**
 * Custom hook for fetching spending by category with SWR
 *
 * HP-1: the key now ALWAYS carries the client's local `?today=`. The route has
 * accepted it since the deferred-work batch — but this hook never sent it, so
 * the fix was live on the categories screen (which fetches the URL directly)
 * and inert on the dashboard. The two screens then disagreed: at 01:30 on the
 * 1st, a UTC+3 user saw an empty categories screen and a donut still showing
 * the whole of last month. Same endpoint, same user, two answers, no error.
 *
 * @param month - Optional month in YYYY-MM format (an explicit drill-down; wins over `period`)
 * @param period - Optional dashboard period (defaults server-side to `month`)
 * @returns Spending data, error, loading state, and mutate function
 */
export function useSpendingByCategory(
  month?: string,
  period?: DashboardPeriod
): UseSpendingByCategoryResult {
  const params = new URLSearchParams();
  if (month) {
    params.set('month', month);
  } else if (period) {
    params.set('period', period);
  }
  params.set('today', clientTodayParam());
  const url = `${SPENDING_BY_CATEGORY_KEY}?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<SpendingByCategoryResponse>(
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
