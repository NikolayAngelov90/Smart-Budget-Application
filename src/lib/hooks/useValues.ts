/**
 * Story 14.1: Values-Based Spending Plan
 * Custom Hook: useValues
 *
 * The caller's values plan (priority order) with each value's mapped category ids.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { ValueWithCategories } from '@/types/database.types';

interface ValuesResponse {
  data: ValueWithCategories[];
}

export interface UseValuesResult {
  values: ValueWithCategories[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ValuesResponse>;
}

export function useValues(): UseValuesResult {
  const { data, error, isLoading, mutate } = useSWR<ValuesResponse>(
    '/api/values',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch values');
      }
      return response.json();
    }
  );

  return {
    values: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}
