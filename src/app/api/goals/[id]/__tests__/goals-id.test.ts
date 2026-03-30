/**
 * Goals [id] API Route Integration Tests
 * Story 11.5: Savings Goals
 *
 * Task 10.3: Integration tests for GET/PUT/DELETE /api/goals/[id]
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
  getGoal: jest.fn(),
  updateGoal: jest.fn(),
  deleteGoal: jest.fn(),
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
import { getGoal, updateGoal, deleteGoal } from '@/lib/services/goalService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetGoal = getGoal as jest.MockedFunction<typeof getGoal>;
const mockUpdateGoal = updateGoal as jest.MockedFunction<typeof updateGoal>;
const mockDeleteGoal = deleteGoal as jest.MockedFunction<typeof deleteGoal>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteFn = (req: any, ctx: any) => Promise<unknown>;

let GET: RouteFn;
let PUT: RouteFn;
let DELETE: RouteFn;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET as unknown as RouteFn;
  PUT = mod.PUT as unknown as RouteFn;
  DELETE = mod.DELETE as unknown as RouteFn;
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
// GET /api/goals/[id]
// ============================================================================

describe('GET /api/goals/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthUnauthorized();
    await GET(buildRequest({}), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns goal when found', async () => {
    mockAuthUser();
    mockGetGoal.mockResolvedValue(sampleGoal);

    await GET(buildRequest({}), buildContext('goal-1'));

    expect(mockGetGoal).toHaveBeenCalledWith(expect.anything(), 'user-1', 'goal-1');
    expect(mockJsonResponse).toHaveBeenCalledWith(sampleGoal);
  });

  it('returns 404 when goal not found', async () => {
    mockAuthUser();
    mockGetGoal.mockResolvedValue(null);

    await GET(buildRequest({}), buildContext('nonexistent'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Not found' } }),
      expect.objectContaining({ status: 404 })
    );
  });

  it('returns 500 on service error', async () => {
    mockAuthUser();
    mockGetGoal.mockRejectedValue(new Error('DB error'));

    await GET(buildRequest({}), buildContext('goal-1'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Failed to manage goals' } }),
      expect.objectContaining({ status: 500 })
    );
  });
});

// ============================================================================
// PUT /api/goals/[id]
// ============================================================================

describe('PUT /api/goals/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthUnauthorized();
    await PUT(buildRequest({ name: 'New' }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns 400 when name exceeds 200 characters', async () => {
    mockAuthUser();
    await PUT(buildRequest({ name: 'a'.repeat(201) }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Goal name must be 200 characters or fewer' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 when name is empty string', async () => {
    mockAuthUser();
    await PUT(buildRequest({ name: '  ' }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Goal name cannot be empty' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 when target_amount is negative', async () => {
    mockAuthUser();
    await PUT(buildRequest({ target_amount: -50 }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'target_amount must be greater than 0' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 when deadline is in the past', async () => {
    mockAuthUser();
    await PUT(buildRequest({ deadline: '2020-06-01' }), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'deadline must be a valid future date' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('updates goal and returns updated data', async () => {
    mockAuthUser();
    const updated = { ...sampleGoal, name: 'New Name' };
    mockUpdateGoal.mockResolvedValue(updated);

    await PUT(buildRequest({ name: 'New Name' }), buildContext('goal-1'));

    expect(mockUpdateGoal).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'goal-1',
      expect.objectContaining({ name: 'New Name' })
    );
    expect(mockJsonResponse).toHaveBeenCalledWith(updated);
  });

  it('returns 404 when service throws "Goal not found"', async () => {
    mockAuthUser();
    mockUpdateGoal.mockRejectedValue(new Error('Goal not found'));

    await PUT(buildRequest({ name: 'X' }), buildContext('nonexistent'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Not found' } }),
      expect.objectContaining({ status: 404 })
    );
  });

  it('returns 500 on unexpected service error', async () => {
    mockAuthUser();
    mockUpdateGoal.mockRejectedValue(new Error('DB crash'));

    await PUT(buildRequest({ name: 'X' }), buildContext('goal-1'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Failed to manage goals' } }),
      expect.objectContaining({ status: 500 })
    );
  });
});

// ============================================================================
// DELETE /api/goals/[id]
// ============================================================================

describe('DELETE /api/goals/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthUnauthorized();
    await DELETE(buildRequest({}), buildContext('goal-1'));
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('deletes goal and returns { success: true }', async () => {
    mockAuthUser();
    mockDeleteGoal.mockResolvedValue(undefined);

    await DELETE(buildRequest({}), buildContext('goal-1'));

    expect(mockDeleteGoal).toHaveBeenCalledWith(expect.anything(), 'user-1', 'goal-1');
    expect(mockJsonResponse).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on service error', async () => {
    mockAuthUser();
    mockDeleteGoal.mockRejectedValue(new Error('Delete failed'));

    await DELETE(buildRequest({}), buildContext('goal-1'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Failed to manage goals' } }),
      expect.objectContaining({ status: 500 })
    );
  });
});
