/**
 * GET /api/user/digest — Route Tests
 * Story 11.7: Weekly Financial Digest
 *
 * - 401 when unauthenticated
 * - 200 { data: null } when no digest exists
 * - 200 { data: DigestObject } when digest exists
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
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

jest.mock('@/lib/services/digestService', () => ({
  getLatestDigest: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLatestDigest } from '@/lib/services/digestService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetLatestDigest = getLatestDigest as jest.MockedFunction<typeof getLatestDigest>;
const mockJsonResponse = NextResponse.json as jest.MockedFunction<typeof NextResponse.json>;

let GET: () => Promise<unknown>;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET;
});

describe('GET /api/user/digest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJsonResponse.mockImplementation((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }) as never);
  });

  it('returns 401 when unauthenticated', async () => {
    const supabaseMock = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    };
    mockCreateClient.mockResolvedValue(supabaseMock as never);

    const response = await GET() as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ error: { message: 'Unauthorized' } });
  });

  it('returns 200 with { data: null } when no digest exists', async () => {
    const supabaseMock = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    };
    mockCreateClient.mockResolvedValue(supabaseMock as never);
    mockGetLatestDigest.mockResolvedValue(null);

    const response = await GET() as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: null });
  });

  it('returns 200 with digest data when digest exists', async () => {
    const digest = {
      id: 'd-1',
      user_id: 'user-1',
      week_start: '2026-03-23',
      week_end: '2026-03-29',
      total_spending: 250,
      previous_week_spending: 200,
      spending_change_pct: 25,
      top_categories: [],
      actionable_highlight: 'You spent 250 EUR this week across 0 categories.',
      currency: 'EUR',
      generated_at: '2026-03-30T08:00:00Z',
    };

    const supabaseMock = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    };
    mockCreateClient.mockResolvedValue(supabaseMock as never);
    mockGetLatestDigest.mockResolvedValue(digest as never);

    const response = await GET() as { status: number; json: () => Promise<unknown> };
    expect(response.status).toBe(200);
    const body = await response.json() as { data: typeof digest };
    expect(body.data).toEqual(digest);
  });
});
