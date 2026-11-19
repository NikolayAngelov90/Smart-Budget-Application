/**
 * @jest-environment node
 *
 * Member removal & access revocation RLS tests — Story 13.11.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 * Proves that deleting the household_members row immediately revokes ALL shared access
 * (the ex-member fails every is_household_member gate), while personal data and shared
 * history are preserved.
 *
 * The removal runs through the REAL householdMemberService.removeMember (the app's
 * service-role client pinned to the local stack). Until 2026-11-19 this file
 * mirrored the service's writes by hand, and the mirror outlived them: the service
 * moved to reassign_member_shared_objects and this test kept testing an UPDATE the
 * service no longer performed.
 */

import {
  rlsDescribe,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  signInAsTestUser,
  pinAppServiceRoleToLocalStack,
  assertAppPinnedToLocalStack,
} from '@/lib/test-utils/rlsClient';
import { removeMember } from '@/lib/services/householdMemberService';

const PWD = 'rls-test-passw0rd!';
const stamp = Date.now();
const aEmail = `rls-rm-a-${stamp}@example.test`; // admin
const bEmail = `rls-rm-b-${stamp}@example.test`; // member to be removed

rlsDescribe('Member removal & access revocation (Story 13.11)', () => {
  let aId: string;
  let bId: string;
  let householdId: string;
  let sharedCatId: string;
  let sharedTxId: string;
  let bPersonalCatId: string;
  let bSharedCatId: string; // a SHARED category B created (reassigned to admin on removal)
  let bSharedGoalId: string; // a SHARED goal B created (reassigned likewise)
  let bSharedBudgetId: string; // a SHARED budget B created (reassigned likewise)
  let restoreEnv: () => void = () => {};

  beforeAll(async () => {
    restoreEnv = pinAppServiceRoleToLocalStack();
    const svc = createServiceClient();
    aId = await createTestUser(aEmail, PWD);
    bId = await createTestUser(bEmail, PWD);

    const { data: h } = await svc
      .from('households')
      .insert({ name: 'Removal HH', created_by: aId })
      .select('id')
      .single();
    householdId = h!.id;
    await svc.from('household_members').insert([
      { household_id: householdId, user_id: aId, role: 'admin' },
      { household_id: householdId, user_id: bId, role: 'member' },
    ]);

    const { data: sc } = await svc
      .from('categories')
      .insert({
        user_id: aId,
        name: 'Groceries',
        color: '#abcdef',
        type: 'expense',
        household_id: householdId,
        visibility_level: 'shared',
      })
      .select('id')
      .single();
    sharedCatId = sc!.id;
    const { data: tx } = await svc
      .from('transactions')
      .insert({
        user_id: aId,
        category_id: sharedCatId,
        amount: 100,
        type: 'expense',
        date: '2026-06-10',
        currency: 'EUR',
        household_id: householdId,
      })
      .select('id')
      .single();
    sharedTxId = tx!.id;

    // B's personal category (household_id NULL) — must survive removal.
    const { data: pc } = await svc
      .from('categories')
      .insert({ user_id: bId, name: 'B Personal', color: '#123456', type: 'expense' })
      .select('id')
      .single();
    bPersonalCatId = pc!.id;

    // A SHARED category B created — on removal it must be reassigned to the admin so B
    // loses owner-branch read/write, while it stays in the household.
    const { data: bsc } = await svc
      .from('categories')
      .insert({
        user_id: bId,
        name: 'B Shared',
        color: '#654321',
        type: 'expense',
        household_id: householdId,
        visibility_level: 'shared',
      })
      .select('id')
      .single();
    bSharedCatId = bsc!.id;

    const { data: bg, error: bgError } = await svc
      .from('goals')
      .insert({ user_id: bId, name: 'B Shared Goal', target_amount: 500, household_id: householdId })
      .select('id')
      .single();
    if (bgError || !bg) throw new Error(`seed B's shared goal: ${bgError?.message}`);
    bSharedGoalId = bg.id;
    const { data: bb, error: bbError } = await svc
      .from('category_budgets')
      .insert({
        user_id: bId,
        household_id: householdId,
        category_id: bSharedCatId,
        period: 'monthly',
        limit_amount: 120,
      })
      .select('id')
      .single();
    if (bbError || !bb) throw new Error(`seed B's shared budget: ${bbError?.message}`);
    bSharedBudgetId = bb.id;
  });

  afterAll(async () => {
    try {
      if (aId) await deleteTestUser(aId);
      if (bId) await deleteTestUser(bId);
    } finally {
      restoreEnv();
    }
  });

  it('while a member, B can see the shared category + transaction', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    expect((await b.from('categories').select('id').eq('id', sharedCatId)).data).toHaveLength(1);
    expect((await b.from('transactions').select('id').eq('id', sharedTxId)).data).toHaveLength(1);
  });

  it('after removal, B loses access to ALL shared data + aggregates', async () => {
    // The REAL removal: reassign_member_shared_objects by named arguments through
    // PostgREST, then the membership delete - whatever the service does today.
    assertAppPinnedToLocalStack();
    await removeMember(aId, bId);

    const b = await signInAsTestUser(bEmail, PWD);
    expect((await b.from('households').select('id').eq('id', householdId)).data).toEqual([]);
    expect((await b.from('categories').select('id').eq('id', sharedCatId)).data).toEqual([]);
    expect((await b.from('transactions').select('id').eq('id', sharedTxId)).data).toEqual([]);
    // The shared category B created is now reassigned to the admin → B can't see/own it.
    expect((await b.from('categories').select('id').eq('id', bSharedCatId)).data).toEqual([]);
    expect(
      (await b.rpc('household_category_totals', { p_household_id: householdId })).data ?? []
    ).toEqual([]);
    expect(
      (await b.rpc('household_contributions', { p_household_id: householdId })).data ?? []
    ).toEqual([]);
    expect(
      (
        await b.rpc('household_category_period_totals', {
          p_household_id: householdId,
          p_start: '2026-06-01',
          p_end: '2026-07-01',
        })
      ).data ?? []
    ).toEqual([]);
  });

  it('B keeps their personal data (AC#2)', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    expect((await b.from('categories').select('id').eq('id', bPersonalCatId)).data).toHaveLength(1);
  });

  it('A (admin) still sees the shared category + transaction — history preserved (AC#3)', async () => {
    const a = await signInAsTestUser(aEmail, PWD);
    expect((await a.from('categories').select('id').eq('id', sharedCatId)).data).toHaveLength(1);
    expect((await a.from('transactions').select('id').eq('id', sharedTxId)).data).toHaveLength(1);
    // The reassigned shared category B created stays in the household, now owned by A.
    const svc = createServiceClient();
    const { data } = await svc
      .from('categories')
      .select('user_id, household_id')
      .eq('id', bSharedCatId)
      .single();
    expect(data?.user_id).toBe(aId);
    expect(data?.household_id).toBe(householdId);
    // ...and so are B's shared goal and shared budget (budgets were never moved
    // before the one shared definition).
    for (const [table, id] of [
      ['goals', bSharedGoalId],
      ['category_budgets', bSharedBudgetId],
    ] as const) {
      const { data: moved, error } = await svc
        .from(table)
        .select('user_id, household_id')
        .eq('id', id)
        .single();
      expect(error).toBeNull();
      expect(moved).toEqual({ user_id: aId, household_id: householdId });
    }
  });

  it('the admin cannot rewrite households.created_by (the owner is server-only) - but can still rename the household', async () => {
    const a = await signInAsTestUser(aEmail, PWD);
    // PAIRED: an admin update that SHOULD work does, so the refusal below is
    // about created_by, not about the admin being unable to update at all.
    const { data: renamed, error: renameError } = await a
      .from('households')
      .update({ name: 'Removal HH (renamed)' })
      .eq('id', householdId)
      .select('name');
    expect(renameError).toBeNull();
    expect(renamed).toEqual([{ name: 'Removal HH (renamed)' }]);

    const { error: ownerError } = await a
      .from('households')
      .update({ created_by: bId })
      .eq('id', householdId);
    expect(ownerError?.message).toContain('households.created_by can only be changed by the server');

    const svc = createServiceClient();
    const { data: h } = await svc.from('households').select('created_by').eq('id', householdId).single();
    expect(h?.created_by).toBe(aId);
  });
});
