/**
 * Tests for offlineService
 * Story 8.5: Offline Data Caching for Viewing (Phase 1)
 *
 * Test Coverage:
 * - getOfflineState()
 * - updateOfflineState()
 * - getCachedDataTimestamp()
 * - clearOfflineCache()
 * - getCacheHealth()
 */

import {
  getOfflineState,
  updateOfflineState,
  getCachedDataTimestamp,
  clearOfflineCache,
  getCacheHealth,
} from '@/lib/services/offlineService';
import * as localStorageProvider from '@/lib/swr/localStorageProvider';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock localStorageProvider functions
jest.mock('@/lib/swr/localStorageProvider', () => ({
  getCacheTimestamp: jest.fn(),
  getCacheSizeMB: jest.fn(),
  clearSWRCache: jest.fn(),
  isCacheOverLimit: jest.fn(),
}));

describe('offlineService', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('getOfflineState', () => {
    it('should return default state when no stored state exists', () => {
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(null);

      const state = getOfflineState();

      expect(state).toEqual({
        isOnline: true,
        lastSync: null,
        cachedDataTimestamp: null,
        hasPendingChanges: false,
      });
    });

    it('should return stored state when available', () => {
      const mockState = {
        isOnline: false,
        lastSync: 1609459200000,
        cachedDataTimestamp: 1609459200000,
        hasPendingChanges: false,
      };

      localStorageMock.setItem('smart-budget-offline-state', JSON.stringify(mockState));
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(1609459200000);

      const state = getOfflineState();

      expect(state).toEqual(mockState);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.setItem('smart-budget-offline-state', 'invalid-json');
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(null);

      const state = getOfflineState();

      expect(state.isOnline).toBe(true);
      expect(state.cachedDataTimestamp).toBeNull();
    });
  });

  describe('updateOfflineState', () => {
    it('should update partial state', () => {
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(null);

      updateOfflineState({ isOnline: false });

      const stored = localStorageMock.getItem('smart-budget-offline-state');
      expect(stored).toBeTruthy();

      const state = JSON.parse(stored!);
      expect(state.isOnline).toBe(false);
      expect(state.hasPendingChanges).toBe(false); // Existing fields preserved
    });

    it('should merge with existing state', () => {
      const initialState = {
        isOnline: true,
        lastSync: 1609459200000,
        cachedDataTimestamp: null,
        hasPendingChanges: false,
      };

      localStorageMock.setItem('smart-budget-offline-state', JSON.stringify(initialState));
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(null);

      updateOfflineState({ lastSync: 1609462800000 });

      const stored = localStorageMock.getItem('smart-budget-offline-state');
      const state = JSON.parse(stored!);

      expect(state.isOnline).toBe(true); // Preserved
      expect(state.lastSync).toBe(1609462800000); // Updated
    });
  });

  describe('getCachedDataTimestamp', () => {
    it('should return timestamp from cache provider', () => {
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(1609459200000);

      const timestamp = getCachedDataTimestamp();

      expect(timestamp).toBe(1609459200000);
      expect(localStorageProvider.getCacheTimestamp).toHaveBeenCalled();
    });

    it('should return null when no cache exists', () => {
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(null);

      const timestamp = getCachedDataTimestamp();

      expect(timestamp).toBeNull();
    });
  });

  describe('clearOfflineCache', () => {
    it('should clear SWR cache and offline state', () => {
      localStorageMock.setItem('smart-budget-offline-state', JSON.stringify({ isOnline: true }));

      clearOfflineCache();

      expect(localStorageProvider.clearSWRCache).toHaveBeenCalled();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('smart-budget-offline-state');
    });
  });

  describe('getCacheHealth', () => {
    it('should return cache health metrics', () => {
      jest.spyOn(localStorageProvider, 'getCacheSizeMB').mockReturnValue(25.5);
      jest.spyOn(localStorageProvider, 'isCacheOverLimit').mockReturnValue(false);
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(1609459200000);

      const health = getCacheHealth();

      expect(health).toEqual({
        sizeMB: 25.5,
        isOverLimit: false,
        timestamp: 1609459200000,
        hasData: true,
      });
    });

    it('should indicate when cache is over limit', () => {
      jest.spyOn(localStorageProvider, 'getCacheSizeMB').mockReturnValue(55.0);
      jest.spyOn(localStorageProvider, 'isCacheOverLimit').mockReturnValue(true);
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(1609459200000);

      const health = getCacheHealth();

      expect(health.sizeMB).toBe(55.0);
      expect(health.isOverLimit).toBe(true);
    });

    it('should indicate no data when cache timestamp is null', () => {
      jest.spyOn(localStorageProvider, 'getCacheSizeMB').mockReturnValue(0);
      jest.spyOn(localStorageProvider, 'isCacheOverLimit').mockReturnValue(false);
      jest.spyOn(localStorageProvider, 'getCacheTimestamp').mockReturnValue(null);

      const health = getCacheHealth();

      expect(health.hasData).toBe(false);
      expect(health.timestamp).toBeNull();
    });
  });
});
