/**
 * Celebrate API Route Integration Tests
 * Story 11.6: Goal Milestone Celebrations
 *
 * POST /api/goals/[id]/celebrate
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

jest.mock('@/lib/services/goalService', () => ({
  markMilestoneCelebrated: jest.fn(),
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
import { createClient } from '@/lib/supabase/server';
import { markMilestoneCelebrated } from '@/lib/services/goalService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockMarkMilestoneCelebrated = markMilestoneCelebrated as jest.MockedFunction<typeof markMilestoneCelebrated>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteFn = (req: any, ctx: any) => Promise<unknown>;

let POST: RouteFn;

beforeAll(async () => {
  const mod = await import('../route');
  POST = mod.POST as unknown as RouteFn;
});

// ============================================================================
// Helpers
// ============================================================================

function mockAuthUser(userId = 'user-1') {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: userId, email: 'test@example.com' } },
        error: null,
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

function mockAuthUnauthorized() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildRequest(body: unknown) {
  return { json: jest.fn().mockResolvedValue(body) };
}

// ============================================================================
// POST /api/goals/[id]/celebrate
// ============================================================================

describe('POST /api/goals/[id]/celebrate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthUnauthorized();
    await POST(buildRequest({ threshold: 25 }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns 400 on invalid threshold (0)', async () => {
    mockAuthUser();
    await POST(buildRequest({ threshold: 0 }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'threshold must be one of 25, 50, 75, 100' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 on invalid threshold (50.5)', async () => {
    mockAuthUser();
    await POST(buildRequest({ threshold: 50.5 }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'threshold must be one of 25, 50, 75, 100' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 on invalid threshold (101)', async () => {
    mockAuthUser();
    await POST(buildRequest({ threshold: 101 }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'threshold must be one of 25, 50, 75, 100' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 on invalid threshold (string)', async () => {
    mockAuthUser();
    await POST(buildRequest({ threshold: 'bad' }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'threshold must be one of 25, 50, 75, 100' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it.each([25, 50, 75, 100])('returns { success: true } for valid threshold %i', async (threshold) => {
    mockAuthUser();
    mockMarkMilestoneCelebrated.mockResolvedValue(undefined);

    await POST(buildRequest({ threshold }), buildContext('goal-1'));

    expect(mockMarkMilestoneCelebrated).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'goal-1',
      threshold
    );
    expect(mockJsonResponse).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on service error', async () => {
    mockAuthUser();
    mockMarkMilestoneCelebrated.mockRejectedValue(new Error('DB error'));

    await POST(buildRequest({ threshold: 50 }), buildContext('goal-1'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Failed to mark milestone' } }),
      expect.objectContaining({ status: 500 })
    );
  });
});
