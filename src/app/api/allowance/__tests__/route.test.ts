/**
 * /api/allowance GET/PUT/DELETE — Story 13.6
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
jest.mock('@/lib/services/allowanceService', () => ({
  getAllowanceStatus: jest.fn(),
  upsertAllowance: jest.fn(),
  deleteAllowance: jest.fn(),
}));
jest.mock('@/lib/services/householdService', () => ({
  NotHouseholdMemberError: class NotHouseholdMemberError extends Error {},
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { getAllowanceStatus, upsertAllowance, deleteAllowance } from '@/lib/services/allowanceService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { GET, PUT, DELETE } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockStatus = getAllowanceStatus as jest.MockedFunction<typeof getAllowanceStatus>;
const mockUpsert = upsertAllowance as jest.MockedFunction<typeof upsertAllowance>;
const mockDelete = deleteAllowance as jest.MockedFunction<typeof deleteAllowance>;

function authClient(user: object | null) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) },
  };
}
function req(body: unknown) {
  return { json: async () => body } as never;
}

beforeEach(() => jest.clearAllMocks());

describe('GET', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await GET()).status).toBe(401);
  });

  it('returns the allowance status', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockStatus.mockResolvedValue({ allowance: null, spent: 0, remaining: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ allowance: null, spent: 0, remaining: null });
  });
});

describe('PUT', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await PUT(req({ monthly_amount: 100 }))).status).toBe(401);
  });

  it('400 on a negative amount', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    const res = await PUT(req({ monthly_amount: -1 }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('saves the allowance (200)', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockUpsert.mockResolvedValue({ id: 'a', monthly_amount: 100 } as never);
    const res = await PUT(req({ monthly_amount: 100, currency: 'EUR' }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith('u', { monthly_amount: 100, currency: 'EUR' });
  });

  it('403 when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockUpsert.mockRejectedValue(new NotHouseholdMemberError());
    expect((await PUT(req({ monthly_amount: 100 }))).status).toBe(403);
  });
});

describe('DELETE', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await DELETE()).status).toBe(401);
  });

  it('deletes the allowance (200)', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockDelete.mockResolvedValue(undefined);
    expect((await DELETE()).status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('u');
  });
});
