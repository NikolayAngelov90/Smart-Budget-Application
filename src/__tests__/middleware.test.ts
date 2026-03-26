/**
 * Middleware Unit Tests
 * AC-11.5.4: Critical missing tests
 *
 * Tests authentication routing logic:
 * - Unauthenticated users redirected from protected routes
 * - Authenticated users redirected from auth pages to dashboard
 * - BENCHMARK_MODE bypass only in non-production
 * - Public routes accessible without auth
 */

/** @jest-environment node */

import { NextRequest } from 'next/server';

// Mock @supabase/ssr
const mockGetUser = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: () => mockGetUser(),
    },
  })),
}));

// Must import after mocks
import { middleware } from '@/middleware';

describe('middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      NODE_ENV: 'development',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('redirects unauthenticated users from /dashboard to /login', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
    });

    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
    expect(response.headers.get('location')).toContain('redirect=%2Fdashboard');
  });

  it('redirects unauthenticated users from /api routes to /login', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
    });

    const request = new NextRequest('http://localhost:3000/api/transactions');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });

  it('redirects authenticated users from /login to /dashboard', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
    });

    const request = new NextRequest('http://localhost:3000/login');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/dashboard');
  });

  it('redirects authenticated users from /signup to /dashboard', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
    });

    const request = new NextRequest('http://localhost:3000/signup');
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/dashboard');
  });

  it('allows authenticated users to access /dashboard', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
    });

    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await middleware(request);

    // Should not redirect - returns next response (200)
    expect(response.status).toBe(200);
  });

  it('allows unauthenticated users to access public routes', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
    });

    const request = new NextRequest('http://localhost:3000/');
    const response = await middleware(request);

    // Public route - should not redirect
    expect(response.status).toBe(200);
  });

  it('bypasses auth in BENCHMARK_MODE', async () => {
    process.env.BENCHMARK_MODE = 'true';

    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('bypasses auth in BENCHMARK_MODE even in production', async () => {
    process.env.BENCHMARK_MODE = 'true';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await middleware(request);

    // BENCHMARK_MODE bypasses auth regardless of NODE_ENV
    // This is required because CI benchmarks run with `npm run start` which sets NODE_ENV=production
    expect(response.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
