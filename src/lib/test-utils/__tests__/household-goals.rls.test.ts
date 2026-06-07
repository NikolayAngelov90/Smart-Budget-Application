/**
 * @jest-environment node
 *
 * Shared household savings goals RLS tests — Story 13.9.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 * Proves: members can read shared goals (dual-path SELECT); outsiders can't; the per-member
 * breakdown RPC is membership-gated and returns per-member sums; personal goals stay private.
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
const aEmail = `rls-hg-a-${stamp}@example.test`;
const bEmail = `rls-hg-b-${stamp}@example.test`;
const outEmail = `rls-hg-out-${stamp}@example.test`;

rlsDescribe('Shared household goals (Story 13.9)', () => {
  let aId: string;
  let bId: string;
  let outId: string;
  let householdId: string;
  let sharedGoalId: string;
  let personalGoalId: string;

  beforeAll(async () => {
    const svc = createServiceClient();
    aId = await createTestUser(aEmail, PWD);
    bId = await createTestUser(bEmail, PWD);
    outId = await createTestUser(outEmail, PWD);

    const { data: h } = await svc.from('households').insert({ name: 'Goals HH', created_by: aId }).select('id').single();
    householdId = h!.id;
    await svc.from('household_members').insert([
      { household_id: householdId, user_id: aId, role: 'admin' },
      { household_id: householdId, user_id: bId, role: 'member' },
    ]);

    // Shared goal owned by A, with contributions from A (100) and B (50).
    const { data: sg } = await svc
      .from('goals')
      .insert({ user_id: aId, household_id: householdId, name: 'Vacation', target_amount: 1000, current_amount: 150 })
      .select('id')
      .single();
    sharedGoalId = sg!.id;
    await svc.from('goal_contributions').insert([
      { goal_id: sharedGoalId, user_id: aId, amount: 100 },
      { goal_id: sharedGoalId, user_id: bId, amount: 50 },
    ]);

    // A personal goal (household_id NULL) — must stay private to A.
    const { data: pg } = await svc
      .from('goals')
      .insert({ user_id: aId, name: 'Secret', target_amount: 500 })
      .select('id')
      .single();
    personalGoalId = pg!.id;
  });

  afterAll(async () => {
    if (aId) await deleteTestUser(aId);
    if (bId) await deleteTestUser(bId);
    if (outId) await deleteTestUser(outId);
  });

  it('a member can read the shared goal', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    const { data } = await b.from('goals').select('id').eq('id', sharedGoalId);
    expect((data ?? []).map((r) => r.id)).toContain(sharedGoalId);
  });

  it('a member CANNOT read another member’s personal goal', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    const { data } = await b.from('goals').select('id').eq('id', personalGoalId);
    expect(data ?? []).toEqual([]);
  });

  it('an outsider cannot read the shared goal', async () => {
    const out = await signInAsTestUser(outEmail, PWD);
    const { data } = await out.from('goals').select('id').eq('id', sharedGoalId);
    expect(data ?? []).toEqual([]);
  });

  it('household_goal_breakdown returns per-member sums to a member', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    const { data } = await b.rpc('household_goal_breakdown', { p_goal_id: sharedGoalId });
    const byUser = Object.fromEntries((data ?? []).map((r: { user_id: string; contributed: number }) => [r.user_id, Number(r.contributed)]));
    expect(byUser[aId]).toBe(100);
    expect(byUser[bId]).toBe(50);
  });

  it('household_goal_breakdown returns nothing to an outsider', async () => {
    const out = await signInAsTestUser(outEmail, PWD);
    const { data } = await out.rpc('household_goal_breakdown', { p_goal_id: sharedGoalId });
    expect(data ?? []).toEqual([]);
  });
});
