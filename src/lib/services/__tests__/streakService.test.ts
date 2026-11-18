/**
 * streakService tests — Story 15.1
 * Mocked Supabase (service boundary); owner-only RLS (034) is the prod gate.
 * Chain mocks record args so user-scoping can't silently vanish (14-4 lesson).
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getStreak, recordLogActivity, restoreStreak } from '@/lib/services/streakService';
import type { StreakState } from '@/types/database.types';
import { createSupabaseMock } from '@/test-utils/supabaseChain';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

/*
 * MIGRATED to `@/test-utils/supabaseChain`. This file carried its own copy of a
 * per-table `makeClient` - the SAME builder hand-copied into budgetService,
 * streakService, valuesService and wishlistService tests, never extracted. It
 * already had the factory's queue model (per table, consumed in from() order);
 * what it lacked was method coverage: a fixed list of stubbed methods, so a
 * query using any other method threw a TypeError.
 *
 * Two semantic differences, stated rather than hidden: a queue that runs DRY
 * returned { data: null } there and repeats its last entry here; an unlisted
 * table returned { data: null } there and { data: [] } here (null for
 * single/maybeSingle). The tests passed unchanged across both.
 *
 * CONTROL-ARM FILE: streakService has no catch at all, so a mock gap here fails
 * visibly. It was missed by the original census, which matched only
 * `from: jest.fn(` and not `const from = jest.fn(`.
 */
type Result = { data: unknown; error: unknown };
type Plan = Record<string, Result | Result[]>;

function makeClient(plan: Plan) {
  return createSupabaseMock({ tables: plan as never });
}

const STATE: StreakState = {
  current_streak: 3,
  longest_streak: 5,
  weekly_streak: 2,
  last_log_date: '2026-01-06',
  last_log_week: '2026-W02',
  freeze_used_on: null,
};

beforeEach(() => jest.clearAllMocks());

describe('getStreak', () => {
  it('returns null before the first log', async () => {
    const db = makeClient({ streaks: { data: null, error: null } });
    mockCreateClient.mockResolvedValue(db.client as never);
    await expect(getStreak('u-1')).resolves.toBeNull();
    // user-scoped read
    expect(db.chainFor('streaks', 0).eq).toHaveBeenCalledWith('user_id', 'u-1');
  });

  it('returns the streak state row', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ streaks: { data: STATE, error: null } }).client as never
    );
    await expect(getStreak('u-1')).resolves.toEqual(STATE);
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ streaks: { data: null, error: { message: 'boom' } } }).client as never
    );
    await expect(getStreak('u-1')).rejects.toThrow('Failed to load streak');
  });
});

