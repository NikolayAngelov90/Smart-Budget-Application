/**
 * POST /api/push/subscribe — Tests (Story 12.3)
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { POST } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function makeClient(user: object | null, upsertError: object | null = null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No session' },
      }),
    },
    from: jest.fn().mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: upsertError }),
    }),
  };
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
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    const res = await POST(makeRequest({ endpoint: 'https://x.com', keys: { p256dh: 'pk', auth: 'a' } }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when endpoint is missing', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }) as never);
    const res = await POST(makeRequest({ keys: { p256dh: 'pk', auth: 'a' } }));
    expect(res.status).toBe(400);
  });

  it('returns 200 and upserts subscription on valid body', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }) as never);
    const res = await POST(makeRequest({ endpoint: 'https://push.example.com/1', keys: { p256dh: 'pk', auth: 'a' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
