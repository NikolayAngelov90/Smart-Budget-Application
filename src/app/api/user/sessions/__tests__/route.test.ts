/**
 * User Sessions API Unit Tests
 * Story 9-6: Complete Device Session Management (AC-9.6.9)
 */

import { GET } from '@/app/api/user/sessions/route';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: (name: string) => {
      if (name === 'user-agent') return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
      if (name === 'x-forwarded-for') return '127.0.0.1';
      return null;
    },
  }),
}));

// Mock Supabase client
const mockGetUser = jest.fn();
const mockGetSession = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockMaybeSingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
      getSession: () => mockGetSession(),
    },
    from: (table: string) => mockFrom(table),
  }),
}));

describe('GET /api/user/sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: no auth session (skips upsert)
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    // Set up mock chain for fetching sessions
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_sessions') {
        return { select: mockSelect, insert: mockInsert, update: mockUpdate };
      }
      return { select: mockSelect };
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder, maybeSingle: mockMaybeSingle });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it('returns 401 if user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns sessions for authenticated user', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        user_id: 'user-123',
        device_name: 'Chrome on Windows',
        device_type: 'desktop',
        browser: 'Chrome',
        last_active: '2026-02-04T12:00:00Z',
        created_at: '2026-02-01T10:00:00Z',
      },
      {
        id: 'session-2',
        user_id: 'user-123',
        device_name: 'Safari on iPhone',
        device_type: 'mobile',
        browser: 'Safari',
        last_active: '2026-02-04T11:00:00Z',
        created_at: '2026-02-02T09:00:00Z',
      },
    ];

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockOrder.mockResolvedValueOnce({
      data: mockSessions,
      error: null,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockSessions);
    expect(data.data).toHaveLength(2);
  });

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch sessions');
  });

  it('auto-registers current session when auth session exists', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: 'token-abc' } },
    });
    // No existing session found
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    // Fetch returns the newly inserted session
    mockOrder.mockResolvedValueOnce({
      data: [{ id: 'new-session', user_id: 'user-123', device_name: 'Chrome on Windows', session_token: 'token-abc' }],
      error: null,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.current_session_token).toBe('token-abc');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        session_token: 'token-abc',
        device_type: 'desktop',
        browser: 'Chrome',
      })
    );
  });
});
