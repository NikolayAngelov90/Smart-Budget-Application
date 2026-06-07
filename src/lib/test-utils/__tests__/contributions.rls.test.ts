/**
 * @jest-environment node
 *
 * Contribution splits RLS tests — Story 13.7.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 * Proves:
 *   - household_contributions returns per-member contributed sums (incl. category_only),
 *     membership-gated; an outsider gets nothing.
 *   - a member cannot change another member's contribution_percentage (no UPDATE policy).
 *   - category_only spend counts toward the aggregate, yet its rows stay invisible (13.4).
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
const aEmail = `rls-contrib-a-${stamp}@example.test`;
const bEmail = `rls-contrib-b-${stamp}@example.test`;
const outEmail = `rls-contrib-out-${stamp}@example.test`;

rlsDescribe('Contribution splits (Story 13.7)', () => {
  let aId: string;
  let bId: string;
  let outId: string;
  let householdId: string;
  let sharedCatId: string;
  let catOnlyId: string;
  let catOnlyTxId: string;

  beforeAll(async () => {
    const svc = createServiceClient();
    aId = await createTestUser(aEmail, PWD);
    bId = await createTestUser(bEmail, PWD);
    outId = await createTestUser(outEmail, PWD);

    const { data: h } = await svc
      .from('households')
      .insert({ name: 'Contrib HH', created_by: aId })
      .select('id')
      .single();
    householdId = h!.id;
    await svc.from('household_members').insert([
      { household_id: householdId, user_id: aId, role: 'admin', contribution_percentage: 60 },
      { household_id: householdId, user_id: bId, role: 'member', contribution_percentage: 40 },
    ]);

    // Shared category — A spends 100.
    const { data: sc } = await svc
      .from('categories')
      .insert({ user_id: aId, name: 'Contrib Shared', color: '#abcdef', type: 'expense', household_id: householdId, visibility_level: 'shared' })
      .select('id')
      .single();
    sharedCatId = sc!.id;
    await svc.from('transactions').insert({
      user_id: aId, category_id: sharedCatId, amount: 100, type: 'expense', date: '2026-06-05', currency: 'EUR', household_id: householdId,
    });

    // category_only category owned by B — B spends 50 (rows hidden from A, but counts).
    const { data: co } = await svc
      .from('categories')
      .insert({ user_id: bId, name: 'Contrib CatOnly', color: '#123abc', type: 'expense', household_id: householdId, visibility_level: 'category_only' })
      .select('id')
      .single();
    catOnlyId = co!.id;
    const { data: coTx } = await svc.from('transactions').insert({
      user_id: bId, category_id: catOnlyId, amount: 50, type: 'expense', date: '2026-06-05', currency: 'EUR', household_id: householdId,
    }).select('id').single();
    catOnlyTxId = coTx!.id;
  });

  afterAll(async () => {
    if (aId) await deleteTestUser(aId);
    if (bId) await deleteTestUser(bId);
    if (outId) await deleteTestUser(outId);
  });

  it('returns per-member contributed sums to a member', async () => {
    const a = await signInAsTestUser(aEmail, PWD);
    const { data } = await a.rpc('household_contributions', { p_household_id: householdId });
    const byUser = Object.fromEntries((data ?? []).map((r: { user_id: string; contributed: number; contribution_percentage: number }) => [r.user_id, r]));
    expect(Number(byUser[aId].contributed)).toBe(100);
    expect(Number(byUser[bId].contributed)).toBe(50); // category_only spend included in the aggregate
    expect(Number(byUser[aId].contribution_percentage)).toBe(60);
    expect(Number(byUser[bId].contribution_percentage)).toBe(40);
  });

  it('an outsider gets no contributions', async () => {
    const out = await signInAsTestUser(outEmail, PWD);
    const { data } = await out.rpc('household_contributions', { p_household_id: householdId });
    expect(data ?? []).toEqual([]);
  });

  it('B’s category_only transaction rows remain invisible to A (13.4 still holds)', async () => {
    const a = await signInAsTestUser(aEmail, PWD);
    const { data } = await a.from('transactions').select('id').eq('id', catOnlyTxId);
    expect(data ?? []).toEqual([]);
  });

  it('a member CANNOT change another member’s percentage (no UPDATE policy)', async () => {
    const a = await signInAsTestUser(aEmail, PWD);
    await a.from('household_members').update({ contribution_percentage: 99 }).eq('user_id', bId);
    const svc = createServiceClient();
    const { data } = await svc.from('household_members').select('contribution_percentage').eq('user_id', bId).single();
    expect(Number(data?.contribution_percentage)).toBe(40); // unchanged
  });
});
