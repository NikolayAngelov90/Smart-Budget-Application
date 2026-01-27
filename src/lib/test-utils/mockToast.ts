/**
 * Toast Mock Utilities
 * Provides pre-configured mocks for Chakra UI's useToast hook
 * Note: This app uses Chakra UI's toast system, not react-hot-toast
 */

import { MockToast } from './types';

/**
 * Creates a mock toast object with spy functions
 * All toast methods are jest mocks that can be inspected in tests
 */
export function createMockToast(overrides?: Partial<MockToast>): MockToast {
  const mockToast: MockToast = {
    success: jest.fn((message) => {
      console.log('[Mock Toast Success]:', message);
      return 'toast-success-id';
    }),
    error: jest.fn((message) => {
      console.log('[Mock Toast Error]:', message);
      return 'toast-error-id';
    }),
    loading: jest.fn((message) => {
      console.log('[Mock Toast Loading]:', message);
      return 'toast-loading-id';
    }),
    dismiss: jest.fn((toastId) => {
      console.log('[Mock Toast Dismiss]:', toastId);
    }),
    promise: jest.fn((promise, messages) => {
      console.log('[Mock Toast Promise]:', messages);
      return promise;
    }),
    ...overrides,
  };

  return mockToast;
}

/**
 * Helper to setup toast mocks in tests
 * Mocks Chakra UI's useToast hook globally
 *
 * @example
 * ```typescript
 * import { setupToastMocks } from '@/lib/test-utils/mockToast';
 *
 * beforeEach(() => {
 *   const { mockToast } = setupToastMocks();
 *
 *   // Customize mocks
 *   mockToast.mockImplementation((options) => {
 *     console.log('Toast:', options);
 *   });
 * });
 *
 * // In your test
 * const toast = useToast();
 * toast({ title: 'Success!', status: 'success' });
 * expect(mockToast).toHaveBeenCalled();
 * ```
 */
export function setupToastMocks() {
  const mockToast = jest.fn();

  // Mock Chakra UI's useToast hook
  jest.mock('@chakra-ui/react', () => ({
    ...jest.requireActual('@chakra-ui/react'),
    useToast: () => mockToast,
  }));

  return { mockToast };
}

/**
 * Default mock toast for testing
 * Use this in renderWithProviders when no custom toast is needed
 */
export const defaultMockToast = createMockToast();
