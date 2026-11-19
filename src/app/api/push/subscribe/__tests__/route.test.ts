/**
 * POST /api/push/subscribe — Tests (Story 12.3)
 *
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. The 200 test was named
 * "upserts subscription" but asserted only the status; it now asserts the
 * upsert, its user scoping, and its conflict target.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { POST } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function wire(user: { id: string } | null, upsertError: object | null = null) {
  const db = createSupabaseMock({
    user,
    tables: { push_subscriptions: { data: null, error: upsertError } },
  });
  mockCreateClient.mockResolvedValue(db.client);
  return db;
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/push/subscribe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    wire(null);
    const res = await POST(
      makeRequest({ endpoint: 'https://x.com', keys: { p256dh: 'pk', auth: 'a' } })
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when endpoint is missing', async () => {
    wire({ id: 'u1' });
    const res = await POST(makeRequest({ keys: { p256dh: 'pk', auth: 'a' } }));
    expect(res.status).toBe(400);
  });

  it('returns 200 and upserts subscription on valid body', async () => {
    const db = wire({ id: 'u1' });
    const res = await POST(
      makeRequest({ endpoint: 'https://push.example.com/1', keys: { p256dh: 'pk', auth: 'a' } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // What the name claims: the row is upserted, for THIS user, on the
    // (user_id, endpoint) conflict target that makes it idempotent.
    expect(db.callsTo('push_subscriptions', 'upsert')).toEqual([
      [
        expect.objectContaining({ user_id: 'u1', endpoint: 'https://push.example.com/1' }),
        { onConflict: 'user_id,endpoint' },
      ],
    ]);
  });
});
