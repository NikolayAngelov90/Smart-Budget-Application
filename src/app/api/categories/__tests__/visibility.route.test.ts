/**
 * Categories [id] PUT — owner-only visibility (Story 13.4)
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { PUT } from '../[id]/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function makeClient(opts: { user?: object | null; category?: object | null; updated?: object }) {
  const { user = { id: 'user-1' }, category, updated = { id: 'c1', visibility_level: 'private' } } = opts;
  const cat = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }), // no duplicate
    single: jest.fn().mockResolvedValueOnce({ data: category, error: category ? null : { message: 'x' } })
      .mockResolvedValue({ data: updated, error: null }),
  };
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) },
    from: jest.fn(() => cat),
  };
}
function req(body: unknown) {
  return { json: async () => body } as never;
}
const params = Promise.resolve({ id: 'c1' });
const OWNER_CAT = { id: 'c1', name: 'Groceries', is_predefined: false, type: 'expense', user_id: 'user-1', household_id: 'h-1' };

beforeEach(() => jest.clearAllMocks());

it('owner can set visibility on a shared category (200)', async () => {
  mockCreateClient.mockResolvedValue(makeClient({ category: OWNER_CAT }) as never);
  const res = await PUT(req({ visibility_level: 'private' }), { params });
  expect(res.status).toBe(200);
});

it('non-owner CANNOT change visibility (403)', async () => {
  mockCreateClient.mockResolvedValue(makeClient({ category: { ...OWNER_CAT, user_id: 'someone-else' } }) as never);
  const res = await PUT(req({ visibility_level: 'shared' }), { params });
  expect(res.status).toBe(403);
});

it('401 when unauthenticated', async () => {
  mockCreateClient.mockResolvedValue(makeClient({ user: null, category: OWNER_CAT }) as never);
  expect((await PUT(req({ visibility_level: 'private' }), { params })).status).toBe(401);
});

it('cannot modify predefined categories (403)', async () => {
  mockCreateClient.mockResolvedValue(makeClient({ category: { ...OWNER_CAT, is_predefined: true } }) as never);
  expect((await PUT(req({ color: '#000000' }), { params })).status).toBe(403);
});
