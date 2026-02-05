/**
 * User Sessions API Unit Tests
 * Story 9-6: Complete Device Session Management (AC-9.6.9)
 */

import { GET } from '../route';

// Mock Supabase client
const mockGetUser = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => mockFrom(),
  }),
}));

// Set up mock chain
mockFrom.mockReturnValue({
  select: mockSelect,
});
mockSelect.mockReturnValue({
  eq: mockEq,
});
mockEq.mockReturnValue({
  order: mockOrder,
});

describe('GET /api/user/sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
