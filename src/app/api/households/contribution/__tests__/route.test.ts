/**
 * /api/households/contribution PATCH + /api/households/contributions GET — Story 13.7
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
jest.mock('@/lib/services/contributionService', () => ({
  setContribution: jest.fn(),
  getContributionSummary: jest.fn(),
}));
jest.mock('@/lib/services/householdService', () => ({
  NotHouseholdMemberError: class NotHouseholdMemberError extends Error {},
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { setContribution, getContributionSummary } from '@/lib/services/contributionService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { PATCH } from '../route';
import { GET } from '../../contributions/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockSet = setContribution as jest.MockedFunction<typeof setContribution>;
const mockSummary = getContributionSummary as jest.MockedFunction<typeof getContributionSummary>;

function authClient(user: object | null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) } };
}
function req(body: unknown) {
  return { json: async () => body } as never;
}

beforeEach(() => jest.clearAllMocks());

describe('PATCH /api/households/contribution', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await PATCH(req({ percentage: 50 }))).status).toBe(401);
  });

  it('400 on out-of-range percentage', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    expect((await PATCH(req({ percentage: 150 }))).status).toBe(400);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('saves the percentage (200)', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockSet.mockResolvedValue(60);
    const res = await PATCH(req({ percentage: 60 }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.percentage).toBe(60);
    expect(mockSet).toHaveBeenCalledWith('u', 60);
  });

  it('403 when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockSet.mockRejectedValue(new NotHouseholdMemberError());
    expect((await PATCH(req({ percentage: 50 }))).status).toBe(403);
  });
});

describe('GET /api/households/contributions', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await GET()).status).toBe(401);
  });

  it('returns the summary', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockSummary.mockResolvedValue({ total: 150, splits: [] });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data.total).toBe(150);
  });
});
