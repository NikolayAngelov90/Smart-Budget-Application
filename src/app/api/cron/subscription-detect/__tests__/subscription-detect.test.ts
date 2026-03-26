/**
 * Subscription Detection Cron Job Tests
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * Task 7.3: Integration test for cron endpoint
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body,
    })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/services/subscriptionService', () => ({
  detectSubscriptions: jest.fn(),
  flagUnusedSubscriptions: jest.fn(),
  hasEnoughHistory: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  detectSubscriptions,
  flagUnusedSubscriptions,
  hasEnoughHistory,
} from '@/lib/services/subscriptionService';

const mockCreateServiceRoleClient = createServiceRoleClient as jest.MockedFunction<
  typeof createServiceRoleClient
>;
const mockDetectSubscriptions = detectSubscriptions as jest.MockedFunction<typeof detectSubscriptions>;
const mockFlagUnused = flagUnusedSubscriptions as jest.MockedFunction<typeof flagUnusedSubscriptions>;
const mockHasEnoughHistory = hasEnoughHistory as jest.MockedFunction<typeof hasEnoughHistory>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

// Dynamic import to load after mocks are set up
let GET: (request: Request) => Promise<unknown>;
let POST: () => Promise<unknown>;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET as unknown as (request: Request) => Promise<unknown>;
  POST = mod.POST as unknown as () => Promise<unknown>;
});

describe('GET /api/cron/subscription-detect', () => {
  const CRON_SECRET = 'test-cron-secret-value';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  function createRequest(token?: string) {
    const headers = new Headers();
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return {
      headers: {
        get: (name: string) => headers.get(name),
      },
    } as unknown as Request;
  }

  it('returns 401 when no authorization header is provided', async () => {
    const request = createRequest();
    await GET(request);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Unauthorized' }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns 401 when token is invalid', async () => {
    const request = createRequest('wrong-secret');
    await GET(request);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Unauthorized' }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('processes eligible users successfully', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: 'user-1' }, { id: 'user-2' }],
            error: null,
          }),
        }),
      }),
    };
    mockCreateServiceRoleClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServiceRoleClient>);
    mockHasEnoughHistory.mockResolvedValue(true);
    mockDetectSubscriptions.mockResolvedValue([]);
    mockFlagUnused.mockResolvedValue(0);

    const request = createRequest(CRON_SECRET);
    await GET(request);

    expect(mockHasEnoughHistory).toHaveBeenCalledTimes(2);
    expect(mockDetectSubscriptions).toHaveBeenCalledTimes(2);
    expect(mockFlagUnused).toHaveBeenCalledTimes(2);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        usersProcessed: 2,
      }),
      expect.objectContaining({ status: 200 })
    );
  });

  it('skips users without enough history', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: 'user-1' }],
            error: null,
          }),
        }),
      }),
    };
    mockCreateServiceRoleClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServiceRoleClient>);
    mockHasEnoughHistory.mockResolvedValue(false);

    const request = createRequest(CRON_SECRET);
    await GET(request);

    expect(mockDetectSubscriptions).not.toHaveBeenCalled();
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        usersProcessed: 0,
      }),
      expect.objectContaining({ status: 200 })
    );
  });

  it('returns metrics including detected and flagged counts', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: 'user-1' }],
            error: null,
          }),
        }),
      }),
    };
    mockCreateServiceRoleClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServiceRoleClient>);
    mockHasEnoughHistory.mockResolvedValue(true);
    mockDetectSubscriptions.mockResolvedValue([
      { user_id: 'user-1', merchant_pattern: 'netflix', estimated_amount: 9.99, frequency: 'monthly', last_seen_at: '', status: 'active' },
    ]);
    mockFlagUnused.mockResolvedValue(1);

    const request = createRequest(CRON_SECRET);
    await GET(request);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        usersProcessed: 1,
        subscriptionsDetected: 1,
        subscriptionsFlagged: 1,
      }),
      expect.objectContaining({ status: 200 })
    );
  });

  it('handles errors gracefully and continues processing', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: 'user-1' }, { id: 'user-2' }],
            error: null,
          }),
        }),
      }),
    };
    mockCreateServiceRoleClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServiceRoleClient>);
    mockHasEnoughHistory.mockResolvedValue(true);
    mockDetectSubscriptions
      .mockRejectedValueOnce(new Error('Database error'))
      .mockResolvedValueOnce([]);
    mockFlagUnused.mockResolvedValue(0);

    const request = createRequest(CRON_SECRET);
    await GET(request);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        usersProcessed: 1,
        errorCount: 1,
      }),
      expect.objectContaining({ status: 200 })
    );
  });
});

describe('POST /api/cron/subscription-detect', () => {
  it('returns 405 Method Not Allowed', async () => {
    await POST();

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Method not allowed. Use GET for cron job execution.' }),
      expect.objectContaining({ status: 405 })
    );
  });
});
