/**
 * SWR Mock Utilities
 * Provides pre-configured mocks for SWR data fetching
 */

import { SWRConfiguration } from 'swr';
import { MockSWRReturn } from './types';

/**
 * Creates a mock SWR configuration for testing
 * Disables automatic revalidation and caching for predictable tests
 */
export function createMockSWRConfig(): SWRConfiguration {
  return {
    dedupingInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    provider: () => new Map(),
  };
}

/**
 * Creates a mock useSWR return value
 *
 * @example
 * ```typescript
 * const mockUseSWR = createMockUseSWR({
 *   data: [{ id: 1, name: 'Test' }],
 *   isLoading: false
 * });
 * ```
 */
export function createMockUseSWR<T = unknown>(
  returnValue: MockSWRReturn<T> = {}
): MockSWRReturn<T> {
  return {
    data: returnValue.data,
    error: returnValue.error,
    isLoading: returnValue.isLoading ?? false,
    isValidating: returnValue.isValidating ?? false,
    mutate: returnValue.mutate ?? jest.fn(),
  };
}

/**
 * Mock SWR data storage for test scenarios
 * Maps SWR keys to mock return values
 */
export class MockSWRData {
  private data: Map<string, MockSWRReturn>;

  constructor(initialData: Record<string, MockSWRReturn> = {}) {
    this.data = new Map(Object.entries(initialData));
  }

  /**
   * Set mock data for a specific SWR key
   */
  set(key: string, value: MockSWRReturn): void {
    this.data.set(key, value);
  }

  /**
   * Get mock data for a specific SWR key
   */
  get(key: string): MockSWRReturn | undefined {
    return this.data.get(key);
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Convert to plain object for renderWithProviders options
   */
  toObject(): Record<string, MockSWRReturn> {
    return Object.fromEntries(this.data.entries());
  }
}

/**
 * Helper to setup SWR mocks in tests
 *
 * @example
 * ```typescript
 * import { setupSWRMocks } from '@/lib/test-utils/mockSWR';
 *
 * const swrData = setupSWRMocks({
 *   '/api/transactions': { data: [], isLoading: false },
 *   '/api/categories': { data: [], isLoading: false }
 * });
 *
 * // In your test
 * render(<Component />, { mockSWRData: swrData });
 * ```
 */
export function setupSWRMocks(
  initialData: Record<string, MockSWRReturn> = {}
): Record<string, MockSWRReturn> {
  return initialData;
}
