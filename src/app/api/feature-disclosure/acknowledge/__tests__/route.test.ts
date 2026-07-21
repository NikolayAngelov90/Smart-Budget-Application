/**
 * @jest-environment node
 *
 * POST /api/feature-disclosure/acknowledge tests — Story 15.7
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
  acknowledgeFeature: jest.fn(),
  getFeatureState: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { acknowledgeFeature, getFeatureState } from '@/lib/services/featureStateService';
import { POST } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockAck = acknowledgeFeature as jest.MockedFunction<typeof acknowledgeFeature>;
const mockGetState = getFeatureState as jest.MockedFunction<typeof getFeatureState>;

function makeClient(user: { id: string } | null) {
  const profileChain: Record<string, jest.Mock> = {
    maybeSingle: jest.fn().mockResolvedValue({ data: { preferences: {} }, error: null }),
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

const req = (body: unknown) => ({ json: async () => body }) as never;

beforeEach(() => jest.clearAllMocks());

describe('POST /api/feature-disclosure/acknowledge', () => {
  it('401s when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    const res = await POST(req({ feature: 'heatmap' }));
    expect(res.status).toBe(401);
    expect(mockAck).not.toHaveBeenCalled();
  });

  it('400s on an unknown feature key (zod rejects)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u-1' }) as never);
    const res = await POST(req({ feature: 'not_a_feature' }));
    expect(res.status).toBe(400);
    expect(mockAck).not.toHaveBeenCalled();
  });

  it('400s on a missing body', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u-1' }) as never);
    const res = await POST(req(null));
    expect(res.status).toBe(400);
  });

  it('acknowledges a valid key and returns the recomputed disclosure', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ id: 'u-1' }) as never);
    mockAck.mockResolvedValue(['heatmap']);
    mockGetState.mockResolvedValue({
      transactions_count: 30,
      days_active: 5,
      features_unlocked: ['heatmap'],
      last_active_date: '2026-07-21',
    });

    const res = await POST(req({ feature: 'heatmap' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockAck).toHaveBeenCalledWith('u-1', 'heatmap');
    // heatmap unlocked but no longer pending (acknowledged)
    expect(body.unlocked).toContain('heatmap');
    expect(body.pending).not.toContain('heatmap');
  });
});
