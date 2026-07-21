/**
 * @jest-environment node
 *
 * GET /api/feature-disclosure tests — Story 15.7
 * (pragma must live in the FIRST docblock — Jest ignores later ones)
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
jest.mock('@/lib/services/featureStateService', () => ({
  getFeatureState: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getFeatureState } from '@/lib/services/featureStateService';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetFeatureState = getFeatureState as jest.MockedFunction<typeof getFeatureState>;

function makeClient(
  user: { id: string } | null,
  prefs: Record<string, unknown> = {},
  prefsError: unknown = null
) {
  const profileChain: Record<string, jest.Mock> = {
    maybeSingle: jest.fn().mockResolvedValue({
      data: prefsError ? null : { preferences: prefs },
      error: prefsError,
    }),
  };
  profileChain.select = jest.fn(() => profileChain);
  profileChain.eq = jest.fn(() => profileChain);
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'no user' },
      }),
    },
    from: jest.fn(() => profileChain),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/feature-disclosure', () => {
  it('401s when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockGetFeatureState).not.toHaveBeenCalled();
  });

  it('returns unlocked + pending derived from usage state', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u-1' }) as never);
    mockGetFeatureState.mockResolvedValue({
      transactions_count: 30,
      days_active: 5,
      features_unlocked: [],
      last_active_date: '2026-07-21',
    });

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.transactionsCount).toBe(30);
    expect(body.unlocked).toContain('heatmap');
    expect(body.pending).toContain('heatmap');
  });

  it('respects the disclosure_show_all pref (unlocks all, no forced intros)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u-1' }, { disclosure_show_all: true }) as never);
    mockGetFeatureState.mockResolvedValue({
      transactions_count: 0,
      days_active: 0,
      features_unlocked: [],
      last_active_date: null,
    });

    const res = await GET();
    const body = await res.json();
    expect(body.unlocked).toEqual(expect.arrayContaining(['heatmap', 'projections', 'subscriptions']));
    expect(body.pending).toEqual([]);
  });

  it('500s on a core-state read failure (never error-as-empty — would poison the SWR cache)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u-1' }) as never);
    mockGetFeatureState.mockRejectedValue(new Error('db down'));
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it('500s on a PREFS read failure — never caches an all-locked state for a show-all user (15-7 review)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u-1' }, {}, { message: 'prefs down' }) as never);
    mockGetFeatureState.mockResolvedValue({
      transactions_count: 0,
      days_active: 0,
      features_unlocked: [],
      last_active_date: null,
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
