/**
 * /api/households route tests — Story 13.1
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

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/services/householdService', () => ({
  createHousehold: jest.fn(),
  getCurrentHousehold: jest.fn(),
  // Real-shaped class so `instanceof` works in the route's 409 branch.
  HouseholdExistsError: class HouseholdExistsError extends Error {
    constructor(message = 'exists') {
      super(message);
      this.name = 'HouseholdExistsError';
    }
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { createHousehold, getCurrentHousehold, HouseholdExistsError } from '@/lib/services/householdService';
import { POST, GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreate = createHousehold as jest.MockedFunction<typeof createHousehold>;
const mockGet = getCurrentHousehold as jest.MockedFunction<typeof getCurrentHousehold>;

function authClient(user: object | null) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no user' } }) },
  };
}

function req(body: unknown) {
  return { json: async () => body } as never;
}

const HOUSEHOLD = { id: 'h-1', name: 'Our Home', created_by: 'user-1', created_at: 'x', updated_at: 'x', role: 'admin' as const };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/households', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    const res = await POST(req({ name: 'Our Home' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid name', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const res = await POST(req({ name: '   ' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the household and returns 201', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockCreate.mockResolvedValue(HOUSEHOLD);
    const res = await POST(req({ name: 'Our Home' }));
    expect(res.status).toBe(201);
    expect((await res.json()).data).toEqual(HOUSEHOLD);
    expect(mockCreate).toHaveBeenCalledWith('user-1', 'Our Home');
  });

  it('returns 409 when the user already belongs to a household', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockCreate.mockRejectedValue(new HouseholdExistsError());
    const res = await POST(req({ name: 'Second' }));
    expect(res.status).toBe(409);
  });

  it('returns 500 on an unexpected error', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockCreate.mockRejectedValue(new Error('db down'));
    const res = await POST(req({ name: 'Our Home' }));
    expect(res.status).toBe(500);
  });
});

describe('GET /api/households', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the household when present', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockGet.mockResolvedValue(HOUSEHOLD);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(HOUSEHOLD);
  });

  it('returns null when the user has no household', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockGet.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toBeNull();
  });
});
