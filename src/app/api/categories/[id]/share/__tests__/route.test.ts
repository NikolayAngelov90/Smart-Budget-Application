/**
 * /api/categories/[id]/share PATCH — Story 13.5 follow-up
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body })),
  },
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/services/categoryShareService', () => ({
  setCategoryShared: jest.fn(),
  CategoryNotFoundError: class CategoryNotFoundError extends Error {},
}));
jest.mock('@/lib/services/householdService', () => ({
  NotHouseholdMemberError: class NotHouseholdMemberError extends Error {},
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { setCategoryShared, CategoryNotFoundError } from '@/lib/services/categoryShareService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { PATCH } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockSet = setCategoryShared as jest.MockedFunction<typeof setCategoryShared>;

function authClient(user: object | null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) } };
}
function req(body: unknown) {
  return { json: async () => body } as never;
}
const params = Promise.resolve({ id: 'c1' });

beforeEach(() => jest.clearAllMocks());

it('401 when unauthenticated', async () => {
  mockCreateClient.mockResolvedValue(authClient(null) as never);
  expect((await PATCH(req({ shared: true }), { params })).status).toBe(401);
});

it('400 when shared flag is missing/invalid', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  expect((await PATCH(req({}), { params })).status).toBe(400);
  expect(mockSet).not.toHaveBeenCalled();
});

it('shares a category (200)', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  mockSet.mockResolvedValue({ id: 'c1', household_id: 'h-1' } as never);
  const res = await PATCH(req({ shared: true }), { params });
  expect(res.status).toBe(200);
  expect(mockSet).toHaveBeenCalledWith('u', 'c1', true);
});

it('403 when the caller has no household', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  mockSet.mockRejectedValue(new NotHouseholdMemberError());
  expect((await PATCH(req({ shared: true }), { params })).status).toBe(403);
});

it('404 when the category is not the caller’s', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  mockSet.mockRejectedValue(new CategoryNotFoundError());
  expect((await PATCH(req({ shared: false }), { params })).status).toBe(404);
});
