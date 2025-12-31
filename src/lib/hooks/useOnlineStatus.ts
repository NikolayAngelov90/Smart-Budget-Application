/**
 * Story 8.4: Data Sync Status and Multi-Device Information
 * Story 8.5: Offline Data Caching for Viewing (Phase 1)
 * Custom Hook: useOnlineStatus
 *
 * Tracks online/offline status and last sync timestamp
 * Story 8.4 ACs:
 * AC-8.4.1: Sync Status Indicator
 * AC-8.4.2: Last Sync Timestamp
 * AC-8.4.3: Real-Time Sync Indicator
 * AC-8.4.4: Automatic Sync
 *
 * Story 8.5 Extension:
 * AC-8.5.2: Offline Indicator (cache timestamp)
 * AC-8.5.4: Reconnection Behavior (SWR revalidation)
 */

import { useState, useEffect } from 'react';
import { mutate } from 'swr';
import { createClient } from '@/lib/supabase/client';
import { getCachedDataTimestamp } from '@/lib/services/offlineService';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

export interface OnlineStatusState {
  isOnline: boolean;
  lastSync: Date | null;
  syncStatus: SyncStatus;
  cachedDataTimestamp: Date | null; // Story 8.5 extension
}

const LAST_SYNC_KEY = 'smart-budget-last-sync';

/**
 * Get last sync timestamp from localStorage
 */
function getLastSyncFromStorage(): Date | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    if (stored) {
      return new Date(stored);
    }
  } catch (error) {
    console.error('Failed to read last sync from storage:', error);
  }

  return null;
}

/**
 * Save last sync timestamp to localStorage
 */
function saveLastSyncToStorage(date: Date): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(LAST_SYNC_KEY, date.toISOString());
  } catch (error) {
    console.error('Failed to save last sync to storage:', error);
  }
}

/**
 * Custom hook for tracking online/offline status and sync state
 *
 * Features:
 * - Detects online/offline using Navigator.onLine API
 * - Tracks last sync timestamp in localStorage
 * - Provides sync status (synced, syncing, offline)
 * - Updates automatically on network changes
 *
 * @returns OnlineStatusState with isOnline, lastSync, syncStatus
 */
export function useOnlineStatus(): OnlineStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Default to online for SSR
  });

  const [lastSync, setLastSync] = useState<Date | null>(() => {
    return getLastSyncFromStorage();
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    if (typeof window === 'undefined') {
      return 'synced';
    }
    return navigator.onLine ? 'synced' : 'offline';
  });

  // Story 8.5: Cached data timestamp
  const [cachedDataTimestamp, setCachedDataTimestamp] = useState<Date | null>(
    () => {
      const timestamp = getCachedDataTimestamp();
      return timestamp ? new Date(timestamp) : null;
    }
  );

  // Listen to online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function handleOnline() {
      setIsOnline(true);
      setSyncStatus('syncing');

      // Story 8.5 AC-8.5.4: Trigger SWR revalidation on reconnection
      // Revalidate all SWR caches to fetch latest data
      mutate(() => true);

      // Update sync status to synced after revalidation
      setTimeout(() => {
        setSyncStatus('synced');
      }, 1000);
    }

    function handleOffline() {
      setIsOnline(false);
      setSyncStatus('offline');

      // Update cached data timestamp when going offline
      const timestamp = getCachedDataTimestamp();
      setCachedDataTimestamp(timestamp ? new Date(timestamp) : null);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize last sync on mount
  useEffect(() => {
    const storedLastSync = getLastSyncFromStorage();
    if (storedLastSync) {
      setLastSync(storedLastSync);
    } else {
      // Set initial last sync to now
      const now = new Date();
      setLastSync(now);
      saveLastSyncToStorage(now);
    }
  }, []);

  // Listen for last sync updates from other components
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function handleLastSyncUpdate(event: Event) {
      const customEvent = event as CustomEvent<Date>;
      if (customEvent.detail) {
        setLastSync(customEvent.detail);
      }
    }

    window.addEventListener('lastSyncUpdated', handleLastSyncUpdate);

    return () => {
      window.removeEventListener('lastSyncUpdated', handleLastSyncUpdate);
    };
  }, []);

  // Integrate with Supabase Realtime for real-time sync status
  // AC-8.4.3: Real-Time Sync Indicator
  // AC-8.4.4: Automatic Sync
  useEffect(() => {
    if (typeof window === 'undefined' || !isOnline) {
      return;
    }

    const supabase = createClient();

    // Subscribe to transactions table changes for real-time sync detection
    const channel = supabase
      .channel('sync-status-monitor')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'transactions',
        },
        () => {
          // Data changed - update last sync
          const now = new Date();
          setLastSync(now);
          saveLastSyncToStorage(now);
          setSyncStatus('synced');
        }
      )
      .subscribe((status) => {
        // Monitor Realtime connection status
        if (status === 'SUBSCRIBED') {
          setSyncStatus('synced');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncStatus('offline');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline]);

  return {
    isOnline,
    lastSync,
    syncStatus,
    cachedDataTimestamp,
  };
}

/**
 * Update last sync timestamp
 * Call this function when data is successfully synced
 */
export function updateLastSync(): void {
  const now = new Date();
  saveLastSyncToStorage(now);

  // Dispatch custom event to notify all useOnlineStatus hooks
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lastSyncUpdated', { detail: now }));
  }
}

/**
 * Hook to listen for last sync updates
 * Used internally by useOnlineStatus to stay in sync across components
 */
export function useLastSyncListener(onUpdate: (date: Date) => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function handleLastSyncUpdate(event: Event) {
      const customEvent = event as CustomEvent<Date>;
      if (customEvent.detail) {
        onUpdate(customEvent.detail);
      }
    }

    window.addEventListener('lastSyncUpdated', handleLastSyncUpdate);

    return () => {
      window.removeEventListener('lastSyncUpdated', handleLastSyncUpdate);
    };
  }, [onUpdate]);
}
