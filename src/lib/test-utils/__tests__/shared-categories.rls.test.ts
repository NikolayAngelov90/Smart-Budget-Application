/**
 * @jest-environment node
 *
 * Shared budget categories RLS tests — Story 13.5.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 * Verifies the dual-path RLS: household members see+manage shared categories and
 * see shared-category transactions, while personal data stays private and members
 * cannot edit each other's transactions (owner-only writes). NFR10/NFR11.
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
const a1Email = `rls-sc-a1-${stamp}@example.test`; // admin of A, creator of shared cat
const a2Email = `rls-sc-a2-${stamp}@example.test`; // member of A
const b1Email = `rls-sc-b1-${stamp}@example.test`; // outsider (household B)

rlsDescribe('Shared budget categories isolation (Story 13.5)', () => {
  let a1Id: string;
  let a2Id: string;
  let b1Id: string;
  let householdAId: string;
  let sharedCatId: string;
  let personalCatId: string;
  let sharedTxId: string;

  beforeAll(async () => {
    const svc = createServiceClient();
    a1Id = await createTestUser(a1Email, PWD);
    a2Id = await createTestUser(a2Email, PWD);
    b1Id = await createTestUser(b1Email, PWD);

    const { data: hA } = await svc
      .from('households')
      .insert({ name: 'SC Household A', created_by: a1Id })
      .select('id')
      .single();
    householdAId = hA!.id;
    await svc.from('household_members').insert([
      { household_id: householdAId, user_id: a1Id, role: 'admin' },
      { household_id: householdAId, user_id: a2Id, role: 'member' },
    ]);

    const { data: hB } = await svc
      .from('households')
      .insert({ name: 'SC Household B', created_by: b1Id })
      .select('id')
      .single();
    await svc.from('household_members').insert({ household_id: hB!.id, user_id: b1Id, role: 'admin' });

    // Shared category in A (created by a1) + a personal category for a1.
    const { data: sharedCat } = await svc
      .from('categories')
      .insert({ user_id: a1Id, name: 'Groceries', color: '#48bb78', type: 'expense', household_id: householdAId })
      .select('id')
      .single();
    sharedCatId = sharedCat!.id;

    const { data: personalCat } = await svc
      .from('categories')
      .insert({ user_id: a1Id, name: 'Personal A1', color: '#f56565', type: 'expense' })
      .select('id')
      .single();
    personalCatId = personalCat!.id;

    // a1 records a transaction in the shared category (household_id set → visible to members).
    const { data: tx } = await svc
      .from('transactions')
      .insert({
        user_id: a1Id,
        category_id: sharedCatId,
        amount: 42,
        type: 'expense',
        date: '2026-06-04',
        currency: 'EUR',
        household_id: householdAId,
      })
      .select('id')
      .single();
    sharedTxId = tx!.id;
  });

  afterAll(async () => {
    if (a1Id) await deleteTestUser(a1Id);
    if (a2Id) await deleteTestUser(a2Id);
    if (b1Id) await deleteTestUser(b1Id);
  });

  it('member (a2) CAN see the shared category', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const { data } = await a2.from('categories').select('id').eq('id', sharedCatId);
    expect(data).toHaveLength(1);
  });

  it('member (a2) CANNOT see another member’s personal category', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const { data } = await a2.from('categories').select('id').eq('id', personalCatId);
    expect(data).toEqual([]);
  });

  it('outsider (b1) CANNOT see the shared category', async () => {
    const b1 = await signInAsTestUser(b1Email, PWD);
    const { data } = await b1.from('categories').select('id').eq('id', sharedCatId);
    expect(data).toEqual([]);
  });

  it('member (a2) CAN see a shared-category transaction; outsider (b1) CANNOT', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const a2View = await a2.from('transactions').select('id').eq('id', sharedTxId);
    expect(a2View.data).toHaveLength(1);

    const b1 = await signInAsTestUser(b1Email, PWD);
    const b1View = await b1.from('transactions').select('id').eq('id', sharedTxId);
    expect(b1View.data).toEqual([]);
  });

  it('member (a2) CAN manage the shared category but NOT another member’s personal one', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    await a2.from('categories').update({ color: '#000000' }).eq('id', sharedCatId);
    await a2.from('categories').update({ color: '#000000' }).eq('id', personalCatId);
    const svc = createServiceClient();
    const shared = await svc.from('categories').select('color').eq('id', sharedCatId).single();
    const personal = await svc.from('categories').select('color').eq('id', personalCatId).single();
    expect(shared.data?.color).toBe('#000000'); // member edit applied
    expect(personal.data?.color).toBe('#f56565'); // personal unchanged (RLS blocked)
  });

  it('member (a2) CANNOT edit another member’s transaction (owner-only writes)', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    await a2.from('transactions').update({ amount: 999 }).eq('id', sharedTxId);
    const svc = createServiceClient();
    const { data } = await svc.from('transactions').select('amount').eq('id', sharedTxId).single();
    expect(Number(data?.amount)).toBe(42); // unchanged
  });

  // Regression for review finding HIGH-1: an outsider cannot INJECT a row into household A
  // by setting household_id=A on their own transaction (INSERT WITH CHECK enforces membership).
  it('outsider (b1) CANNOT inject a transaction into household A', async () => {
    const b1 = await signInAsTestUser(b1Email, PWD);
    // b1 needs a category they own to reference; create a personal one as b1.
    const { data: b1cat } = await b1
      .from('categories')
      .insert({ user_id: b1Id, name: 'B1 Cat', color: '#222222', type: 'expense' })
      .select('id')
      .single();
    const { error } = await b1.from('transactions').insert({
      user_id: b1Id,
      category_id: b1cat!.id,
      amount: 1,
      type: 'expense',
      date: '2026-06-04',
      currency: 'EUR',
      household_id: householdAId, // attempt to inject into household A
    });
    expect(error).not.toBeNull(); // WITH CHECK denies (b1 is not a member of A)
  });
});
