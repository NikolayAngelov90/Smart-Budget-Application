/**
 * @jest-environment node
 *
 * Streaks API Route Tests — Story 15.1
 * (pragma must live in the FIRST docblock — Jest ignores later ones)
 *
 * GET /api/streaks — the caller's streak state, null before the first log.
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

jest.mock('@/lib/services/streakService', () => ({
  getStreak: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getStreak } from '@/lib/services/streakService';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetStreak = getStreak as jest.MockedFunction<typeof getStreak>;

function makeSupabase(user: object | null = { id: 'user-1' }) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

const STATE = {
  current_streak: 3,
  longest_streak: 5,
  weekly_streak: 2,
  last_log_date: '2026-01-06',
  last_log_week: '2026-W02',
  freeze_used_on: null,
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/streaks', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockGetStreak).not.toHaveBeenCalled();
  });

  it('returns the caller streak state', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetStreak.mockResolvedValue(STATE);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.streak).toEqual(STATE);
    expect(mockGetStreak).toHaveBeenCalledWith('user-1');
  });

  it('returns null before the first log', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetStreak.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.streak).toBeNull();
  });

  it('returns 500 when the service fails (core input — degradation policy)', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetStreak.mockRejectedValue(new Error('boom'));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
