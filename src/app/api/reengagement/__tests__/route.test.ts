/**
 * Re-engagement API Route Tests — Story 12.6 / FR8
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));

jest.mock('@/lib/services/reengagementService', () => ({
  getReengagementSummary: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { getReengagementSummary } from '@/lib/services/reengagementService';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetSummary = getReengagementSummary as jest.MockedFunction<typeof getReengagementSummary>;

function makeClient(user: object | null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No session' },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { preferences: {} }, error: null }),
    }),
  };
}

describe('GET /api/reengagement', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns { summary: null } when not lapsed', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }) as never);
    mockGetSummary.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBeNull();
  });

  it('returns the summary when lapsed', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }) as never);
    mockGetSummary.mockResolvedValue({
      lapsed_days: 30,
      last_active_date: '2026-05-16',
      typical_monthly_spend: 300,
      active_subscription_count: 2,
      active_subscription_monthly_total: 25,
      goals: [],
      recommended_action: 'Review your subscriptions.',
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.lapsed_days).toBe(30);
    expect(mockGetSummary).toHaveBeenCalledWith(expect.anything(), 'u1', expect.anything());
  });
});
