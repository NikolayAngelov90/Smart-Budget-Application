/**
 * SWR localStorage provider for offline cache persistence
 * Stores SWR cache in browser localStorage to persist data across page refreshes
 * Implements cache size monitoring (max 50MB) and expiration
 */

const CACHE_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB in bytes
const CACHE_KEY_PREFIX = 'smart-budget-swr-cache';
const CACHE_METADATA_KEY = 'smart-budget-cache-metadata';

interface CacheMetadata {
  cacheTimestamp: number;
  totalSize: number;
  keys: string[];
}

/**
 * Calculate approximate size of a value in bytes
 */
function getItemSize(value: string): number {
  // Approximate size: 2 bytes per character (UTF-16)
  return value.length * 2;
}

/**
 * Get current cache metadata from localStorage
 */
function getCacheMetadata(): CacheMetadata {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return {
      cacheTimestamp: Date.now(),
      totalSize: 0,
      keys: [],
    };
  }

  try {
    const metadata = localStorage.getItem(CACHE_METADATA_KEY);
    if (metadata) {
      return JSON.parse(metadata);
    }
  } catch (error) {
    console.warn('Failed to parse cache metadata:', error);
  }

  return {
    cacheTimestamp: Date.now(),
    totalSize: 0,
    keys: [],
  };
}

/**
 * Update cache metadata in localStorage
 */
function updateCacheMetadata(metadata: CacheMetadata): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Failed to update cache metadata:', error);
  }
}

/**
 * Check if cache size exceeds limit
 */
export function isCacheOverLimit(): boolean {
  const metadata = getCacheMetadata();
  return metadata.totalSize > CACHE_SIZE_LIMIT;
}

/**
 * Get current cache size in MB
 */
export function getCacheSizeMB(): number {
  const metadata = getCacheMetadata();
  return metadata.totalSize / (1024 * 1024);
}

/**
 * Clear all SWR cache from localStorage
 * Called on logout to prevent data leakage
 */
export function clearSWRCache(): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const metadata = getCacheMetadata();

    // Remove all cached items
    metadata.keys.forEach((key) => {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}-${key}`);
    });

    // Remove metadata
    localStorage.removeItem(CACHE_METADATA_KEY);

    console.log('SWR cache cleared successfully');
  } catch (error) {
    console.error('Failed to clear SWR cache:', error);
  }
}

/**
 * SWR localStorage provider
 * Returns a Map-like object that persists data in localStorage
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function localStorageProvider(): Map<string, any> {
  // Initialize cache map from localStorage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<string, any>();

  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return map;
  }

  try {
    const metadata = getCacheMetadata();

    // Load cached items from localStorage
    metadata.keys.forEach((key) => {
      try {
        const item = localStorage.getItem(`${CACHE_KEY_PREFIX}-${key}`);
        if (item) {
          map.set(key, JSON.parse(item));
        }
      } catch (error) {
        console.warn(`Failed to load cached item ${key}:`, error);
      }
    });

    // Update cache timestamp
    metadata.cacheTimestamp = Date.now();
    updateCacheMetadata(metadata);
  } catch (error) {
    console.error('Failed to initialize SWR cache from localStorage:', error);
  }

  // Override Map.set to persist to localStorage
  const originalSet = map.set.bind(map);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map.set = (key: string, value: any) => {
    // If not in browser environment, just use in-memory map
    if (typeof window === 'undefined') {
      return originalSet(key, value);
    }

    try {
      const serialized = JSON.stringify(value);
      const itemSize = getItemSize(serialized);

      // Get current metadata
      const metadata = getCacheMetadata();

      // Check if adding this item would exceed cache size limit
      const existingItem = localStorage.getItem(`${CACHE_KEY_PREFIX}-${key}`);
      const existingSize = existingItem ? getItemSize(existingItem) : 0;
      const newTotalSize = metadata.totalSize - existingSize + itemSize;

      if (newTotalSize > CACHE_SIZE_LIMIT) {
        console.warn(
          `Cache size limit exceeded: ${(newTotalSize / (1024 * 1024)).toFixed(2)}MB > ${(CACHE_SIZE_LIMIT / (1024 * 1024)).toFixed(2)}MB`
        );

        // Optionally, implement LRU eviction here
        // For now, just warn and don't cache this item
        return originalSet(key, value);
      }

      // Save to localStorage
      localStorage.setItem(`${CACHE_KEY_PREFIX}-${key}`, serialized);

      // Update metadata
      if (!metadata.keys.includes(key)) {
        metadata.keys.push(key);
      }
      metadata.totalSize = newTotalSize;
      metadata.cacheTimestamp = Date.now();
      updateCacheMetadata(metadata);
    } catch (error) {
      console.error(`Failed to cache item ${key}:`, error);
      // If localStorage is full or unavailable, still update in-memory cache
    }

    return originalSet(key, value);
  };

  // Override Map.delete to remove from localStorage
  const originalDelete = map.delete.bind(map);
  map.delete = (key: string) => {
    // If not in browser environment, just use in-memory map
    if (typeof window === 'undefined') {
      return originalDelete(key);
    }

    try {
      const item = localStorage.getItem(`${CACHE_KEY_PREFIX}-${key}`);
      if (item) {
        const itemSize = getItemSize(item);
        localStorage.removeItem(`${CACHE_KEY_PREFIX}-${key}`);

        // Update metadata
        const metadata = getCacheMetadata();
        metadata.keys = metadata.keys.filter((k) => k !== key);
        metadata.totalSize -= itemSize;
        updateCacheMetadata(metadata);
      }
    } catch (error) {
      console.error(`Failed to delete cached item ${key}:`, error);
    }

    return originalDelete(key);
  };

  // Override Map.clear to clear localStorage
  const originalClear = map.clear.bind(map);
  map.clear = () => {
    clearSWRCache();
    return originalClear();
  };

  return map;
}

/**
 * Get cache timestamp from metadata
 * Returns null if no cache exists
 */
export function getCacheTimestamp(): number | null {
  const metadata = getCacheMetadata();
  return metadata.keys.length > 0 ? metadata.cacheTimestamp : null;
}
