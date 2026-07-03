'use client';

/**
 * useWishlist Hook — Story 14.3
 *
 * SWR hook for the caller's wishlist items with read-time impact analysis.
 */

import useSWR from 'swr';
import type { WishlistResponse } from '@/types/database.types';

export const WISHLIST_KEY = '/api/wishlist';

async function fetcher(url: string): Promise<WishlistResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch wishlist');
  }
  return response.json();
}

export interface UseWishlistResult {
  data: WishlistResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => void;
}

export function useWishlist(): UseWishlistResult {
  const { data, error, isLoading, mutate } = useSWR<WishlistResponse>(WISHLIST_KEY, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
