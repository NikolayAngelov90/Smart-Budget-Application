'use client';

/**
 * useSpendingByCategory Hook
 * Story 5.3: Monthly Spending by Category (Pie/Donut Chart)
 *
 * SWR hook for fetching spending breakdown by category
 */

import useSWR from 'swr';

/**
 * API response type for spending by category
 */
export interface SpendingByCategoryResponse {
  month: string; // YYYY-MM format
  total: number; // Total expenses for the month
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
 * @param month - Optional month in YYYY-MM format (defaults to current month)
 * @returns Spending data, error, loading state, and mutate function
 */
export function useSpendingByCategory(month?: string): UseSpendingByCategoryResult {
  const url = month
    ? `/api/dashboard/spending-by-category?month=${month}`
    : '/api/dashboard/spending-by-category';

  const { data, error, isLoading, mutate } = useSWR<SpendingByCategoryResponse>(
    url,
    fetcher,
    {
      // Deduplicate requests within 1 second for faster updates
      dedupingInterval: 1000,
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
