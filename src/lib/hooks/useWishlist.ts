'use client';

/**
 * useWishlist Hook — Story 14.3
 *
 * SWR hook for the caller's wishlist items with read-time impact analysis.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { WishlistResponse } from '@/types/database.types';
import { clientTodayParam } from '@/lib/utils/date';

/**
 * The KEY constants are now PREFIXES, not whole keys: each request carries the
 * client's local `?today=`, because the server runs UTC and would otherwise put
 * the month boundary in the wrong place for hours of every day. The param also
 * rolls the cache over at local midnight, so an open tab picks up the new day.
 *
 * Anything revalidating these must match by PREFIX — an exact-key mutate stops
 * matching and goes silently stale.
 */
export const WISHLIST_KEY = '/api/wishlist';

/** Full request URL for the client's current local day. */
function wishlistUrl(): string {
  return `${WISHLIST_KEY}?today=${clientTodayParam()}`;
}

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
  /** Full SWR mutator so callers can do optimistic cache updates */
  mutate: KeyedMutator<WishlistResponse>;
}

export function useWishlist(): UseWishlistResult {
  const { data, error, isLoading, mutate } = useSWR<WishlistResponse>(wishlistUrl(), fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
