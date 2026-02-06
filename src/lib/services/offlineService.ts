/**
 * Offline state and cache management service
 * Provides utilities for managing offline mode state and cached data
 */

import {
  getCacheTimestamp,
  getCacheSizeMB,
  clearSWRCache,
  isCacheOverLimit,
} from '@/lib/swr/localStorageProvider';

export interface OfflineState {
  isOnline: boolean;
  lastSync: number | null;
  cachedDataTimestamp: number | null;
  hasPendingChanges: boolean; // Phase 2: for offline write queue
}

const OFFLINE_STATE_KEY = 'smart-budget-offline-state';

/**
 * Get current offline state from localStorage
 */
export function getOfflineState(): OfflineState {
  try {
    const state = localStorage.getItem(OFFLINE_STATE_KEY);
    if (state) {
      return JSON.parse(state);
    }
  } catch (error) {
    console.warn('Failed to parse offline state:', error);
  }

  // Default state
  return {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSync: null,
    cachedDataTimestamp: getCacheTimestamp(),
    hasPendingChanges: false,
  };
}

/**
 * Update offline state in localStorage
 */
export function updateOfflineState(
  partialState: Partial<OfflineState>
): void {
  try {
    const currentState = getOfflineState();
    const newState = { ...currentState, ...partialState };
    localStorage.setItem(OFFLINE_STATE_KEY, JSON.stringify(newState));
  } catch (error) {
    console.error('Failed to update offline state:', error);
  }
}

/**
 * Get cached data timestamp
 * Returns null if no cache exists
 */
export function getCachedDataTimestamp(): number | null {
  return getCacheTimestamp();
}

/**
 * Clear offline cache
 * Called on logout to prevent data leakage on shared devices
 */
export function clearOfflineCache(): void {
  try {
    // Clear SWR cache from localStorage
    clearSWRCache();

    // Clear offline state
    localStorage.removeItem(OFFLINE_STATE_KEY);

    console.log('Offline cache cleared successfully');
  } catch (error) {
    console.error('Failed to clear offline cache:', error);
  }
}

/**
 * Get cache size in megabytes
 */
export function getCacheSize(): number {
  return getCacheSizeMB();
}

/**
 * Check if cache size exceeds 50MB limit
 */
export function isCacheFull(): boolean {
  return isCacheOverLimit();
}

/**
 * Get cache health status
 */
export interface CacheHealth {
  sizeMB: number;
  isOverLimit: boolean;
  timestamp: number | null;
  hasData: boolean;
}

export function getCacheHealth(): CacheHealth {
  const sizeMB = getCacheSizeMB();
  const timestamp = getCacheTimestamp();

  return {
    sizeMB,
    isOverLimit: isCacheOverLimit(),
    timestamp,
    hasData: timestamp !== null,
  };
}
