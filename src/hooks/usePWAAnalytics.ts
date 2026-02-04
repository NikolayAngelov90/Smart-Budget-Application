/**
 * PWA Analytics Hook
 * Story 9-5: Add Export and PWA Analytics
 *
 * React hook for tracking PWA-related analytics events.
 * Handles: PWA installation, offline mode, and event buffering.
 */

'use client';

import { useEffect, useRef } from 'react';
import {
  trackPWAInstalled,
  trackOfflineModeActive,
  flushBufferedEvents,
  isOnline,
} from '@/lib/services/analyticsService';

/**
 * Estimate size of cached data using CacheStorage API
 * Returns size in bytes, or 0 if unavailable.
 */
async function estimateCachedDataSize(): Promise<number> {
  if (typeof caches === 'undefined') {
    return 0;
  }

  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();

      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.clone().blob();
          totalSize += blob.size;
        }
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * Hook to set up PWA analytics tracking
 *
 * AC-9.5.3: Track pwa_installed with platform
 * AC-9.5.4: Track offline_mode_active with cached_data_size
 * AC-9.5.6: Service Worker integration for PWA events
 * AC-9.5.8: Prevent duplicate PWA install events
 * AC-9.5.9: Offline event buffering (flush when back online)
 */
export function usePWAAnalytics(): void {
  const hasTrackedOffline = useRef(false);

  useEffect(() => {
    // Skip if running on server
    if (typeof window === 'undefined') {
      return;
    }

    // AC-9.5.3, AC-9.5.8: Handle PWA installation event
    const handleAppInstalled = () => {
      trackPWAInstalled().catch(() => {
        // Non-blocking - don't break app if tracking fails
      });
    };

    // AC-9.5.4: Handle going offline
    const handleOffline = async () => {
      // Prevent duplicate tracking for same offline session
      if (hasTrackedOffline.current) {
        return;
      }
      hasTrackedOffline.current = true;

      const cachedSize = await estimateCachedDataSize();
      trackOfflineModeActive(cachedSize).catch(() => {
        // Non-blocking - don't break app if tracking fails
      });
    };

    // AC-9.5.9: Handle coming back online - flush buffered events
    const handleOnline = () => {
      hasTrackedOffline.current = false;
      flushBufferedEvents().catch(() => {
        // Non-blocking - don't break app if flush fails
      });
    };

    // Add event listeners
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // AC-9.5.9: Flush any existing buffered events on mount if online
    if (isOnline()) {
      flushBufferedEvents().catch(() => {
        // Non-blocking
      });
    }

    // Cleanup on unmount
    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
}

export default usePWAAnalytics;
