/**
 * Seasonal Awareness API Route Tests — Story 12.5 / FR6
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

jest.mock('@/lib/ai/seasonalAnalysis', () => ({
  analyzeSeasonalPatterns: jest.fn(),
}));

jest.mock('@/lib/utils/date', () => ({
  toLocalISODate: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
}));

jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { analyzeSeasonalPatterns } from '@/lib/ai/seasonalAnalysis';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockAnalyze = analyzeSeasonalPatterns as jest.MockedFunction<typeof analyzeSeasonalPatterns>;

function makeClient(user: object | null, txData: object[] = [], dbError: object | null = null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockResolvedValue({ data: txData, error: dbError }),
  };
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No session' },
      }),
    },
    from: jest.fn().mockReturnValue(chain),
  };
}

describe('GET /api/dashboard/seasonal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyze.mockReturnValue({
      timeline: [],
      baseline_monthly: 0,
      months_analyzed: 0,
      hasEnoughData: false,
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the analysis result with generated_at', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, []) as never);
    mockAnalyze.mockReturnValue({
      timeline: [
        { month: '2026-07', month_label: '2026-07', month_index: 7, predicted_amount: 100, is_seasonal_high: false, historical_basis: '2025-07' },
      ],
      baseline_monthly: 100,
      months_analyzed: 12,
      hasEnoughData: true,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasEnoughData).toBe(true);
    expect(body.months_analyzed).toBe(12);
    expect(body.timeline).toHaveLength(1);
    expect(typeof body.generated_at).toBe('string');
  });

  it('returns 500 on database error', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u1' }, [], { message: 'DB error' }) as never);
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
