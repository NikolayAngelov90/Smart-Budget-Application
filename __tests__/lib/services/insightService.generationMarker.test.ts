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

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));

const USER = 'user-hp8';

/** Reader for `user_profiles.insights_last_generated_at`, with arg capture. */
function profileReader(lastGeneratedAt: string | null, error: unknown = null) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: error ? null : { insights_last_generated_at: lastGeneratedAt },
    error,
  });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  return { from, select, eq, maybeSingle };
}

/** Counter for transactions since a timestamp, with arg capture. */
function transactionCounter(count: number) {
  const gte = jest.fn().mockResolvedValue({ count, error: null });
  const eq = jest.fn().mockReturnValue({ gte });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  return { from, select, eq, gte };
}

beforeEach(() => jest.clearAllMocks());

describe('shouldTriggerGeneration — the cold-start bug', () => {
  it('does NOT regenerate when the marker is recent and few transactions followed', async () => {
    // THE BUG: on a cold start this returned true for everyone, because the Map
    // was empty. With a durable marker the same request answers correctly.
    const profile = profileReader(new Date('2026-08-20T10:00:00Z').toISOString());
    const counter = transactionCounter(3);

    (createClient as jest.Mock)
      .mockResolvedValueOnce({ from: profile.from })
      .mockResolvedValueOnce({ from: counter.from });

    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');
    await expect(shouldTriggerGeneration(USER)).resolves.toBe(false);

    // Filter args asserted, not just call counts: an arg-blind chain mock lets
    // the user scoping vanish silently, which has bitten this repo repeatedly.
    expect(profile.from).toHaveBeenCalledWith('user_profiles');
    expect(profile.eq).toHaveBeenCalledWith('id', USER);
    expect(counter.from).toHaveBeenCalledWith('transactions');
    expect(counter.eq).toHaveBeenCalledWith('user_id', USER);
    expect(counter.gte).toHaveBeenCalledWith(
      'created_at',
      new Date('2026-08-20T10:00:00Z').toISOString()
    );
  });

  it('regenerates once the 10-transaction threshold is crossed', async () => {
    const profile = profileReader(new Date('2026-08-20T10:00:00Z').toISOString());
    const counter = transactionCounter(10);

    (createClient as jest.Mock)
      .mockResolvedValueOnce({ from: profile.from })
      .mockResolvedValueOnce({ from: counter.from });

    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');
    await expect(shouldTriggerGeneration(USER)).resolves.toBe(true);
  });

  it('treats a NULL marker as never generated', async () => {
    // Still the right answer — the bug was that a cold start made every user
    // look like this one, not that this answer was wrong.
    const profile = profileReader(null);
    (createClient as jest.Mock).mockResolvedValueOnce({ from: profile.from });

    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');
    await expect(shouldTriggerGeneration(USER)).resolves.toBe(true);
  });

  it('degrades to pre-hp-8 behaviour ONLY for a missing column (42703)', async () => {
    // The migration lands on merge and Vercel deploys on the same merge, in no
    // guaranteed order — so there is a window where this column does not exist.
    // Throwing there would 500 the insights refresh for the length of it.
    const profile = profileReader(null, { code: '42703', message: 'column does not exist' });
    const counter = transactionCounter(0);
    (createClient as jest.Mock)
      .mockResolvedValueOnce({ from: profile.from })
      .mockResolvedValueOnce({ from: counter.from });

    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');
    await expect(shouldTriggerGeneration(USER)).resolves.toBe(true);
  });

  it('THROWS on a marker read failure instead of guessing', async () => {
    // Degradation policy: a failed CORE input is a 500. Answering "never
    // generated" here would regenerate for every user on every write — the
    // original bug wearing a different hat.
    const profile = profileReader(null, { message: 'connection reset' });
    (createClient as jest.Mock).mockResolvedValueOnce({ from: profile.from });

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
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    const adminFrom = jest.fn().mockReturnValue({ update });
    (createServiceRoleClient as jest.Mock).mockReturnValue({ from: adminFrom });

    const before = Date.now();
    const { markGeneratedForTest } = await import('@/lib/services/insightService');
    await markGeneratedForTest(USER);

    expect(adminFrom).toHaveBeenCalledWith('user_profiles');
    const [patch] = update.mock.calls[0] as [{ insights_last_generated_at: string }];
    const written = new Date(patch.insights_last_generated_at).getTime();

    expect(Number.isNaN(written)).toBe(false);
    expect(written).toBeGreaterThanOrEqual(before);
  });

  it('is written with the SERVICE ROLE, because the column is not user-writable', async () => {
    // The column has UPDATE revoked from `authenticated`. If this ever switched
    // to the user client the write would fail in production while still passing
    // a mock-based test, so the client identity is asserted here.
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ update }),
    });

    const { markGeneratedForTest } = await import('@/lib/services/insightService');
    await markGeneratedForTest(USER);

    expect(createServiceRoleClient).toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does not throw when the marker write fails — the generation still succeeded', async () => {
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'permission denied' } }),
        }),
      }),
    });

    const { markGeneratedForTest } = await import('@/lib/services/insightService');
    await expect(markGeneratedForTest(USER)).resolves.toBeUndefined();
  });
});
