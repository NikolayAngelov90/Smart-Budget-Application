/**
 * /api/households/goals (GET/POST) + /[id]/contribute (POST) — Story 13.9
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
jest.mock('@/lib/services/householdGoalService', () => ({
  getHouseholdGoals: jest.fn(),
  createHouseholdGoal: jest.fn(),
  contributeToHouseholdGoal: jest.fn(),
  GoalNotFoundError: class GoalNotFoundError extends Error {},
}));
jest.mock('@/lib/services/householdService', () => ({
  NotHouseholdMemberError: class NotHouseholdMemberError extends Error {},
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { getHouseholdGoals, createHouseholdGoal, contributeToHouseholdGoal, GoalNotFoundError } from '@/lib/services/householdGoalService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { GET, POST } from '../route';
import { POST as CONTRIBUTE } from '../[id]/contribute/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGet = getHouseholdGoals as jest.MockedFunction<typeof getHouseholdGoals>;
const mockCreate = createHouseholdGoal as jest.MockedFunction<typeof createHouseholdGoal>;
const mockContribute = contributeToHouseholdGoal as jest.MockedFunction<typeof contributeToHouseholdGoal>;

function authClient(user: object | null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) } };
}
function req(body: unknown) {
  return { json: async () => body } as never;
}
const params = Promise.resolve({ id: 'g1' });

beforeEach(() => jest.clearAllMocks());

describe('GET /api/households/goals', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await GET()).status).toBe(401);
  });
  it('returns the goals list', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockGet.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });
});

describe('POST /api/households/goals', () => {
  it('400 on invalid body', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    expect((await POST(req({ name: '', target_amount: -1 }))).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it('creates a goal (200)', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockCreate.mockResolvedValue({ id: 'g1' } as never);
    const res = await POST(req({ name: 'Vacation', target_amount: 1000 }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith('u', { name: 'Vacation', target_amount: 1000 });
  });
  it('403 when caller has no household', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockCreate.mockRejectedValue(new NotHouseholdMemberError());
    expect((await POST(req({ name: 'V', target_amount: 1000 }))).status).toBe(403);
  });
});

describe('POST /api/households/goals/[id]/contribute', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await CONTRIBUTE(req({ amount: 50 }), { params })).status).toBe(401);
  });
  it('400 on a non-positive amount', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    expect((await CONTRIBUTE(req({ amount: 0 }), { params })).status).toBe(400);
  });
  it('contributes (200)', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockContribute.mockResolvedValue({ id: 'g1', current_amount: 150 } as never);
    const res = await CONTRIBUTE(req({ amount: 50 }), { params });
    expect(res.status).toBe(200);
    expect(mockContribute).toHaveBeenCalledWith('u', 'g1', { amount: 50 });
  });
  it('404 when the goal is not found / not shared', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockContribute.mockRejectedValue(new GoalNotFoundError());
    expect((await CONTRIBUTE(req({ amount: 50 }), { params })).status).toBe(404);
  });
});
