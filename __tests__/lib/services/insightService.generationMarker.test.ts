/**
 * @jest-environment node
 */

/**
 * hp-8 — the "insights last generated" marker.
 *
 * `shouldTriggerGeneration` read a module-level `Map`. On a serverless cold
 * start that Map is empty, so EVERY user looked "never generated", the
 * 10-transaction gate was skipped, and insights regenerated on essentially every
 * transaction POST. Three states — not loaded / never / generated-at-T — squeezed
 * into two, with the missing one collapsing into the expensive answer.
 *
 * The marker is now `user_profiles.insights_last_generated_at`.
 *
 * WHY NOT DERIVE IT FROM THE INSIGHT ROWS, which is the obvious cheaper fix:
 *
 *  - MAX(created_at) is correct only while generation DELETES every row and
 *    reinserts, so each row's created_at happens to be the last run. hp-10
 *    replaces that with fingerprint + UPSERT precisely so rows SURVIVE, after
 *    which a row created in August and refreshed in October still reads August.
 *    The marker would silently go stale and the cold-start bug would return.
 *  - MAX(updated_at) fails for an independent reason: a run producing ZERO
 *    insights has no row to touch. generateInsights explicitly supports that
 *    case, because the marker tracks RUNS, not rows.
 *
 * "advances even when no insight row is written" below is the seam test: it pins
 * the marker's meaning under UPSERT semantics and must still pass, unchanged,
 * after hp-10 lands.
 */

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createSupabaseMock, type QueryResult } from '@/test-utils/supabaseChain';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));

const USER = 'user-hp8';

/** The `user_profiles.insights_last_generated_at` read. */
const profileRow = (lastGeneratedAt: string | null, error: unknown = null): QueryResult => ({
  data: error ? null : { insights_last_generated_at: lastGeneratedAt },
  error,
});

/** The transactions-since-the-marker count. */
const txCount = (count: number): QueryResult => ({ data: null, count, error: null });

/*
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. shouldTriggerGeneration
 * calls createClient() TWICE - the marker read, then the count - and each used
 * to get its own hand-rolled chain via `mockResolvedValueOnce`, which is what
 * produced the `...Once` leak described below. ONE factory client now answers
 * both tables, set with `mockResolvedValue` (not Once), so a scenario that
 * short-circuits after the marker read leaves nothing queued for the next test.
 * The resetAllMocks below stays: still correct, now merely redundant for that
 * particular leak.
 */
function userDb(tables: Record<string, QueryResult>) {
  const db = createSupabaseMock({ tables });
  (createClient as jest.Mock).mockResolvedValue(db.client);
  return db;
}

/** The service-role client markGenerated writes through. */
function adminDb(update: QueryResult = { data: null, error: null }) {
  const db = createSupabaseMock({ tables: { user_profiles: update } });
  (createServiceRoleClient as jest.Mock).mockReturnValue(db.client);
  return db;
}

// resetAllMocks, not clearAllMocks. `clearAllMocks` resets recorded CALLS and
// leaves the queued `...Once` values in place, and several tests here queue TWO:
//
//   (createClient as jest.Mock)
//     .mockResolvedValueOnce({ from: profile.from })
//     .mockResolvedValueOnce({ from: counter.from });
//
// A scenario that short-circuits after reading the marker never makes the second
// call, so `{ from: counter.from }` stays queued and is served to the NEXT test.
// The counter chain is `from -> select -> eq -> gte` with no `maybeSingle`, which
// is exactly the failure:
//
//   TypeError: supabase.from(...).select(...).eq(...).maybeSingle is not a function
//
// resetAllMocks is safe HERE specifically because the module factory supplies no
// implementations of its own — `createClient: jest.fn()` with nothing attached —
// so there is nothing for the reset to destroy. In a file whose `jest.mock()`
// factory provides behaviour, resetAllMocks would remove it and break every test;
// that is the usual reason not to reach for it.
//
// Same mechanism as exchangeRateService, which is the FIRST repeated cause in
// this batch: an unconsumed `...Once` queue crossing the clearAllMocks boundary.
beforeEach(() => jest.resetAllMocks());

/**
 * "Recent" as a RELATIVE value, because the assertions below depend on it.
 *
 * These fixtures used to hardcode 2026-08-20, which meant "recent" on the day
 * they were written and means "four weeks ago" now. That was harmless while
 * `shouldTriggerGeneration` looked only at the transaction COUNT — the date was
 * inert. The staleness condition made it load-bearing, and the fixture
 * immediately contradicted the test name it sat under: a marker that old IS
 * stale, so "does NOT regenerate when the marker is recent" started failing for
 * the honest reason that the marker was no longer recent.
 *
 * A fixture that encodes "recent" as an absolute date decays into its opposite.
 */
