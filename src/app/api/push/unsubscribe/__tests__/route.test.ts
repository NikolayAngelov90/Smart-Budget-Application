/**
 * DELETE /api/push/unsubscribe — Tests (Story 12.3)
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DELETE } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function makeClient(user: object | null) {
  const deleteEq2 = jest.fn().mockResolvedValue({ error: null });
  const deleteEq1 = jest.fn().mockReturnValue({ eq: deleteEq2 });
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No session' },
      }),
    },
    from: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnValue({ eq: deleteEq1 }),
    }),
  };
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
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    const res = await DELETE(makeRequest({ endpoint: 'https://x.com' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when endpoint is missing', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }) as never);
    const res = await DELETE(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 200 and deletes subscription', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }) as never);
    const res = await DELETE(makeRequest({ endpoint: 'https://push.example.com/1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
