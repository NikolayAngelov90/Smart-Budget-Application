/**
 * @jest-environment node
 *
 * Comeback API Route Tests — Story 15.4
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

jest.mock('@/lib/services/streakService', () => ({
  getStreak: jest.fn(),
}));

jest.mock('@/lib/services/comebackService', () => ({
  getLatestChallenge: jest.fn(),
  getActiveChallenge: jest.fn(),
  createChallenge: jest.fn(),
  markStatus: jest.fn(),
  countLogsSince: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getStreak } from '@/lib/services/streakService';
import {
  countLogsSince,
  createChallenge,
  getActiveChallenge,
  getLatestChallenge,
  markStatus,
} from '@/lib/services/comebackService';
import { localDayKey } from '@/lib/ai/streakEngine';
import { GET, PATCH } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetStreak = getStreak as jest.MockedFunction<typeof getStreak>;
const mockGetLatest = getLatestChallenge as jest.MockedFunction<typeof getLatestChallenge>;
const mockGetActive = getActiveChallenge as jest.MockedFunction<typeof getActiveChallenge>;
const mockCreate = createChallenge as jest.MockedFunction<typeof createChallenge>;
const mockMarkStatus = markStatus as jest.MockedFunction<typeof markStatus>;
const mockCount = countLogsSince as jest.MockedFunction<typeof countLogsSince>;

function makeSupabase(user: object | null = { id: 'user-1' }) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

// Clock-relative fixtures (the route compares against the REAL now)
function daysAgoKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDayKey(d);
}

const STALE_STREAK = {
  current_streak: 12,
  longest_streak: 15,
  weekly_streak: 3,
  last_log_date: daysAgoKey(10), // 10-day absence
  last_log_week: '2026-W20',
  freeze_used_on: null,
};

const ACTIVE = {
  id: 'ch-1',
  started_at: new Date(Date.now() - 86_400_000).toISOString(),
  expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  target_count: 3,
  previous_streak: 12,
  status: 'active' as const,
  completed_at: null,
};

const req = (body: unknown) => ({ json: async () => body }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockMarkStatus.mockResolvedValue(undefined);
});

describe('GET /api/comeback', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the existing active challenge with derived progress', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetStreak.mockResolvedValue(STALE_STREAK);
    mockGetLatest.mockResolvedValue(ACTIVE);
    mockCount.mockResolvedValue(2);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ challenge: ACTIVE, loggedCount: 2 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a challenge on read when a 7+ day absence qualifies', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetStreak.mockResolvedValue(STALE_STREAK);
    mockGetLatest.mockResolvedValue(null);
    mockCreate.mockResolvedValue(ACTIVE);
    mockCount.mockResolvedValue(0);

    const res = await GET();
    const body = await res.json();
    expect(body.challenge).toEqual(ACTIVE);
    // previous_streak snapshot = the stale row's current_streak
    expect(mockCreate).toHaveBeenCalledWith('user-1', 12);
  });

  it('does NOT offer a challenge without a qualifying absence', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetStreak.mockResolvedValue({ ...STALE_STREAK, last_log_date: daysAgoKey(2) });
    mockGetLatest.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ challenge: null, loggedCount: 0 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('lazy-expires a stale active challenge instead of returning it', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    // Streak alive again (user logged during the challenge) → no new offer
    mockGetStreak.mockResolvedValue({ ...STALE_STREAK, last_log_date: daysAgoKey(0) });
    mockGetLatest.mockResolvedValue({
      ...ACTIVE,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    const res = await GET();
    const body = await res.json();
    expect(mockMarkStatus).toHaveBeenCalledWith('user-1', 'ch-1', 'expired');
    expect(body.challenge).toBeNull();
  });

  it('streaks unavailable degrades to no offer (signal, not core); challenge read failure is 500', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetStreak.mockRejectedValue(new Error('streaks missing'));
    mockGetLatest.mockResolvedValue(null);

    const okRes = await GET();
    expect((await okRes.json()).challenge).toBeNull();

    mockGetStreak.mockResolvedValue(STALE_STREAK);
    mockGetLatest.mockRejectedValue(new Error('boom'));
    const errRes = await GET();
    expect(errRes.status).toBe(500);
  });
});

describe('PATCH /api/comeback', () => {
  it('dismisses the active challenge', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetActive.mockResolvedValue(ACTIVE);

    const res = await PATCH(req({ action: 'dismiss' }));
    expect(res.status).toBe(200);
    expect(mockMarkStatus).toHaveBeenCalledWith('user-1', 'ch-1', 'dismissed');
  });

  it('404s when there is no active challenge', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockGetActive.mockResolvedValue(null);

    const res = await PATCH(req({ action: 'dismiss' }));
    expect(res.status).toBe(404);
  });

  it('rejects unknown actions — dismiss is the ONLY client-driven transition', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    const res = await PATCH(req({ action: 'complete' }));
    expect(res.status).toBe(400);
    expect(mockMarkStatus).not.toHaveBeenCalled();
  });
});
