/**
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 * Custom Hook: useSubscriptions
 *
 * Fetches detected subscriptions for the authenticated user.
 * Uses SWR for caching and automatic revalidation.
 */

import useSWR from 'swr';
import type { DetectedSubscription } from '@/types/database.types';

interface SubscriptionsResponse {
  data: DetectedSubscription[];
  hasHistory: boolean;
  count: number;
}

interface UseSubscriptionsResult {
  subscriptions: DetectedSubscription[];
  hasHistory: boolean;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

/**
 * Hook to fetch and manage detected subscriptions.
 * Returns subscriptions sorted by status then amount (desc).
 */
export function useSubscriptions(): UseSubscriptionsResult {
  const { data, error, isLoading, mutate } = useSWR<SubscriptionsResponse>(
    '/api/subscriptions',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }
      return response.json();
    }
  );

  return {
    subscriptions: data?.data || [],
    hasHistory: data?.hasHistory ?? false,
    isLoading,
    error,
    mutate,
  };
}
