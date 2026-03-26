/**
 * Subscriptions API Route Tests
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * Task 7.4: Integration tests for GET /api/subscriptions
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
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
  getSubscriptionsForUser: jest.fn(),
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
import { createClient } from '@/lib/supabase/server';
import {
  getSubscriptionsForUser,
  hasEnoughHistory,
} from '@/lib/services/subscriptionService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetSubscriptions = getSubscriptionsForUser as jest.MockedFunction<typeof getSubscriptionsForUser>;
const mockHasEnoughHistory = hasEnoughHistory as jest.MockedFunction<typeof hasEnoughHistory>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

let GET: () => Promise<unknown>;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET as unknown as () => Promise<unknown>;
});

describe('GET /api/subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Not authenticated' } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    await GET();

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns subscriptions for authenticated user', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const subs = [
      { id: 'sub-1', merchant_pattern: 'netflix', estimated_amount: 9.99, frequency: 'monthly', status: 'active' },
    ];
    mockGetSubscriptions.mockResolvedValue(subs as Awaited<ReturnType<typeof getSubscriptionsForUser>>);
    mockHasEnoughHistory.mockResolvedValue(true);

    await GET();

    expect(mockGetSubscriptions).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        data: subs,
        hasHistory: true,
        count: 1,
      })
    );
  });

  it('returns hasHistory: false when user lacks 3 months of data', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockGetSubscriptions.mockResolvedValue([]);
    mockHasEnoughHistory.mockResolvedValue(false);

    await GET();

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [],
        hasHistory: false,
        count: 0,
      })
    );
  });
});
