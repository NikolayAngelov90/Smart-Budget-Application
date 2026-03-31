/**
 * GET /api/cron/weekly-digest — Route Tests
 * Story 11.7: Weekly Financial Digest
 *
 * - 401 when CRON_SECRET missing / invalid
 * - Calls generateDigestForUser for each eligible user
 * - Skips users with weekly_digest_enabled = false
 * - Returns metrics { success, usersProcessed, digestsGenerated, errors }
 * - Returns 500 on unexpected error
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/services/digestService', () => ({
  generateDigestForUser: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('date-fns', () => ({
  startOfWeek: jest.fn(() => new Date('2026-03-23T00:00:00Z')),
  subWeeks: jest.fn(() => new Date('2026-03-26T08:00:00Z')),
}));

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateDigestForUser } from '@/lib/services/digestService';

const mockCreateServiceRoleClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;
const mockGenerateDigest = generateDigestForUser as jest.MockedFunction<typeof generateDigestForUser>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

let GET: (request: Request) => Promise<unknown>;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET as unknown as (request: Request) => Promise<unknown>;
});

const CRON_SECRET = 'test-cron-secret';

function makeRequest(token?: string) {
  return {
    headers: {
      get: (header: string) => (header === 'authorization' ? (token ? `Bearer ${token}` : null) : null),
    },
  } as unknown as Request;
}

describe('GET /api/cron/weekly-digest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    mockJsonResponse.mockImplementation((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }) as never);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('returns 401 when Authorization header is missing', async () => {
    const response = await GET(makeRequest()) as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is wrong', async () => {
    const response = await GET(makeRequest('wrong-secret')) as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(401);
  });

  it('calls generateDigestForUser for each enabled user', async () => {
    const users = [
      { id: 'user-1', preferences: {} },
      { id: 'user-2', preferences: { weekly_digest_enabled: true } },
    ];
    const supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: users, error: null }),
    };
    mockCreateServiceRoleClient.mockReturnValue(supabaseMock as never);
    mockGenerateDigest.mockResolvedValue(undefined);

    const response = await GET(makeRequest(CRON_SECRET)) as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(200);
    expect(mockGenerateDigest).toHaveBeenCalledTimes(2);
    const body = await response.json() as { success: boolean; digestsGenerated: number; usersProcessed: number };
    expect(body.success).toBe(true);
    expect(body.digestsGenerated).toBe(2);
    expect(body.usersProcessed).toBe(2);
  });

  it('passes user currency_format preference to generateDigestForUser', async () => {
    const users = [
      { id: 'user-1', preferences: { currency_format: 'USD' } },
    ];
    const supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: users, error: null }),
    };
    mockCreateServiceRoleClient.mockReturnValue(supabaseMock as never);
    mockGenerateDigest.mockResolvedValue(undefined);

    await GET(makeRequest(CRON_SECRET));

    expect(mockGenerateDigest).toHaveBeenCalledWith('user-1', expect.any(Date), 'USD');
  });

  it('falls back to EUR when currency_format preference is missing', async () => {
    const users = [{ id: 'user-1', preferences: {} }];
    const supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: users, error: null }),
    };
    mockCreateServiceRoleClient.mockReturnValue(supabaseMock as never);
    mockGenerateDigest.mockResolvedValue(undefined);

    await GET(makeRequest(CRON_SECRET));

    expect(mockGenerateDigest).toHaveBeenCalledWith('user-1', expect.any(Date), 'EUR');
  });

  it('returns 500 when user_profiles DB query returns an error', async () => {
    const supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB connection timeout' } }),
    };
    mockCreateServiceRoleClient.mockReturnValue(supabaseMock as never);

    const response = await GET(makeRequest(CRON_SECRET)) as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(500);
    const body = await response.json() as { success: boolean; details: string };
    expect(body.success).toBe(false);
    expect(body.details).toBe('DB connection timeout');
  });

  it('skips users with weekly_digest_enabled = false', async () => {
    const users = [
      { id: 'user-1', preferences: { weekly_digest_enabled: false } },
      { id: 'user-2', preferences: {} },
    ];
    const supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: users, error: null }),
    };
    mockCreateServiceRoleClient.mockReturnValue(supabaseMock as never);
    mockGenerateDigest.mockResolvedValue(undefined);

    const response = await GET(makeRequest(CRON_SECRET)) as { status: number; json: () => Promise<unknown> };
    expect(mockGenerateDigest).toHaveBeenCalledTimes(1);
    expect(mockGenerateDigest).toHaveBeenCalledWith('user-2', expect.any(Date), 'EUR');
    const body = await response.json() as { digestsGenerated: number };
    expect(body.digestsGenerated).toBe(1);
  });

  it('records errors and continues processing remaining users', async () => {
    const users = [
      { id: 'user-1', preferences: {} },
      { id: 'user-2', preferences: {} },
    ];
    const supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: users, error: null }),
    };
    mockCreateServiceRoleClient.mockReturnValue(supabaseMock as never);
    mockGenerateDigest
      .mockRejectedValueOnce(new Error('DB timeout'))
      .mockResolvedValueOnce(undefined);

    const response = await GET(makeRequest(CRON_SECRET)) as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(200);
    const body = await response.json() as { digestsGenerated: number; errors: Array<{ userId: string; error: string }> };
    expect(body.digestsGenerated).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]?.userId).toBe('user-1');
  });

  it('returns 200 with zero counts when no users exist', async () => {
    const supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockCreateServiceRoleClient.mockReturnValue(supabaseMock as never);

    const response = await GET(makeRequest(CRON_SECRET)) as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(200);
    const body = await response.json() as { usersProcessed: number };
    expect(body.usersProcessed).toBe(0);
    expect(mockGenerateDigest).not.toHaveBeenCalled();
  });

  it('returns 500 on fatal error', async () => {
    mockCreateServiceRoleClient.mockImplementation(() => {
      throw new Error('Connection refused');
    });

    const response = await GET(makeRequest(CRON_SECRET)) as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(500);
    const body = await response.json() as { success: boolean };
    expect(body.success).toBe(false);
  });
});
