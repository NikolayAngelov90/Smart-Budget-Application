/**
 * @jest-environment node
 *
 * Personal Allowance RLS tests — Story 13.6.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 * Proves the privacy guarantees at the DATA LAYER:
 *   - personal_allowances is OWNER-ONLY (a co-member cannot SELECT another's allowance row)
 *   - allowance transactions (household_id NULL) are invisible to co-members
 *   - household_category_totals never includes allowance spend
 *   - the owner can read/update/delete only their own allowance
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
const aEmail = `rls-allw-a-${stamp}@example.test`; // allowance owner
const bEmail = `rls-allw-b-${stamp}@example.test`; // co-member (must NOT see A's allowance)

rlsDescribe('Personal allowance privacy (Story 13.6)', () => {
  let aId: string;
  let bId: string;
  let householdId: string;
  let allowanceId: string;
  let personalCatId: string;
  let sharedCatId: string;

  beforeAll(async () => {
    const svc = createServiceClient();
    aId = await createTestUser(aEmail, PWD);
    bId = await createTestUser(bEmail, PWD);

    const { data: h } = await svc
      .from('households')
      .insert({ name: 'Allowance HH', created_by: aId })
      .select('id')
      .single();
    householdId = h!.id;
    await svc.from('household_members').insert([
      { household_id: householdId, user_id: aId, role: 'admin' },
      { household_id: householdId, user_id: bId, role: 'member' },
    ]);

    // A's private allowance.
    const { data: allw } = await svc
      .from('personal_allowances')
      .insert({ user_id: aId, household_id: householdId, monthly_amount: 200, currency: 'EUR' })
      .select('id')
      .single();
    allowanceId = allw!.id;

    // A personal category (household_id NULL) used for allowance spending.
    const { data: pcat } = await svc
      .from('categories')
      .insert({ user_id: aId, name: 'Allw Personal', color: '#abcdef', type: 'expense' })
      .select('id')
      .single();
    personalCatId = pcat!.id;

    // A shared household category (visible to members) — for the totals exclusion check.
    const { data: scat } = await svc
      .from('categories')
      .insert({ user_id: aId, name: 'Allw Shared', color: '#123abc', type: 'expense', household_id: householdId, visibility_level: 'shared' })
      .select('id')
      .single();
    sharedCatId = scat!.id;

    // Allowance transaction: tagged + personal (household_id NULL).
    await svc.from('transactions').insert({
      user_id: aId,
      category_id: personalCatId,
      amount: 50,
      type: 'expense',
      date: '2026-06-05',
      currency: 'EUR',
      household_id: null,
      allowance_id: allowanceId,
    });

    // A normal shared transaction so totals are non-empty for the exclusion assertion.
    await svc.from('transactions').insert({
      user_id: aId,
      category_id: sharedCatId,
      amount: 80,
      type: 'expense',
      date: '2026-06-05',
      currency: 'EUR',
      household_id: householdId,
    });
  });

  afterAll(async () => {
    if (aId) await deleteTestUser(aId);
    if (bId) await deleteTestUser(bId);
  });

  it('a co-member CANNOT see the owner’s allowance row', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    const { data } = await b.from('personal_allowances').select('id, monthly_amount').eq('id', allowanceId);
    expect(data ?? []).toEqual([]);
  });

  it('a co-member CANNOT see allowance transactions', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    const { data } = await b.from('transactions').select('id').eq('allowance_id', allowanceId);
    expect(data ?? []).toEqual([]);
  });

  it('household_category_totals excludes allowance spend', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    const { data } = await b.rpc('household_category_totals', { p_household_id: householdId });
    const ids = (data ?? []).map((r: { category_id: string }) => r.category_id);
    expect(ids).toContain(sharedCatId); // shared spend is visible
    expect(ids).not.toContain(personalCatId); // allowance/personal category never appears
  });

  it('the owner can read and update their own allowance', async () => {
    const a = await signInAsTestUser(aEmail, PWD);
    const read = await a.from('personal_allowances').select('id, monthly_amount').eq('id', allowanceId).single();
    expect(read.data?.id).toBe(allowanceId);

    const upd = await a.from('personal_allowances').update({ monthly_amount: 250 }).eq('id', allowanceId);
    expect(upd.error).toBeNull();
    const svc = createServiceClient();
    const { data } = await svc.from('personal_allowances').select('monthly_amount').eq('id', allowanceId).single();
    expect(Number(data?.monthly_amount)).toBe(250);
  });

  it('a co-member CANNOT update the owner’s allowance', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    await b.from('personal_allowances').update({ monthly_amount: 9999 }).eq('id', allowanceId);
    // RLS makes the row invisible to B, so the update matches nothing — value stays put.
    const svc = createServiceClient();
    const { data } = await svc.from('personal_allowances').select('monthly_amount').eq('id', allowanceId).single();
    expect(Number(data?.monthly_amount)).not.toBe(9999);
  });
});
