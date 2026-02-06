/**
 * User Session [id] API Unit Tests
 * Story 9-6: Complete Device Session Management (AC-9.6.9)
 */

import { NextRequest } from 'next/server';
import { PUT, DELETE } from '@/app/api/user/sessions/[id]/route';

// Mock Supabase client
const mockGetUser = jest.fn();
const mockGetSession = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockSingle = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
      getSession: () => mockGetSession(),
    },
    from: () => mockFrom(),
  }),
}));

describe('PUT /api/user/sessions/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock chain for PUT
    mockFrom.mockReturnValue({
      update: mockUpdate,
      select: mockSelect,
      delete: mockDelete,
    });
    mockUpdate.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      }),
    });
  });

  it('returns 401 if user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new NextRequest('http://localhost/api/user/sessions/session-1', {
      method: 'PUT',
      body: JSON.stringify({ device_name: 'New Name' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 if device_name is missing', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/user/sessions/session-1', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('device_name is required');
  });

  it('returns 400 if device_name is empty', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/user/sessions/session-1', {
      method: 'PUT',
      body: JSON.stringify({ device_name: '   ' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('1 and 100 characters');
  });

  it('successfully updates device name', async () => {
    const updatedSession = {
      id: 'session-1',
      user_id: 'user-123',
      device_name: 'My Work Laptop',
      device_type: 'desktop',
    };

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: updatedSession,
      error: null,
    });

    const request = new NextRequest('http://localhost/api/user/sessions/session-1', {
      method: 'PUT',
      body: JSON.stringify({ device_name: 'My Work Laptop' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.device_name).toBe('My Work Laptop');
  });
});

describe('DELETE /api/user/sessions/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock chain for DELETE
    const mockSelectEq = jest.fn().mockReturnValue({
      single: mockSingle,
    });
    const mockDeleteEq = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: mockSelectEq,
        }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: mockDeleteEq,
      }),
    });
  });

  it('returns 401 if user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new NextRequest('http://localhost/api/user/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 if session not found', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: 'current-token' } },
    });
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new NextRequest('http://localhost/api/user/sessions/non-existent', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('returns 400 when trying to revoke current session (AC-9.6.7)', async () => {
    const currentSession = {
      id: 'session-1',
      user_id: 'user-123',
      session_token: 'current-access-token',
    };

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: 'current-access-token' } },
    });
    mockSingle.mockResolvedValueOnce({
      data: currentSession,
      error: null,
    });

    const request = new NextRequest('http://localhost/api/user/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Cannot revoke your current session');
  });

  it('successfully revokes a different session', async () => {
    const otherSession = {
      id: 'session-2',
      user_id: 'user-123',
      session_token: 'other-token',
    };

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: 'current-token' } },
    });
    mockSingle.mockResolvedValueOnce({
      data: otherSession,
      error: null,
    });

    const request = new NextRequest('http://localhost/api/user/sessions/session-2', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'session-2' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
