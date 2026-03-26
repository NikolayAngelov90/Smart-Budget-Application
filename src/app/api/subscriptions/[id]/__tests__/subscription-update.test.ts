/**
 * Subscription Update API Route Tests
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * Task 7.4: Integration tests for PATCH /api/subscriptions/:id
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
  createClient: jest.fn(),
}));

jest.mock('@/lib/services/subscriptionService', () => ({
  updateSubscriptionStatus: jest.fn(),
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
import { updateSubscriptionStatus } from '@/lib/services/subscriptionService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockUpdateStatus = updateSubscriptionStatus as jest.MockedFunction<typeof updateSubscriptionStatus>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

let PATCH: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<unknown>;

beforeAll(async () => {
  const mod = await import('../route');
  PATCH = mod.PATCH as unknown as typeof PATCH;
});

function createRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn(),
    },
  } as unknown as Request;
}

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/subscriptions/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockAuthenticatedUser(userId: string) {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: userId, email: 'test@example.com' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Not authenticated' } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const request = createRequest({ status: 'dismissed' });
    await PATCH(request, createParams('sub-1'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns 400 for invalid status value', async () => {
    mockAuthenticatedUser('user-1');

    const request = createRequest({ status: 'invalid-status' });
    await PATCH(request, createParams('sub-1'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Validation failed' }),
      }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 404 when subscription not found', async () => {
    mockAuthenticatedUser('user-1');
    mockUpdateStatus.mockResolvedValue(null);

    const request = createRequest({ status: 'dismissed' });
    await PATCH(request, createParams('nonexistent'));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Subscription not found' } }),
      expect.objectContaining({ status: 404 })
    );
  });

  it('successfully dismisses a subscription', async () => {
    mockAuthenticatedUser('user-1');
    const updated = { id: 'sub-1', status: 'dismissed', merchant_pattern: 'netflix' };
    mockUpdateStatus.mockResolvedValue(updated as Awaited<ReturnType<typeof updateSubscriptionStatus>>);

    const request = createRequest({ status: 'dismissed' });
    await PATCH(request, createParams('sub-1'));

    expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), 'user-1', 'sub-1', 'dismissed');
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ data: updated })
    );
  });

  it('successfully marks a subscription as kept', async () => {
    mockAuthenticatedUser('user-1');
    const updated = { id: 'sub-1', status: 'kept', merchant_pattern: 'netflix' };
    mockUpdateStatus.mockResolvedValue(updated as Awaited<ReturnType<typeof updateSubscriptionStatus>>);

    const request = createRequest({ status: 'kept' });
    await PATCH(request, createParams('sub-1'));

    expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), 'user-1', 'sub-1', 'kept');
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ data: updated })
    );
  });
});
