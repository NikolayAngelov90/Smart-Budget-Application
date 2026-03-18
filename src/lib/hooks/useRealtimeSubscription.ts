'use client';

/**
 * useRealtimeSubscription Hook
 * Story 7.3: Code Quality Improvements
 *
 * React hook for subscribing to centralized Realtime transaction changes.
 * Automatically handles subscription lifecycle (subscribe on mount, unsubscribe on unmount).
 */

import { useEffect, useRef } from 'react';
import { realtimeManager, type RealtimeListener } from '@/lib/realtime/subscriptionManager';

/**
 * Hook for subscribing to transaction changes via centralized manager.
 * Uses a stable ref wrapper so the subscription is only set up once on mount
 * and torn down on unmount, avoiding churn when callers pass inline callbacks.
 *
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
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // Stable wrapper that always calls the latest callback
    const stableListener: RealtimeListener = (event) => {
      callbackRef.current(event);
    };

    realtimeManager.addListener(stableListener);

    return () => {
      realtimeManager.removeListener(stableListener);
    };
  }, []);
}
