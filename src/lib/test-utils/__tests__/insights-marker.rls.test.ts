/**
 * @jest-environment node
 *
 * hp-8 — `user_profiles.insights_last_generated_at` must not be user-writable.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 *
 * WHY THIS IS A SECURITY TEST AND NOT A TIDINESS ONE
 *
 * `user_profiles` carries a full owner UPDATE policy (`auth.uid() = id`), so a
 * column added there is PATCHable by its owner through PostgREST unless column
 * privileges say otherwise. This particular column gates insight generation:
 *
 *   - set it to a FUTURE date and generation is suppressed indefinitely;
 *   - set it to the EPOCH and every transaction POST clears the 10-transaction
 *     gate, so each write triggers a full regeneration — every category query,
 *     every engine, and a delete+insert write path.
 *
 * The second is not a foot-gun. It is a user-controllable amplifier against
 * shared infrastructure, which is why the REVOKE is a control rather than a
 * nicety, and why it does not ship on reasoning alone.
 *
 * NOTE ON PRIVILEGES vs POLICIES: RLS policies and column GRANTs are checked
 * independently, and both must pass. The policy still permits the row; the
 * column privilege is what stops this write. Postgres reports the refusal as
 * error 42501 (insufficient_privilege), surfaced by PostgREST as 403.
 *
 * GRANTS ARE ADDITIVE. A later `GRANT UPDATE ON user_profiles TO authenticated`
 * silently restores write access to this column. That is precisely what this
 * test exists to catch, because nothing else would.
 */

import {
  rlsDescribe,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  signInAsTestUser,
} from '@/lib/test-utils/rlsClient';

const PWD = 'rls-test-passw0rd!';
const stamp = Date.now();
const email = `rls-marker-${stamp}@example.test`;

rlsDescribe('insights_last_generated_at is server-only (hp-8)', () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createTestUser(email, PWD);
    // The signup trigger creates the profile row; make sure it exists either way.
    const svc = createServiceClient();
    await svc.from('user_profiles').upsert({ id: userId }, { onConflict: 'id' });
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it('the owner CAN read the marker', async () => {
    // SELECT is deliberately left granted — the value is not secret, and a
    // client may want to show "last refreshed". Only writing is restricted, so
    // a failure here would mean the migration revoked too much.
    const user = await signInAsTestUser(email, PWD);
    const { data, error } = await user
      .from('user_profiles')
      .select('insights_last_generated_at')
      .eq('id', userId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('the owner CANNOT write the marker', async () => {
    const user = await signInAsTestUser(email, PWD);
    const { error } = await user
      .from('user_profiles')
      .update({ insights_last_generated_at: new Date(0).toISOString() })
      .eq('id', userId);

    // 42501 = insufficient_privilege. Asserting the CODE, not merely that some
    // error occurred: a typo'd column name also errors, and would let this pass
    // while the privilege was wide open.
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('the write is genuinely rejected, not silently dropped', async () => {
    // PostgREST can return success while filtering an unprivileged column out of
    // the payload. Read the value back through the service role to prove nothing
    // landed, rather than trusting the error alone.
    const svc = createServiceClient();
    await svc
      .from('user_profiles')
      .update({ insights_last_generated_at: null })
      .eq('id', userId);

    const user = await signInAsTestUser(email, PWD);
    await user
      .from('user_profiles')
      .update({ insights_last_generated_at: new Date(0).toISOString() })
      .eq('id', userId);

    const { data } = await svc
      .from('user_profiles')
      .select('insights_last_generated_at')
      .eq('id', userId)
      .maybeSingle();

    expect((data as { insights_last_generated_at: string | null } | null)?.insights_last_generated_at).toBeNull();
  });

  it('a user CANNOT grant themselves analytics_viewer', async () => {
    // PRE-EXISTING PRIVILEGE ESCALATION, found by this suite rather than
    // reasoned about. `analytics_viewer` is an access-control flag — the
    // analytics dashboard reads it server-side and 403s without it — and it sits
    // on a table that granted table-wide UPDATE to `authenticated`. Any user
    // could PATCH it onto their own row and let themselves in.
    //
    // It is fixed by the same statement as the hp-8 marker, because it is the
    // same root cause: a table-level grant covering every column.
    const svc = createServiceClient();
    const user = await signInAsTestUser(email, PWD);

    const { error } = await user
      .from('user_profiles')
      .update({ analytics_viewer: true })
      .eq('id', userId);

    expect(error?.code).toBe('42501');

    const { data } = await svc
      .from('user_profiles')
      .select('analytics_viewer')
      .eq('id', userId)
      .maybeSingle();

    expect((data as { analytics_viewer: boolean | null } | null)?.analytics_viewer).not.toBe(true);
  });

  it('the columns a user SHOULD be able to write still work', async () => {
    // The mirror of every REVOKE above. Narrowing the grant too far would break
    // the profile screen silently in production while every negative assertion
    // above still passed.
    const user = await signInAsTestUser(email, PWD);

    const { error } = await user
      .from('user_profiles')
      .update({ display_name: 'Renamed By Owner' })
      .eq('id', userId);

    expect(error).toBeNull();

    const { data } = await user
      .from('user_profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();

    expect((data as { display_name: string }).display_name).toBe('Renamed By Owner');
  });

  it('the SERVICE ROLE can write it — the app path still works', async () => {
    // The mirror of the above. If the REVOKE were written too broadly (e.g.
    // FROM PUBLIC), generation itself would stop recording, and hp-8 would fail
    // closed with no test noticing.
    const svc = createServiceClient();
    const when = new Date('2026-08-26T12:00:00Z').toISOString();

    const { error } = await svc
      .from('user_profiles')
      .update({ insights_last_generated_at: when })
      .eq('id', userId);

    expect(error).toBeNull();

    const { data } = await svc
      .from('user_profiles')
      .select('insights_last_generated_at')
      .eq('id', userId)
      .maybeSingle();

    expect(
      new Date(
        (data as { insights_last_generated_at: string }).insights_last_generated_at
      ).toISOString()
    ).toBe(when);
  });
});
