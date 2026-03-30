/**
 * Goals API Route Integration Tests
 * Story 11.5: Savings Goals
 *
 * Task 10.2: Integration tests for GET /api/goals and POST /api/goals
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
  getGoals: jest.fn(),
  createGoal: jest.fn(),
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
import { getGoals, createGoal } from '@/lib/services/goalService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetGoals = getGoals as jest.MockedFunction<typeof getGoals>;
const mockCreateGoal = createGoal as jest.MockedFunction<typeof createGoal>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

type GETFn = () => Promise<unknown>;
type POSTFn = (req: unknown) => Promise<unknown>;

let GET: GETFn;
let POST: POSTFn;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET as unknown as GETFn;
  POST = mod.POST as unknown as POSTFn;
});

// ============================================================================
// Shared auth mock helpers
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

function buildRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
  };
}

const sampleGoal = {
  id: 'goal-1',
  user_id: 'user-1',
  name: 'Emergency Fund',
  target_amount: 1000,
  current_amount: 250,
  deadline: null,
  milestones_celebrated: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ============================================================================
// GET /api/goals
// ============================================================================

describe('GET /api/goals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthUnauthorized();
    await GET();
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns goals array for authenticated user', async () => {
    mockAuthUser();
    mockGetGoals.mockResolvedValue([sampleGoal]);

    await GET();

    expect(mockGetGoals).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ goals: [sampleGoal] })
    );
  });

  it('returns empty goals array when user has no goals', async () => {
    mockAuthUser();
    mockGetGoals.mockResolvedValue([]);

    await GET();

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ goals: [] })
    );
  });

  it('returns 500 on service error', async () => {
    mockAuthUser();
    mockGetGoals.mockRejectedValue(new Error('DB connection failed'));

    await GET();

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Failed to manage goals' } }),
      expect.objectContaining({ status: 500 })
    );
  });
});

// ============================================================================
// POST /api/goals
// ============================================================================

describe('POST /api/goals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthUnauthorized();
    const req = buildRequest({ name: 'Test', target_amount: 500 });

    await POST(req);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns 400 when name is missing', async () => {
    mockAuthUser();
    const req = buildRequest({ name: '', target_amount: 500 });

    await POST(req);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Goal name is required' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 when name exceeds 200 characters', async () => {
    mockAuthUser();
    const req = buildRequest({ name: 'a'.repeat(201), target_amount: 500 });

    await POST(req);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Goal name must be 200 characters or fewer' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 when target_amount is zero', async () => {
    mockAuthUser();
    const req = buildRequest({ name: 'Test', target_amount: 0 });

    await POST(req);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'target_amount must be greater than 0' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 when deadline is in the past', async () => {
    mockAuthUser();
    const req = buildRequest({ name: 'Test', target_amount: 500, deadline: '2020-01-01' });

    await POST(req);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'deadline must be a valid future date' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('creates goal and returns 201 with goal data', async () => {
    mockAuthUser();
    mockCreateGoal.mockResolvedValue(sampleGoal);
    const req = buildRequest({ name: 'Emergency Fund', target_amount: 1000 });

    await POST(req);

    expect(mockCreateGoal).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({ name: 'Emergency Fund', target_amount: 1000, deadline: null })
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(
      sampleGoal,
      expect.objectContaining({ status: 201 })
    );
  });

  it('returns 500 on service error', async () => {
    mockAuthUser();
    mockCreateGoal.mockRejectedValue(new Error('Insert failed'));
    const req = buildRequest({ name: 'Test', target_amount: 100 });

    await POST(req);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Failed to manage goals' } }),
      expect.objectContaining({ status: 500 })
    );
  });
});
