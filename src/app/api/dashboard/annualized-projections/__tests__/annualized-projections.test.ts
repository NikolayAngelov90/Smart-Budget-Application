/**
 * Annualized Projections API Route Integration Tests
 * Story 11.4: Annualized Spending Projections
 *
 * Task 8.2: Integration tests for GET /api/dashboard/annualized-projections
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

jest.mock('@/lib/services/projectionsService', () => ({
  hasEnoughDataForProjections: jest.fn(),
  getAnnualizedProjections: jest.fn(),
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
  hasEnoughDataForProjections,
  getAnnualizedProjections,
} from '@/lib/services/projectionsService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockHasEnoughData = hasEnoughDataForProjections as jest.MockedFunction<
  typeof hasEnoughDataForProjections
>;
const mockGetProjections = getAnnualizedProjections as jest.MockedFunction<
  typeof getAnnualizedProjections
>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

type GETFn = () => Promise<unknown>;
let GET: GETFn;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET as unknown as GETFn;
});

describe('GET /api/dashboard/annualized-projections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    await GET();

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns { projections: [], hasEnoughData: false } when user has no past month data', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockHasEnoughData.mockResolvedValue(false);

    await GET();

    expect(mockGetProjections).not.toHaveBeenCalled();
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        projections: [],
        hasEnoughData: false,
        months_analyzed: 0,
      })
    );
  });

  it('returns projections with hasEnoughData: true for authenticated user with data', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockHasEnoughData.mockResolvedValue(true);

    const projectionData = {
      projections: [
        {
          category_id: 'cat-1',
          category_name: 'Food',
          category_color: '#ff0000',
          monthly_avg: 100,
          annual_projection: 1200,
          transaction_count: 5,
          is_recurring: false,
          trend: 'stable' as const,
          trend_percentage: null,
        },
      ],
      hasEnoughData: true,
      months_analyzed: 2,
    };
    mockGetProjections.mockResolvedValue(projectionData);

    await GET();

    expect(mockGetProjections).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        projections: projectionData.projections,
        hasEnoughData: true,
        months_analyzed: 2,
      })
    );
  });

  it('returns 500 on unexpected service error', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockHasEnoughData.mockRejectedValue(new Error('DB connection failed'));

    await GET();

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Failed to fetch projections' } }),
      expect.objectContaining({ status: 500 })
    );
  });
});
