/**
 * @jest-environment node
 *
 * Household RLS isolation tests — Story 13.1 (PREP-1 harness).
 *
 * Runs in the `node` environment so Node's global `fetch` is available for the
 * real Supabase network calls (jsdom does not expose fetch). The harness imports
 * the raw supabase-js client, unaffected by jest.setup.js's mock of @/lib/supabase/server.
 *
 * Real-database tests (NFR10/NFR11): they assert what the DATABASE returns to each
 * authenticated user, never what a service computed. Env-gated via `rlsDescribe` —
 * skipped unless RLS_TEST_* is set (so `npm test` stays green). Run for real with:
 *   npx supabase start && npm run test:rls
 *
 * Covers the foundation of the transparency matrix expanded in later Epic 13 stories:
 *   member-can-read · other-household-cannot-read · non-admin-cannot-mutate · creator-is-admin.
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
const a1Email = `rls-h-a1-${stamp}@example.test`;
const a2Email = `rls-h-a2-${stamp}@example.test`;
const b1Email = `rls-h-b1-${stamp}@example.test`;

rlsDescribe('Household isolation (Story 13.1)', () => {
  let a1Id: string;
  let a2Id: string;
  let b1Id: string;
  let householdAId: string;
  let householdBId: string;

  beforeAll(async () => {
    const svc = createServiceClient();
    a1Id = await createTestUser(a1Email, PWD);
    a2Id = await createTestUser(a2Email, PWD);
    b1Id = await createTestUser(b1Email, PWD);

    // Household A: a1 (admin) + a2 (member). Household B: b1 (admin).
    const { data: hA } = await svc
      .from('households')
      .insert({ name: 'Household A', created_by: a1Id })
      .select('id')
      .single();
    householdAId = hA!.id;
    await svc.from('household_members').insert([
      { household_id: householdAId, user_id: a1Id, role: 'admin' },
      { household_id: householdAId, user_id: a2Id, role: 'member' },
    ]);

    const { data: hB } = await svc
      .from('households')
      .insert({ name: 'Household B', created_by: b1Id })
      .select('id')
      .single();
    householdBId = hB!.id;
    await svc
      .from('household_members')
      .insert({ household_id: householdBId, user_id: b1Id, role: 'admin' });
  });

  afterAll(async () => {
    // households.created_by → ON DELETE CASCADE removes households + members.
    if (a1Id) await deleteTestUser(a1Id);
    if (a2Id) await deleteTestUser(a2Id);
    if (b1Id) await deleteTestUser(b1Id);
  });

  it('member (a2) CAN read their own household', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const { data } = await a2.from('households').select('id').eq('id', householdAId);
    expect(data).toHaveLength(1);
  });

  it('outsider (b1) CANNOT read household A', async () => {
    const b1 = await signInAsTestUser(b1Email, PWD);
    const { data } = await b1.from('households').select('id').eq('id', householdAId);
    expect(data).toEqual([]);
  });

  it('member (a2) CAN read household A members; outsider (b1) CANNOT', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const a2View = await a2.from('household_members').select('user_id').eq('household_id', householdAId);
    expect((a2View.data ?? []).length).toBeGreaterThanOrEqual(2);

    const b1 = await signInAsTestUser(b1Email, PWD);
    const b1View = await b1.from('household_members').select('user_id').eq('household_id', householdAId);
    expect(b1View.data).toEqual([]);
  });

  it('creator (a1) is admin', async () => {
    const a1 = await signInAsTestUser(a1Email, PWD);
    const { data } = await a1
      .from('household_members')
      .select('role')
      .eq('household_id', householdAId)
      .eq('user_id', a1Id)
      .single();
    expect(data?.role).toBe('admin');
  });

  it('non-admin member (a2) CANNOT rename the household (RLS blocks UPDATE)', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    await a2.from('households').update({ name: 'Hijacked' }).eq('id', householdAId);
    // Verify via service client that the name is unchanged.
    const svc = createServiceClient();
    const { data } = await svc.from('households').select('name').eq('id', householdAId).single();
    expect(data?.name).toBe('Household A');
  });

  it('non-admin member (a2) CANNOT delete the household (RLS blocks DELETE)', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    await a2.from('households').delete().eq('id', householdAId);
    const svc = createServiceClient();
    const { data } = await svc.from('households').select('id').eq('id', householdAId);
    expect(data).toHaveLength(1); // still there
  });

  // Regression for review finding HIGH-1: no anon INSERT policy on household_members,
  // so an outsider cannot self-join another household (cross-household breach).
  it('outsider (b1) CANNOT insert themselves into household A', async () => {
    const b1 = await signInAsTestUser(b1Email, PWD);
    const { error } = await b1
      .from('household_members')
      .insert({ household_id: householdAId, user_id: b1Id, role: 'admin' });
    expect(error).not.toBeNull(); // RLS denies the insert

    // And no stray membership row was created.
    const svc = createServiceClient();
    const { data } = await svc
      .from('household_members')
      .select('id')
      .eq('household_id', householdAId)
      .eq('user_id', b1Id);
    expect(data).toEqual([]);
  });
});
