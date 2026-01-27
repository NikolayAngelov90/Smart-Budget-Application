/**
 * Test Utilities - Public API
 * Single import point for all test utilities and Testing Library functions
 *
 * @example
 * ```typescript
 * // Before (manual setup - multiple imports, 50+ lines)
 * import { render } from '@testing-library/react';
 * import { ChakraProvider } from '@chakra-ui/react';
 * import { SWRConfig } from 'swr';
 * // ... more imports and manual wrapping ...
 *
 * // After (test utilities - single import)
 * import { render, screen, mockSupabase } from '@/lib/test-utils';
 * ```
 */

// Re-export Testing Library functions
export {
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
  fireEvent,
  act,
  cleanup,
  renderHook,
  // User event (recommended over fireEvent)
  // Note: userEvent must be imported separately as it's async
} from '@testing-library/react';

export { default as userEvent } from '@testing-library/user-event';

// Export main render function
export { renderWithProviders, render } from './testUtils';

// Export TypeScript types
export type {
  CustomRenderOptions,
  RenderResult,
  MockSupabaseClient,
  MockSupabaseAuth,
  MockRouter,
  MockToast,
  MockSWRReturn,
} from './types';

// Export mock creation functions
export {
  createMockSupabaseClient,
  createMockSupabaseAuth,
  mockUser,
  mockSession,
  mockCreateBrowserClient,
  setupSupabaseMocks,
} from './mockSupabase';

export {
  createMockSWRConfig,
  createMockUseSWR,
  MockSWRData,
  setupSWRMocks,
} from './mockSWR';

export {
  createMockRouter,
  mockPathname,
  createMockSearchParams,
  setupRouterMocks,
  defaultMockRouter,
} from './mockRouter';

export {
  ChakraTestProvider,
  createMockToast as createMockChakraToast,
  createMockDisclosure,
  createMockColorMode,
} from './mockChakra';

export {
  createMockToast,
  setupToastMocks,
  defaultMockToast,
} from './mockToast';
