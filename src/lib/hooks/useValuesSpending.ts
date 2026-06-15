/**
 * Story 14.2: Values-Context Spending View
 * Custom Hook: useValuesSpending
 *
 * The caller's current-month spend grouped by their values (Story 14.1 plan).
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { ValuesSpendingView } from '@/types/database.types';

interface ValuesSpendingResponse {
  data: ValuesSpendingView;
}

export interface UseValuesSpendingResult {
  view: ValuesSpendingView | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ValuesSpendingResponse>;
}

export function useValuesSpending(): UseValuesSpendingResult {
  const { data, error, isLoading, mutate } = useSWR<ValuesSpendingResponse>(
    '/api/values/spending',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch values spending');
      }
      return response.json();
    }
  );

  return {
    view: data?.data,
    isLoading,
    error,
    mutate,
  };
}
