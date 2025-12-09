'use client';

/**
 * useRealtimeSubscription Hook
 * Story 7.3: Code Quality Improvements
 *
 * React hook for subscribing to centralized Realtime transaction changes.
 * Automatically handles subscription lifecycle (subscribe on mount, unsubscribe on unmount).
 */

import { useEffect } from 'react';
import { realtimeManager, type RealtimeListener } from '@/lib/realtime/subscriptionManager';

/**
 * Hook for subscribing to transaction changes via centralized manager
 * @param callback - Function to call when a transaction change event occurs
 *
 * @example
 * ```ts
 * useRealtimeSubscription((event) => {
 *   console.log('Transaction changed:', event.eventType);
 *   mutate(); // Trigger SWR revalidation
 * });
 * ```
 */
export function useRealtimeSubscription(callback: RealtimeListener): void {
  useEffect(() => {
    // Subscribe to manager events
    realtimeManager.addListener(callback);

    // Cleanup: Unsubscribe on unmount
    return () => {
      realtimeManager.removeListener(callback);
    };
  }, [callback]);
}
