/**
 * /api/households/preset PATCH — Story 13.4
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
jest.mock('@/lib/services/householdService', () => ({
  applyPreset: jest.fn(),
  NotHouseholdMemberError: class NotHouseholdMemberError extends Error {},
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { applyPreset, NotHouseholdMemberError } from '@/lib/services/householdService';
import { PATCH } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockApply = applyPreset as jest.MockedFunction<typeof applyPreset>;

function authClient(user: object | null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) } };
}
function req(body: unknown) {
  return { json: async () => body } as never;
}

beforeEach(() => jest.clearAllMocks());

it('401 when unauthenticated', async () => {
  mockCreateClient.mockResolvedValue(authClient(null) as never);
  expect((await PATCH(req({ preset: 'newlyweds' }))).status).toBe(401);
});

it('400 on an invalid preset', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  const res = await PATCH(req({ preset: 'nonsense' }));
  expect(res.status).toBe(400);
  expect(mockApply).not.toHaveBeenCalled();
});

it('applies the preset (200)', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  mockApply.mockResolvedValue('roommates' as never);
  const res = await PATCH(req({ preset: 'roommates' }));
  expect(res.status).toBe(200);
  expect((await res.json()).data.preset).toBe('roommates');
  expect(mockApply).toHaveBeenCalledWith('u', 'roommates');
});

it('403 when the caller has no household', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  mockApply.mockRejectedValue(new NotHouseholdMemberError());
  expect((await PATCH(req({ preset: 'partners' }))).status).toBe(403);
});
