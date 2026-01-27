/**
 * Supabase Mock Utilities
 * Provides pre-configured mocks for Supabase client and auth
 */

import { Session, User } from '@supabase/supabase-js';
import { MockSupabaseClient, MockSupabaseAuth } from './types';

/**
 * Creates a mock Supabase client with chainable query builder methods
 */
export function createMockSupabaseClient(
  overrides?: Partial<MockSupabaseClient>
): MockSupabaseClient {
  const mockClient: MockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };

  return mockClient;
}

/**
 * Creates a mock Supabase Auth with common auth methods
 */
export function createMockSupabaseAuth(
  user?: User | null,
  session?: Session | null,
  overrides?: Partial<MockSupabaseAuth>
): MockSupabaseAuth {
  const mockAuth: MockSupabaseAuth = {
    getSession: jest.fn().mockResolvedValue({
      data: { session: session || null },
      error: null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: user || null },
      error: null,
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };

  return mockAuth;
}

/**
 * Default mock user for testing
 */
export const mockUser: User = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {
    full_name: 'Test User',
  },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

/**
 * Default mock session for testing
 */
export const mockSession: Session = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: mockUser,
};

/**
 * Mock Supabase client factory function
 * This is what gets mocked in jest.mock('@supabase/ssr')
 */
export function mockCreateBrowserClient() {
  const client = createMockSupabaseClient();
  const auth = createMockSupabaseAuth(mockUser, mockSession);

  return {
    ...client,
    auth,
  };
}

/**
 * Helper to setup Supabase mocks in tests
 *
 * @example
 * ```typescript
 * import { setupSupabaseMocks } from '@/lib/test-utils/mockSupabase';
 *
 * beforeEach(() => {
 *   const { mockClient, mockAuth } = setupSupabaseMocks();
 *
 *   // Customize mocks
 *   mockClient.select.mockResolvedValue({
 *     data: [{ id: 1, name: 'Test' }],
 *     error: null
 *   });
 * });
 * ```
 */
export function setupSupabaseMocks(
  user?: User | null,
  session?: Session | null
) {
  const mockClient = createMockSupabaseClient();
  const mockAuth = createMockSupabaseAuth(user, session);

  // Mock the createBrowserClient function
  jest.mock('@supabase/ssr', () => ({
    createBrowserClient: jest.fn(() => ({
      ...mockClient,
      auth: mockAuth,
    })),
  }));

  return { mockClient, mockAuth };
}
