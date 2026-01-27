/**
 * Next.js Router Mock Utilities
 * Provides pre-configured mocks for Next.js navigation
 */

import { MockRouter } from './types';

/**
 * Creates a mock Next.js router with common navigation methods
 */
export function createMockRouter(overrides?: Partial<MockRouter>): MockRouter {
  const mockRouter: MockRouter = {
    push: jest.fn().mockResolvedValue(true),
    replace: jest.fn().mockResolvedValue(true),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return mockRouter;
}

/**
 * Mock pathname for usePathname hook
 */
export const mockPathname = '/';

/**
 * Mock search params for useSearchParams hook
 */
export function createMockSearchParams(
  params: Record<string, string> = {}
): URLSearchParams {
  return new URLSearchParams(params);
}

/**
 * Helper to setup router mocks in tests
 * Mocks next/navigation hooks globally
 *
 * @example
 * ```typescript
 * import { setupRouterMocks } from '@/lib/test-utils/mockRouter';
 *
 * beforeEach(() => {
 *   const { mockRouter, mockPush } = setupRouterMocks();
 *
 *   // Customize mocks
 *   mockPush.mockImplementation((path) => {
 *     console.log('Navigating to:', path);
 *     return Promise.resolve(true);
 *   });
 * });
 * ```
 */
export function setupRouterMocks(
  pathname: string = '/',
  searchParams: Record<string, string> = {}
) {
  const mockRouter = createMockRouter();
  const mockSearchParamsObj = createMockSearchParams(searchParams);

  // Mock next/navigation hooks
  jest.mock('next/navigation', () => ({
    useRouter: jest.fn(() => mockRouter),
    usePathname: jest.fn(() => pathname),
    useSearchParams: jest.fn(() => mockSearchParamsObj),
    useParams: jest.fn(() => ({})),
  }));

  return {
    mockRouter,
    mockPush: mockRouter.push,
    mockReplace: mockRouter.replace,
    mockBack: mockRouter.back,
    mockForward: mockRouter.forward,
    mockRefresh: mockRouter.refresh,
    mockPrefetch: mockRouter.prefetch,
    mockPathname: pathname,
    mockSearchParams: mockSearchParamsObj,
  };
}

/**
 * Default mock router for testing
 * Use this in renderWithProviders when no custom router is needed
 */
export const defaultMockRouter = createMockRouter();
