/**
 * @jest-environment node
 *
 * Transparency RLS tests — Story 13.4.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 * Proves the per-category visibility matrix at the DATA LAYER (NFR27):
 *   shared        → members see the category + its transactions
 *   category_only → members see the category + its TOTAL (via RPC), NOT its transactions
 *   private       → members see neither the category nor its transactions
 * Plus: household_category_totals excludes private; visibility is owner-only (trigger).
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
const a1Email = `rls-tr-a1-${stamp}@example.test`; // owner of the categories
const a2Email = `rls-tr-a2-${stamp}@example.test`; // member
const b1Email = `rls-tr-b1-${stamp}@example.test`; // outsider

rlsDescribe('Transparency per-category controls (Story 13.4)', () => {
  let a1Id: string;
  let a2Id: string;
  let b1Id: string;
  let householdAId: string;
  const cat: Record<string, string> = {}; // visibility -> category id
  const tx: Record<string, string> = {}; // visibility -> transaction id

  async function seedCategory(svc: ReturnType<typeof createServiceClient>, visibility: string) {
    const { data: c } = await svc
      .from('categories')
      .insert({ user_id: a1Id, name: `Cat ${visibility}`, color: '#123456', type: 'expense', household_id: householdAId, visibility_level: visibility })
      .select('id')
      .single();
    cat[visibility] = c!.id;
    const { data: t } = await svc
      .from('transactions')
      .insert({ user_id: a1Id, category_id: c!.id, amount: 100, type: 'expense', date: '2026-06-04', currency: 'EUR', household_id: householdAId })
      .select('id')
      .single();
    tx[visibility] = t!.id;
  }

  beforeAll(async () => {
    const svc = createServiceClient();
    a1Id = await createTestUser(a1Email, PWD);
    a2Id = await createTestUser(a2Email, PWD);
    b1Id = await createTestUser(b1Email, PWD);

    const { data: hA } = await svc.from('households').insert({ name: 'Transparency A', created_by: a1Id }).select('id').single();
    householdAId = hA!.id;
    await svc.from('household_members').insert([
      { household_id: householdAId, user_id: a1Id, role: 'admin' },
      { household_id: householdAId, user_id: a2Id, role: 'member' },
    ]);

    await seedCategory(svc, 'shared');
    await seedCategory(svc, 'category_only');
    await seedCategory(svc, 'private');
  });

  afterAll(async () => {
    if (a1Id) await deleteTestUser(a1Id);
    if (a2Id) await deleteTestUser(a2Id);
    if (b1Id) await deleteTestUser(b1Id);
  });

  it('member sees shared + category_only categories, but NOT private', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const { data } = await a2.from('categories').select('id').in('id', [cat.shared, cat.category_only, cat.private]);
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(cat.shared);
    expect(ids).toContain(cat.category_only);
    expect(ids).not.toContain(cat.private);
  });

  it('member sees shared transactions, but NOT category_only or private transactions', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const sharedTx = await a2.from('transactions').select('id').eq('id', tx.shared);
    expect(sharedTx.data).toHaveLength(1);
    const catOnlyTx = await a2.from('transactions').select('id').eq('id', tx.category_only);
    expect(catOnlyTx.data).toEqual([]);
    const privateTx = await a2.from('transactions').select('id').eq('id', tx.private);
    expect(privateTx.data).toEqual([]);
  });

  it('household_category_totals returns shared + category_only totals, excludes private', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const { data } = await a2.rpc('household_category_totals', { p_household_id: householdAId });
    const ids = (data ?? []).map((r: { category_id: string }) => r.category_id);
    expect(ids).toContain(cat.shared);
    expect(ids).toContain(cat.category_only);
    expect(ids).not.toContain(cat.private);
    // category_only total is exposed even though the rows aren't visible
    const catOnly = (data ?? []).find((r: { category_id: string }) => r.category_id === cat.category_only);
    expect(Number(catOnly?.total)).toBe(100);
  });

  it('outsider sees no categories and gets no totals', async () => {
    const b1 = await signInAsTestUser(b1Email, PWD);
    const cats = await b1.from('categories').select('id').eq('household_id', householdAId);
    expect(cats.data).toEqual([]);
    const totals = await b1.rpc('household_category_totals', { p_household_id: householdAId });
    expect(totals.data ?? []).toEqual([]);
  });

  it('owner sees all three categories + their transactions fully', async () => {
    const a1 = await signInAsTestUser(a1Email, PWD);
    const cats = await a1.from('categories').select('id').eq('household_id', householdAId);
    expect((cats.data ?? []).length).toBe(3);
    const txs = await a1.from('transactions').select('id').eq('household_id', householdAId);
    expect((txs.data ?? []).length).toBe(3);
  });

  it('a member CANNOT change another owner’s category visibility (owner-only trigger)', async () => {
    const a2 = await signInAsTestUser(a2Email, PWD);
    const { error } = await a2.from('categories').update({ visibility_level: 'shared' }).eq('id', cat.category_only);
    expect(error).not.toBeNull(); // trigger raises
    const svc = createServiceClient();
    const { data } = await svc.from('categories').select('visibility_level').eq('id', cat.category_only).single();
    expect(data?.visibility_level).toBe('category_only'); // unchanged
  });
});
