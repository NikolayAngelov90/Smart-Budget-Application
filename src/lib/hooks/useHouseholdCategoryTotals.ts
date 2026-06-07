/**
 * Story 13.8: Shared Household Dashboard
 * Custom Hook: useHouseholdCategoryTotals
 *
 * Combined spending per shared household category (shared + category_only; private
 * excluded). Backed by the membership-gated household_category_totals RPC (Story 13.4)
 * via GET /api/households/category-totals — aggregates only, never individual rows.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { HouseholdCategoryTotal } from '@/types/database.types';

interface CategoryTotalsResponse {
  data: HouseholdCategoryTotal[];
}

export interface UseHouseholdCategoryTotalsResult {
  totals: HouseholdCategoryTotal[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<CategoryTotalsResponse>;
}

export function useHouseholdCategoryTotals(): UseHouseholdCategoryTotalsResult {
  const { data, error, isLoading, mutate } = useSWR<CategoryTotalsResponse>(
    '/api/households/category-totals',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch household category totals');
      }
      return response.json();
    }
  );

  return {
    totals: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}
