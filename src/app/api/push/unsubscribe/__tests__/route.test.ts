/**
 * DELETE /api/push/unsubscribe — Tests (Story 12.3)
 *
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. The 200 test was named
 * "deletes subscription" but asserted only the status; it now asserts the
 * delete and BOTH of its filters. Without the user_id filter one user could
 * delete another's subscription by endpoint, and an arg-blind stub would stay
 * green while that scoping vanished.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { DELETE } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function wire(user: { id: string } | null) {
  const db = createSupabaseMock({
    user,
    tables: { push_subscriptions: { data: null, error: null } },
  });
  mockCreateClient.mockResolvedValue(db.client);
  return db;
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/push/unsubscribe', {
    method: 'DELETE',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('DELETE /api/push/unsubscribe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    wire(null);
    const res = await DELETE(makeRequest({ endpoint: 'https://x.com' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when endpoint is missing', async () => {
    wire({ id: 'u1' });
    const res = await DELETE(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 200 and deletes subscription', async () => {
    const db = wire({ id: 'u1' });
    const res = await DELETE(makeRequest({ endpoint: 'https://push.example.com/1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // What the name claims, scoped: this user's row with this endpoint.
    expect(db.callsTo('push_subscriptions', 'delete')).toHaveLength(1);
    expect(db.callsTo('push_subscriptions', 'eq')).toEqual(
      expect.arrayContaining([
        ['user_id', 'u1'],
        ['endpoint', 'https://push.example.com/1'],
      ])
    );
  });
});
