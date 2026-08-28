/**
 * @jest-environment node
 *
 * hp-10 — the upsert round-trip, against a real Postgres.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 *
 * WHY THIS SUITE EXISTS AND JEST CANNOT REPLACE IT
 *
 * Every other hp-10 test runs against a chain mock, which has no Postgres in it.
 * A mock accepts any `onConflict` string, never fires a trigger, and never
 * enforces a unique index — so it is structurally incapable of catching the two
 * defects that nearly shipped:
 *
 *   1. `updated_at` has DEFAULT NOW(), which applies on INSERT ONLY. Without a
 *      BEFORE UPDATE trigger it never advances on an upsert, every pre-existing
 *      insight stays at or below the sweep watermark, and the sweep deletes all
 *      of them on every run — the original bug with extra steps.
 *   2. A PARTIAL unique index is not inferred by a bare
 *      `ON CONFLICT (user_id, fingerprint)`. It raises 42P10 on the first real
 *      generation while every mock-based test stays green.
 *
 * Both are invisible to jest and obvious to Postgres. This is the test that
 * would have caught them, and it is the only kind that can.
 */

import {
  rlsDescribe,
  createServiceClient,
  createTestUser,
  deleteTestUser,
} from '@/lib/test-utils/rlsClient';

const PWD = 'rls-test-passw0rd!';
const stamp = Date.now();
const email = `rls-upsert-${stamp}@example.test`;
const FINGERPRINT = `unusual_expense:tx:${stamp}`;

const baseRow = (userId: string) => ({
  user_id: userId,
  type: 'unusual_expense' as const,
  fingerprint: FINGERPRINT,
  title: 'Unusual Shopping expense',
  description: 'first write',
  priority: 5,
  metadata: { category_name: 'Shopping', transaction_amount: 300 },
});

rlsDescribe('insight upsert preserves dismissal (hp-10)', () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createTestUser(email, PWD);
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it('an upsert on the same fingerprint keeps is_dismissed AND advances updated_at', async () => {
    const svc = createServiceClient();

    // 1. First generation writes the row.
    const { error: insertError } = await svc.from('insights').upsert(baseRow(userId), {
      onConflict: 'user_id,fingerprint',
    });
    expect(insertError).toBeNull();

    const { data: firstRows } = await svc
      .from('insights')
      .select('id, updated_at, is_dismissed')
      .eq('user_id', userId);
    expect(firstRows).toHaveLength(1);
    const first = firstRows![0] as { id: string; updated_at: string; is_dismissed: boolean };

    // 2. The user dismisses it.
    await svc
      .from('insights')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('id', first.id);

    // Postgres timestamps have microsecond resolution, but two statements can
    // land inside the same one on a fast machine. A short wait makes the
    // updated_at assertion below meaningful rather than flaky-in-the-lenient-
    // direction.
    await new Promise((r) => setTimeout(r, 1100));

    // 3. The next generation produces the same claim.
    const { error: upsertError } = await svc.from('insights').upsert(
      { ...baseRow(userId), description: 'second write, refreshed content' },
      { onConflict: 'user_id,fingerprint' }
    );
    // A 42P10 here means the unique index is partial and was not inferred.
    expect(upsertError).toBeNull();

    const { data: afterRows } = await svc
      .from('insights')
      .select('id, description, is_dismissed, updated_at, created_at')
      .eq('user_id', userId);

    // NO SECOND ROW. A fingerprint that is too fine leaves the dismissed row
    // alone and inserts a fresh one beside it, which looks identical to the user
    // and would pass a naive "is it still dismissed" assertion.
    expect(afterRows).toHaveLength(1);

    const after = afterRows![0] as {
      id: string;
      description: string;
      is_dismissed: boolean;
      updated_at: string;
      created_at: string;
    };

    // Same row, not a replacement.
    expect(after.id).toBe(first.id);
    // THE POINT OF THE STORY: the dismissal survived regeneration.
    expect(after.is_dismissed).toBe(true);
    // Content was refreshed, so the upsert is doing its job.
    expect(after.description).toBe('second write, refreshed content');
    // And the trigger advanced the timestamp. Without it, the sweep would delete
    // this row on the very next run.
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(
      new Date(first.updated_at).getTime()
    );
  });

  it('the sweep predicate spares a dismissed row and removes a stale one', async () => {
    // This is the assertion that distinguishes "we fixed dismissal" from "we
    // broke expiry to fix dismissal". Both rows are older than the watermark and
    // neither is in the keep-set; only the undismissed one may go.
    const svc = createServiceClient();
    const staleFingerprint = `spending_anomaly:cat:${stamp}:2026-01`;

    await svc.from('insights').upsert(
      {
        ...baseRow(userId),
        fingerprint: staleFingerprint,
        type: 'spending_anomaly' as const,
        description: 'stale, no longer produced',
      },
      { onConflict: 'user_id,fingerprint' }
    );

    const { data: watermarkRow } = await svc
      .from('insights')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const cutoff = (watermarkRow as { updated_at: string }).updated_at;

    // The sweep as the service runs it: nothing in the keep-set, so every
    // undismissed row at or below the watermark goes.
    const { error: sweepError } = await svc
      .from('insights')
      .delete()
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .lte('updated_at', cutoff);
    expect(sweepError).toBeNull();

    const { data: survivors } = await svc
      .from('insights')
      .select('fingerprint, is_dismissed')
      .eq('user_id', userId);

    const rows = (survivors ?? []) as Array<{ fingerprint: string; is_dismissed: boolean }>;
    // The dismissed one survived…
    expect(rows.map((r) => r.fingerprint)).toContain(FINGERPRINT);
    // …and the stale one did not.
    expect(rows.map((r) => r.fingerprint)).not.toContain(staleFingerprint);
  });

  it('rejects a row with no fingerprint', async () => {
    // NOT NULL is what lets the unique index be total, which is what lets
    // ON CONFLICT infer it. If this ever succeeds, the index can silently become
    // uninferrable again.
    const svc = createServiceClient();
    const { error } = await svc.from('insights').insert({
      user_id: userId,
      type: 'positive_reinforcement',
      title: 'no identity',
      description: 'should not be storable',
      priority: 2,
    } as never);

    expect(error).not.toBeNull();
    expect(error?.code).toBe('23502'); // not_null_violation
  });
});
