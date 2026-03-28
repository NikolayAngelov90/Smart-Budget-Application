/**
 * Heatmap API Route Integration Tests
 * Story 11.3: Spending Heatmap
 *
 * Task 9.2: Integration tests for GET /api/heatmap
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

jest.mock('@/lib/services/heatmapService', () => ({
  getDailySpending: jest.fn(),
  hasEnoughDataForHeatmap: jest.fn(),
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
import { getDailySpending, hasEnoughDataForHeatmap } from '@/lib/services/heatmapService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetDailySpending = getDailySpending as jest.MockedFunction<typeof getDailySpending>;
const mockHasEnoughData = hasEnoughDataForHeatmap as jest.MockedFunction<
  typeof hasEnoughDataForHeatmap
>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

type GETFn = (request: { url: string }) => Promise<unknown>;
let GET: GETFn;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET as unknown as GETFn;
});

function buildRequest(year?: number, month?: number) {
  const params = new URLSearchParams();
  if (year !== undefined) params.set('year', String(year));
  if (month !== undefined) params.set('month', String(month));
  const query = params.toString();
  return { url: `http://localhost/api/heatmap${query ? `?${query}` : ''}` };
}

describe('GET /api/heatmap', () => {
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

    await GET(buildRequest(2026, 3));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Unauthorized' } }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns aggregated daily spending for authenticated user', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const entries = [
      { date: '2026-03-05', total: 25.0, count: 2 },
      { date: '2026-03-10', total: 100.0, count: 3 },
    ];
    mockGetDailySpending.mockResolvedValue(entries);
    mockHasEnoughData.mockResolvedValue(true);

    await GET(buildRequest(2026, 3));

    expect(mockGetDailySpending).toHaveBeenCalledWith(expect.anything(), 'user-1', 2026, 3);
    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        data: entries,
        year: 2026,
        month: 3,
        hasEnoughData: true,
      })
    );
  });

  it('returns hasEnoughData: false when user lacks 7 days of data', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockGetDailySpending.mockResolvedValue([]);
    mockHasEnoughData.mockResolvedValue(false);

    await GET(buildRequest(2026, 3));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [],
        hasEnoughData: false,
      })
    );
  });

  it('returns 400 for invalid month parameter', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const invalidRequest = { url: 'http://localhost/api/heatmap?year=2026&month=13' };
    await GET(invalidRequest);

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Invalid year or month parameter' } }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('defaults to current month when no params provided', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockGetDailySpending.mockResolvedValue([]);
    mockHasEnoughData.mockResolvedValue(false);

    const now = new Date();
    await GET({ url: 'http://localhost/api/heatmap' });

    expect(mockGetDailySpending).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      now.getFullYear(),
      now.getMonth() + 1
    );
  });

  it('returns 500 on unexpected service error', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockGetDailySpending.mockRejectedValue(new Error('DB connection failed'));
    mockHasEnoughData.mockResolvedValue(false);

    await GET(buildRequest(2026, 3));

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: { message: 'Failed to fetch heatmap data' } }),
      expect.objectContaining({ status: 500 })
    );
  });
});
