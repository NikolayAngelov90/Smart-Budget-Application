/**
 * User Session [id] API Unit Tests
 * Story 9-6: Complete Device Session Management (AC-9.6.9)
 */

import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { PUT, DELETE } from '@/app/api/user/sessions/[id]/route';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock, type QueryResult } from '@/test-utils/supabaseChain';

/*
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. Seven module-level
 * jest.fns behind a hand-rolled client, configured per test with stacked
 * `...mockResolvedValueOnce`, become one factory client BUILT WHEN THE ROUTE
 * ASKS FOR IT, from this test's `setup`. user_sessions is a queue: the row the
 * handler reads or updates, then (DELETE) the delete itself.
 */
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));

let setup: { user: { id: string } | null; session: object | null; rows: QueryResult[] };
beforeEach(() => {
  setup = { user: { id: 'user-123' }, session: null, rows: [] };
  (createClient as jest.Mock).mockImplementation(async () => {
    const db = createSupabaseMock({
      user: setup.user,
      tables: { user_sessions: [...setup.rows, { data: null, error: null }] },
    });
    (db.client.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: setup.session },
    });
    return db.client;
  });
});

describe('PUT /api/user/sessions/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if user is not authenticated', async () => {
    setup.user = null;

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

    setup.rows = [
      {
        data: updatedSession,
        error: null,
      },
    ];

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
  });

  it('returns 401 if user is not authenticated', async () => {
    setup.user = null;

    const request = new NextRequest('http://localhost/api/user/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 if session not found', async () => {
    setup.session = { access_token: 'current-token' };
    setup.rows = [
      {
        data: null,
        error: { message: 'Not found' },
      },
    ];

    const request = new NextRequest('http://localhost/api/user/sessions/non-existent', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('returns 400 when trying to revoke current session (AC-9.6.7)', async () => {
    const hashedToken = createHash('sha256').update('current-access-token').digest('hex');
    const currentSession = {
      id: 'session-1',
      user_id: 'user-123',
      session_token: hashedToken,
    };

    setup.session = { access_token: 'current-access-token' };
    setup.rows = [
      {
        data: currentSession,
        error: null,
      },
    ];

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

    setup.session = { access_token: 'current-token' };
    setup.rows = [
      {
        data: otherSession,
        error: null,
      },
    ];

    const request = new NextRequest('http://localhost/api/user/sessions/session-2', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'session-2' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
