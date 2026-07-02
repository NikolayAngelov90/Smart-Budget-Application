'use client';

/**
 * useBudgets Hook — ADR-025
 *
 * SWR hook for the caller's category budgets with current-month usage.
 */

import useSWR from 'swr';
import type { BudgetsResponse } from '@/types/database.types';

export const BUDGETS_KEY = '/api/budgets';

async function fetcher(url: string): Promise<BudgetsResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch budgets');
  }
  return response.json();
}

export interface UseBudgetsResult {
  data: BudgetsResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => void;
}

export function useBudgets(): UseBudgetsResult {
  const { data, error, isLoading, mutate } = useSWR<BudgetsResponse>(BUDGETS_KEY, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
