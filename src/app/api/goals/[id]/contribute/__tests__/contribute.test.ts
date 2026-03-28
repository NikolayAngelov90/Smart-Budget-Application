/**
 * Goal Contribution API Route Integration Tests
 * Story 11.5: Savings Goals
 *
 * Task 10.4: Integration tests for POST /api/goals/[id]/contribute
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
  addContribution: jest.fn(),
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
import { addContribution } from '@/lib/services/goalService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockAddContribution = addContribution as jest.MockedFunction<typeof addContribution>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostFn = (req: any, ctx: any) => Promise<unknown>;
let POST: PostFn;

beforeAll(async () => {
  const mod = await import('../route');
  POST = mod.POST as unknown as PostFn;
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

const updatedGoal = {
  id: 'goal-1',
  user_id: 'user-1',
  name: 'Emergency Fund',
  target_amount: 1000,
  current_amount: 350,
  deadline: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ============================================================================
// POST /api/goals/[id]/contribute
// ============================================================================

describe('POST /api/goals/[id]/contribute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthUnauthorized();
    await POST(buildRequest({ amount: 100 }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns 400 when amount is zero', async () => {
    mockAuthUser();
    await POST(buildRequest({ amount: 0 }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'amount must be greater than 0' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 when amount is negative', async () => {
    mockAuthUser();
    await POST(buildRequest({ amount: -50 }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'amount must be greater than 0' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('adds contribution and returns updated goal', async () => {
    mockAuthUser();
    mockAddContribution.mockResolvedValue(updatedGoal);

    await POST(buildRequest({ amount: 100, note: 'Monthly savings' }), buildContext('goal-1'));

    expect(mockAddContribution).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'goal-1',
      { amount: 100, note: 'Monthly savings' }
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(updatedGoal);
  });

  it('passes null note when note not provided', async () => {
    mockAuthUser();
    mockAddContribution.mockResolvedValue(updatedGoal);

    await POST(buildRequest({ amount: 50 }), buildContext('goal-1'));

    expect(mockAddContribution).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'goal-1',
      { amount: 50, note: null }
    );
  });

  it('returns 404 when goal not found', async () => {
    mockAuthUser();
    mockAddContribution.mockRejectedValue(new Error('Goal not found'));

    await POST(buildRequest({ amount: 100 }), buildContext('nonexistent'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Not found' } }),
      expect.objectContaining({ status: 404 })
    );
  });

  it('returns 500 on unexpected service error', async () => {
    mockAuthUser();
    mockAddContribution.mockRejectedValue(new Error('DB crash'));

    await POST(buildRequest({ amount: 100 }), buildContext('goal-1'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Failed to manage goals' } }),
      expect.objectContaining({ status: 500 })
    );
  });
});
