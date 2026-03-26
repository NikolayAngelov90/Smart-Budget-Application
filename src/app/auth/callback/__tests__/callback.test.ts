/**
 * OAuth Callback Route Tests
 * Story 11.1: Streamlined Onboarding Flow
 *
 * Test Coverage:
 * AC-1: OAuth display name pre-fill
 * Task 4: Auth callback updates for streamlined flow
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    redirect: jest.fn((url: string | URL) => ({
      status: 307,
      headers: new Headers({ Location: url.toString() }),
    })),
  },
}));

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('GET /auth/callback', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        exchangeCodeForSession: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
    };

    // Track chained calls for assertions
    const mockUpdateEq = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

    // Chain builder for .from().select().eq().limit()
    mockSupabase.from = jest.fn((table: string) => {
      if (table === 'categories') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'user_profiles') {
        return { update: mockUpdate };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        update: jest.fn().mockReturnThis(),
      };
    });

    // Expose for assertions
    mockSupabase._mockUpdate = mockUpdate;
    mockSupabase._mockUpdateEq = mockUpdateEq;

    mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it('pre-fills display_name from OAuth full_name metadata', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
          user_metadata: { full_name: 'John Doe' },
        },
      },
      error: null,
    });

    const { GET } = await import('@/app/auth/callback/route');

    const request = new Request('http://localhost:3000/auth/callback?code=test-code');
    await GET(request as never);

    // Verify display name was pre-filled with correct value and user ID
    expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ display_name: 'John Doe' });
    expect(mockSupabase._mockUpdateEq).toHaveBeenCalledWith('id', mockUserId);
  });

  it('pre-fills display_name from OAuth name metadata when full_name is absent', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
          user_metadata: { name: 'Jane Smith' },
        },
      },
      error: null,
    });

    const { GET } = await import('@/app/auth/callback/route');

    const request = new Request('http://localhost:3000/auth/callback?code=test-code');
    await GET(request as never);

    expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ display_name: 'Jane Smith' });
    expect(mockSupabase._mockUpdateEq).toHaveBeenCalledWith('id', mockUserId);
  });

  it('does not update display_name when no OAuth name metadata is available', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
          user_metadata: {},
        },
      },
      error: null,
    });

    const { GET } = await import('@/app/auth/callback/route');

    const request = new Request('http://localhost:3000/auth/callback?code=test-code');
    await GET(request as never);

    // Should only call from('categories') for seeding check, not from('user_profiles')
    const fromCalls = mockSupabase.from.mock.calls.map((c: string[]) => c[0]);
    expect(fromCalls).toContain('categories');
    expect(fromCalls).not.toContain('user_profiles');
  });

  it('redirects to login when no code is present', async () => {
    const { GET } = await import('@/app/auth/callback/route');

    const request = new Request('http://localhost:3000/auth/callback');
    await GET(request as never);

    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/login?error=missing_code')
    );
  });

  it('redirects to login on auth error', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: 'Invalid code' },
    });

    const { GET } = await import('@/app/auth/callback/route');

    const request = new Request('http://localhost:3000/auth/callback?code=bad-code');
    await GET(request as never);

    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/login?error=auth_failed')
    );
  });

  it('seeds categories for new users', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
          user_metadata: { full_name: 'Test User' },
        },
      },
      error: null,
    });

    const { GET } = await import('@/app/auth/callback/route');

    const request = new Request('http://localhost:3000/auth/callback?code=test-code');
    await GET(request as never);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('seed_user_categories', {
      target_user_id: mockUserId,
    });
  });
});
