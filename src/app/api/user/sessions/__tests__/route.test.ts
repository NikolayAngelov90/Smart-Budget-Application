/**
 * User Sessions API Unit Tests
 * Story 9-6: Complete Device Session Management (AC-9.6.9)
 *
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. Nine module-level
 * jest.fns (from/select/eq/order/maybeSingle/insert/update/...) wired into a
 * hand-rolled client, configured per test with `...mockResolvedValueOnce`,
 * become one factory client per test. user_sessions is a QUEUE in the route's
 * call order: with an auth session, [token lookup, fingerprint lookup, insert,
 * the list fetch]; without one, [the list fetch].
 */

import { createHash } from 'crypto';
import { GET } from '@/app/api/user/sessions/route';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock, type QueryResult } from '@/test-utils/supabaseChain';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: (name: string) => {
      if (name === 'user-agent')
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
      if (name === 'x-forwarded-for') return '127.0.0.1';
      return null;
    },
  }),
}));

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));

function wire({
  user = { id: 'user-123' },
  session = null,
  sessions,
}: {
  user?: { id: string } | null;
  session?: object | null;
  sessions: QueryResult[];
}) {
  const db = createSupabaseMock({ user, tables: { user_sessions: sessions } });
  (db.client.auth.getSession as jest.Mock).mockResolvedValue({ data: { session } });
  (createClient as jest.Mock).mockResolvedValue(db.client);
  return db;
}

describe('GET /api/user/sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if user is not authenticated', async () => {
    wire({ user: null, sessions: [] });

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
    // No auth session, so no registration: the list fetch is the only query.
    wire({ sessions: [{ data: mockSessions, error: null }] });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockSessions);
    expect(data.data).toHaveLength(2);
  });

  it('returns 500 on database error', async () => {
    wire({ sessions: [{ data: null, error: { message: 'Database error' } }] });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch sessions');
  });

  it('auto-registers current session when auth session exists', async () => {
    const db = wire({
      session: { access_token: 'token-abc' },
      sessions: [
        { data: null, error: null }, // exact token lookup: not found
        { data: null, error: null }, // device fingerprint lookup: not found (new device)
        { data: null, error: null }, // the insert
        {
          data: [
            {
              id: 'new-session',
              user_id: 'user-123',
              device_name: 'Chrome on Windows',
              session_token: 'token-abc',
            },
          ],
          error: null,
        }, // the list fetch returns the newly inserted session
      ],
    });

    const response = await GET();
    const data = await response.json();

    const hashedToken = createHash('sha256').update('token-abc').digest('hex');
    expect(response.status).toBe(200);
    expect(data.current_session_token).toBe(hashedToken);
    expect(db.allCallsTo('user_sessions', 'insert')).toContainEqual([
      expect.objectContaining({
        user_id: 'user-123',
        session_token: hashedToken,
        device_type: 'desktop',
        browser: 'Chrome',
      }),
    ]);
  });
});
