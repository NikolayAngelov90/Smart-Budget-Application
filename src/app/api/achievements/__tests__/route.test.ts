/**
 * @jest-environment node
 *
 * Achievements API Route Tests — Story 15.3
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

jest.mock('@/lib/services/achievementService', () => ({
  getUnlocked: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getUnlocked } from '@/lib/services/achievementService';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetUnlocked = getUnlocked as jest.MockedFunction<typeof getUnlocked>;

function makeSupabase(user: object | null = { id: 'user-1' }) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/achievements', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockGetUnlocked).not.toHaveBeenCalled();
  });

  it('returns the caller unlock rows', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    const rows = [{ achievement_key: 'first_transaction', unlocked_at: '2026-07-01T00:00:00Z' }];
    mockGetUnlocked.mockResolvedValue(rows as never);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ achievements: rows });
    expect(mockGetUnlocked).toHaveBeenCalledWith('user-1');
  });

  it('degrades to an empty list when the table is unavailable (036 unapplied)', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetUnlocked.mockRejectedValue(new Error('Failed to load achievements'));

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ achievements: [] });
  });
});
