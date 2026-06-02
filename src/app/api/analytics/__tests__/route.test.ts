/**
 * Engagement Analytics API Route Tests — Story 12.8
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
  createServiceRoleClient: jest.fn(() => ({ __role: 'service' })),
}));

jest.mock('@/lib/services/analyticsDashboardService', () => ({
  isAnalyticsViewer: jest.fn(),
  getAnalyticsDashboard: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { isAnalyticsViewer, getAnalyticsDashboard } from '@/lib/services/analyticsDashboardService';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockIsViewer = isAnalyticsViewer as jest.MockedFunction<typeof isAnalyticsViewer>;
const mockGetDashboard = getAnalyticsDashboard as jest.MockedFunction<typeof getAnalyticsDashboard>;

function clientWithUser(user: object | null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No session' },
      }),
    },
  };
}

function req(range?: string) {
  const params = new URLSearchParams();
  if (range !== undefined) params.set('range', range);
  return { nextUrl: { searchParams: params } } as never;
}

describe('GET /api/analytics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser(null) as never);
    const res = await GET(req('30'));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid range', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser({ id: 'u1' }) as never);
    const res = await GET(req('999'));
    expect(res.status).toBe(400);
    expect(mockIsViewer).not.toHaveBeenCalled();
  });

  it('returns 403 when the user is not an analytics_viewer', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser({ id: 'u1' }) as never);
    mockIsViewer.mockResolvedValue(false);
    const res = await GET(req('30'));
    expect(res.status).toBe(403);
    expect(mockGetDashboard).not.toHaveBeenCalled();
  });

  it('returns 200 with data for an analytics_viewer', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser({ id: 'u1' }) as never);
    mockIsViewer.mockResolvedValue(true);
    mockGetDashboard.mockResolvedValue({
      range_days: 30,
      insight_engagement: [],
      export_usage: { csv_count: 0, pdf_count: 0, csv_total_transactions: 0, pdf_total_pages: 0 },
      pwa_installs_by_platform: [],
      pwa_installs_total: 0,
      wau_trend: [],
      total_events: 0,
      generated_at: '2026-06-15T00:00:00Z',
    });
    const res = await GET(req('30'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.range_days).toBe(30);
    expect(mockGetDashboard).toHaveBeenCalledWith({ __role: 'service' }, 30);
  });

  it('defaults to range 30 when omitted', async () => {
    mockCreateClient.mockResolvedValue(clientWithUser({ id: 'u1' }) as never);
    mockIsViewer.mockResolvedValue(true);
    mockGetDashboard.mockResolvedValue({
      range_days: 30, insight_engagement: [], export_usage: { csv_count: 0, pdf_count: 0, csv_total_transactions: 0, pdf_total_pages: 0 },
      pwa_installs_by_platform: [], pwa_installs_total: 0, wau_trend: [], total_events: 0, generated_at: 'x',
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(mockGetDashboard).toHaveBeenCalledWith(expect.anything(), 30);
  });
});
