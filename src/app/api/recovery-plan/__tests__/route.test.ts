/**
 * Recovery Plan API Route Tests — Story 12.4 / FR4
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

jest.mock('@/lib/services/recoveryPlanService', () => ({
  getActivePlanWithProgress: jest.fn(),
  generatePlan: jest.fn(),
  updatePlanStatus: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import {
  getActivePlanWithProgress,
  generatePlan,
  updatePlanStatus,
} from '@/lib/services/recoveryPlanService';
import { GET, POST } from '../route';
import { PATCH } from '../[id]/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetActive = getActivePlanWithProgress as jest.MockedFunction<typeof getActivePlanWithProgress>;
const mockGenerate = generatePlan as jest.MockedFunction<typeof generatePlan>;
const mockUpdateStatus = updatePlanStatus as jest.MockedFunction<typeof updatePlanStatus>;

function clientWithUser(user: object | null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No session' },
      }),
    },
  };
}

describe('GET /api/recovery-plan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the active plan + canGenerate', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser({ id: 'u1' }) as never);
    mockGetActive.mockResolvedValue({ plan: null, canGenerate: true });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canGenerate).toBe(true);
    expect(mockGetActive).toHaveBeenCalledWith(expect.anything(), 'u1');
  });
});

describe('POST /api/recovery-plan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser(null) as never);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 400 when there is nothing to recover', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser({ id: 'u1' }) as never);
    mockGenerate.mockRejectedValue(new Error('No overspent categories — no recovery plan needed'));
    const res = await POST();
    expect(res.status).toBe(400);
  });

  it('returns 201 with the generated plan', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser({ id: 'u1' }) as never);
    mockGenerate.mockResolvedValue({ id: 'plan-1' } as never);
    const res = await POST();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.plan.id).toBe('plan-1');
  });
});

describe('PATCH /api/recovery-plan/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  const makeReq = (body: object) => ({ json: async () => body }) as never;
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser(null) as never);
    const res = await PATCH(makeReq({ status: 'abandoned' }), makeParams('plan-1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid status', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser({ id: 'u1' }) as never);
    const res = await PATCH(makeReq({ status: 'bogus' }), makeParams('plan-1'));
    expect(res.status).toBe(400);
  });

  it('returns success and calls updatePlanStatus', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser({ id: 'u1' }) as never);
    mockUpdateStatus.mockResolvedValue(undefined);
    const res = await PATCH(makeReq({ status: 'completed' }), makeParams('plan-9'));
    expect(res.status).toBe(200);
    expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), 'u1', 'plan-9', 'completed');
  });
});
