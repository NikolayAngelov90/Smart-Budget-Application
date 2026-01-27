/**
 * Test Utilities - TypeScript Type Definitions
 * Provides type safety for all test utility mocks and helpers
 */

import { RenderOptions } from '@testing-library/react';
import { Session, User } from '@supabase/supabase-js';

/**
 * Mock Supabase Client interface
 * Provides type-safe mocks for Supabase query builder methods
 */
export interface MockSupabaseClient {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
}

/**
 * Mock Supabase Auth interface
 * Provides type-safe mocks for Supabase Auth methods
 */
export interface MockSupabaseAuth {
  getSession: jest.Mock<Promise<{ data: { session: Session | null }; error: null }>>;
  getUser: jest.Mock<Promise<{ data: { user: User | null }; error: null }>>;
  signOut: jest.Mock<Promise<{ error: null }>>;
}

/**
 * Mock Router interface
 * Provides type-safe mocks for Next.js router methods
 */
export interface MockRouter {
  push: jest.Mock;
  replace: jest.Mock;
  back: jest.Mock;
  forward: jest.Mock;
  refresh: jest.Mock;
  prefetch: jest.Mock;
}

/**
 * Mock Toast interface
 * Provides type-safe mocks for react-hot-toast methods
 */
export interface MockToast {
  success: jest.Mock;
  error: jest.Mock;
  loading: jest.Mock;
  dismiss: jest.Mock;
  promise: jest.Mock;
}

/**
 * Mock SWR Hook Return Type
 * Mimics useSWR hook return values
 */
export interface MockSWRReturn<T = unknown> {
  data?: T;
  error?: Error;
  isLoading?: boolean;
  isValidating?: boolean;
  mutate?: jest.Mock;
}

/**
 * Custom Render Options
 * Extends Testing Library RenderOptions with mock customization options
 */
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Custom Supabase client mock overrides
   */
  mockSupabase?: Partial<MockSupabaseClient>;

  /**
   * Custom Supabase Auth mock overrides
   */
  mockAuth?: Partial<MockSupabaseAuth>;

  /**
   * Custom Router mock overrides
   */
  mockRouter?: Partial<MockRouter>;

  /**
   * Custom Toast mock overrides
   */
  mockToast?: Partial<MockToast>;

  /**
   * Custom SWR data to be returned by useSWR
   */
  mockSWRData?: Record<string, MockSWRReturn>;

  /**
   * Custom user session for auth mocking
   */
  mockUser?: User | null;

  /**
   * Custom session for auth mocking
   */
  mockSession?: Session | null;
}

/**
 * Extended Render Result
 * Includes attached mock utilities for easy access in tests
 */
export interface RenderResult extends ReturnType<typeof import('@testing-library/react').render> {
  mockSupabase: MockSupabaseClient;
  mockAuth: MockSupabaseAuth;
  mockRouter: MockRouter;
  mockToast: MockToast;
}