const RECENTLY = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe('shouldTriggerGeneration — the cold-start bug', () => {
  it('does NOT regenerate when the marker is recent and few transactions followed', async () => {
    const recent = RECENTLY();
    // THE BUG: on a cold start this returned true for everyone, because the Map
    // was empty. With a durable marker the same request answers correctly.
    const db = userDb({ user_profiles: profileRow(recent), transactions: txCount(3) });

    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');
    await expect(shouldTriggerGeneration(USER)).resolves.toBe(false);

    // Filter args asserted, not just call counts: an arg-blind chain mock lets
    // the user scoping vanish silently, which has bitten this repo repeatedly.
    expect(db.from).toHaveBeenCalledWith('user_profiles');
    expect(db.callsTo('user_profiles', 'eq')).toContainEqual(['id', USER]);
    expect(db.from).toHaveBeenCalledWith('transactions');
    expect(db.callsTo('transactions', 'eq')).toContainEqual(['user_id', USER]);
    expect(db.callsTo('transactions', 'gte')).toContainEqual(['created_at', recent]);
  });

  it('regenerates once the 10-transaction threshold is crossed', async () => {
    const recent = RECENTLY();
    userDb({ user_profiles: profileRow(recent), transactions: txCount(10) });

    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');
    await expect(shouldTriggerGeneration(USER)).resolves.toBe(true);
  });

  it('treats a NULL marker as never generated', async () => {
    // Still the right answer — the bug was that a cold start made every user
    // look like this one, not that this answer was wrong.
    userDb({ user_profiles: profileRow(null) });

    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');
    await expect(shouldTriggerGeneration(USER)).resolves.toBe(true);
  });

  it('degrades to pre-hp-8 behaviour ONLY for a missing column (42703)', async () => {
    // The migration lands on merge and Vercel deploys on the same merge, in no
    // guaranteed order — so there is a window where this column does not exist.
    // Throwing there would 500 the insights refresh for the length of it.
    userDb({
      user_profiles: profileRow(null, { code: '42703', message: 'column does not exist' }),
      transactions: txCount(0),
    });

    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');
    await expect(shouldTriggerGeneration(USER)).resolves.toBe(true);
  });

  it('THROWS on a marker read failure instead of guessing', async () => {
    // Degradation policy: a failed CORE input is a 500. Answering "never
    // generated" here would regenerate for every user on every write — the
    // original bug wearing a different hat.
    userDb({ user_profiles: profileRow(null, { message: 'connection reset' }) });

    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');
    await expect(shouldTriggerGeneration(USER)).rejects.toBeTruthy();
  });
});

describe('the marker survives hp-10 (UPSERT semantics)', () => {
  it('advances even when no insight row is written', async () => {
    // THE SEAM TEST. After hp-10, generation upserts and rows SURVIVE, so no
    // row's created_at changes on a refresh — and a run can legitimately write
    // no rows at all. The marker must still move, because it records that
    // generation RAN.
    //
    // It is written against the marker, not against insight rows, so it holds
    // before and after hp-10 WITHOUT MODIFICATION.
    //
    // READ THIS BEFORE "UPDATING THE TEST FOR THE NEW BEHAVIOUR".
    // If you have arrived here because this test went red while working on
    // insight generation, the correct response is almost certainly NOT to adjust
    // the assertion. This test needing to change IS the alarm: it means the
    // marker has been re-coupled to the lifetime of insight ROWS, and the moment
    // that happens the cold-start bug returns — silently, because a stale marker
    // produces no error, just an ever-growing "transactions since" count that
    // clears the gate on every write.
    //
    // The marker records that generation RAN. Rows record what it produced.
    // Those are different facts and this test is where that distinction lives.
    const admin = adminDb();

    const before = Date.now();
    const { markGeneratedForTest } = await import('@/lib/services/insightService');
    await markGeneratedForTest(USER);

    expect(admin.from).toHaveBeenCalledWith('user_profiles');
    const [patch] = admin.callsTo('user_profiles', 'update')[0] as [
      { insights_last_generated_at: string },
    ];
    const written = new Date(patch.insights_last_generated_at).getTime();

    expect(Number.isNaN(written)).toBe(false);
    expect(written).toBeGreaterThanOrEqual(before);
  });

  it('is written with the SERVICE ROLE, because the column is not user-writable', async () => {
    // The column has UPDATE revoked from `authenticated`. If this ever switched
    // to the user client the write would fail in production while still passing
    // a mock-based test, so the client identity is asserted here.
    adminDb();

    const { markGeneratedForTest } = await import('@/lib/services/insightService');
    await markGeneratedForTest(USER);

    expect(createServiceRoleClient).toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does not throw when the marker write fails — the generation still succeeded', async () => {
    adminDb({ data: null, error: { message: 'permission denied' } });

    const { markGeneratedForTest } = await import('@/lib/services/insightService');
    await expect(markGeneratedForTest(USER)).resolves.toBeUndefined();
  });
});