describe('recordLogActivity', () => {
  it('inserts a fresh row on the first ever log', async () => {
    const db = makeClient({
      streaks: [
        { data: null, error: null }, // getStreak → none
        { data: null, error: null }, // insert ok
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await recordLogActivity('u-1', '2026-01-05');
    expect(result.event).toBe('started');
    expect(db.chainFor('streaks', 1).insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u-1', current_streak: 1, last_log_date: '2026-01-05' })
    );
  });

  it('updates the existing row on a consecutive day (user-scoped)', async () => {
    const db = makeClient({
      streaks: [
        { data: STATE, error: null }, // getStreak
        { data: [{ user_id: 'u-1' }], error: null }, // CAS update matched 1 row
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await recordLogActivity('u-1', '2026-01-07');
    expect(result.event).toBe('extended');
    expect(result.state.current_streak).toBe(4);
    const updateChain = db.chainFor('streaks', 1);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ current_streak: 4, last_log_date: '2026-01-07' })
    );
    expect(updateChain.eq).toHaveBeenCalledWith('user_id', 'u-1');
    // Compare-and-swap guard: only writes if the row is still what we read
    expect(updateChain.eq).toHaveBeenCalledWith('last_log_date', '2026-01-06');
  });

  it('rejects garbage day keys before touching the db', async () => {
    await expect(recordLogActivity('u-1', '2026-13-40')).rejects.toThrow('Invalid log day key');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('CAS miss (concurrent writer) → re-reads and retries once', async () => {
    const advanced = { ...STATE, current_streak: 4, last_log_date: '2026-01-07' };
    const db = makeClient({
      streaks: [
        { data: STATE, error: null }, // getStreak (stale)
        { data: [], error: null }, // CAS update matched 0 rows (someone else wrote)
        { data: advanced, error: null }, // re-read fresh state
        { data: [{ user_id: 'u-1' }], error: null }, // retry CAS ok
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await recordLogActivity('u-1', '2026-01-08');
    // Fresh state last_log 01-07 + log 01-08 → extended to 5
    expect(result.event).toBe('extended');
    expect(result.state.current_streak).toBe(5);
  });

  it('23505 with a vanished winner row retries the insert (never fabricates)', async () => {
    const db = makeClient({
      streaks: [
        { data: null, error: null }, // getStreak → none
        { data: null, error: { code: '23505', message: 'duplicate' } }, // insert loses
        { data: null, error: null }, // re-read → row gone
        { data: null, error: null }, // insert retry ok
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await recordLogActivity('u-1', '2026-01-05');
    expect(result.event).toBe('started');
    expect(result.state.current_streak).toBe(1);
    // Fourth chain was an insert, not a fabricated return
    expect(db.chainFor('streaks', 3).insert).toHaveBeenCalled();
  });

  it('skips the write entirely for same-day repeats (idempotent)', async () => {
    const db = makeClient({ streaks: { data: STATE, error: null } });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await recordLogActivity('u-1', '2026-01-06');
    expect(result.event).toBe('same_day');
    expect(db.from).toHaveBeenCalledTimes(1); // only the read
  });

  it('recovers from a 23505 first-log race by re-reading and updating', async () => {
    const db = makeClient({
      streaks: [
        { data: null, error: null }, // getStreak → none (stale)
        { data: null, error: { code: '23505', message: 'duplicate' } }, // insert loses race
        { data: STATE, error: null }, // re-read winner row
        { data: [{ user_id: 'u-1' }], error: null }, // CAS update matched 1 row
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await recordLogActivity('u-1', '2026-01-07');
    expect(result.event).toBe('extended');
    expect(result.state.current_streak).toBe(4);
  });

  it('propagates update failures so callers can treat them as non-fatal', async () => {
    const db = makeClient({
      streaks: [
        { data: STATE, error: null },
        { data: null, error: { message: 'boom' } },
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);
    await expect(recordLogActivity('u-1', '2026-01-07')).rejects.toThrow('Failed to update streak');
  });
});

describe('restoreStreak (Story 15.4)', () => {
  it('raises current_streak to the restored value, CAS-guarded', async () => {
    // STATE: current 3, longest 5 -> restore(4) -> target 4
    const db = makeClient({
      streaks: [
        { data: STATE, error: null }, // getStreak
        { data: [{ user_id: 'u-1' }], error: null }, // CAS update ok
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(restoreStreak('u-1', 4)).resolves.toBe(4);
    const updateChain = db.chainFor('streaks', 1);
    expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ current_streak: 4 }));
    expect(updateChain.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(updateChain.eq).toHaveBeenCalledWith('last_log_date', '2026-01-06');
  });

  it('clamps the restore to longest_streak (034 CHECK safety)', async () => {
    const db = makeClient({
      streaks: [
        { data: STATE, error: null }, // longest 5
        { data: [{ user_id: 'u-1' }], error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(restoreStreak('u-1', 50)).resolves.toBe(5);
  });

  it('never lowers what the user already rebuilt (no write needed)', async () => {
    const db = makeClient({
      streaks: [{ data: { ...STATE, current_streak: 4 }, error: null }],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(restoreStreak('u-1', 2)).resolves.toBe(4);
    expect(db.from).toHaveBeenCalledTimes(1); // read only
  });

  it('CAS miss re-reads and retries once against the fresh row', async () => {
    const fresh = { ...STATE, current_streak: 2, last_log_date: '2026-01-07' };
    const db = makeClient({
      streaks: [
        { data: STATE, error: null }, // stale read
        { data: [], error: null }, // CAS miss
        { data: fresh, error: null }, // re-read
        { data: [{ user_id: 'u-1' }], error: null }, // retry ok
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(restoreStreak('u-1', 4)).resolves.toBe(4);
  });

  it('no streak row: reports 0 without fabricating', async () => {
    const db = makeClient({
      streaks: [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);
    await expect(restoreStreak('u-1', 4)).resolves.toBe(0);
  });
});
