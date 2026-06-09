/**
 * @jest-environment node
 *
 * Household insights data-source RLS tests — Story 13.10.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 * Proves household_category_period_totals: membership-gated; shared + category_only only
 * (private EXCLUDED); respects the date window; outsiders get nothing.
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
const aEmail = `rls-hi-a-${stamp}@example.test`;
const bEmail = `rls-hi-b-${stamp}@example.test`;
const outEmail = `rls-hi-out-${stamp}@example.test`;

const CUR_START = '2026-06-01';
const CUR_END = '2026-07-01';

rlsDescribe('Household period totals (Story 13.10)', () => {
  let aId: string;
  let bId: string;
  let outId: string;
  let householdId: string;
  let sharedCatId: string;
  let catOnlyId: string;
  let privateCatId: string;

  async function cat(svc: ReturnType<typeof createServiceClient>, name: string, visibility: string) {
    const { data } = await svc
      .from('categories')
      .insert({ user_id: aId, name, color: '#abcdef', type: 'expense', household_id: householdId, visibility_level: visibility })
      .select('id')
      .single();
    return data!.id as string;
  }
  async function tx(svc: ReturnType<typeof createServiceClient>, categoryId: string, amount: number, date: string) {
    await svc.from('transactions').insert({ user_id: aId, category_id: categoryId, amount, type: 'expense', date, currency: 'EUR', household_id: householdId });
  }

  beforeAll(async () => {
    const svc = createServiceClient();
    aId = await createTestUser(aEmail, PWD);
    bId = await createTestUser(bEmail, PWD);
    outId = await createTestUser(outEmail, PWD);

    const { data: h } = await svc.from('households').insert({ name: 'Insights HH', created_by: aId }).select('id').single();
    householdId = h!.id;
    await svc.from('household_members').insert([
      { household_id: householdId, user_id: aId, role: 'admin' },
      { household_id: householdId, user_id: bId, role: 'member' },
    ]);

    sharedCatId = await cat(svc, 'Groceries', 'shared');
    catOnlyId = await cat(svc, 'Personal-ish', 'category_only');
    privateCatId = await cat(svc, 'Secret', 'private');

    // In-window (June): shared 100, category_only 30, private 80.
    await tx(svc, sharedCatId, 100, '2026-06-10');
    await tx(svc, catOnlyId, 30, '2026-06-12');
    await tx(svc, privateCatId, 80, '2026-06-15');
    // Out-of-window (May): shared 999 — must NOT be counted in the June window.
    await tx(svc, sharedCatId, 999, '2026-05-20');
  });

  afterAll(async () => {
    if (aId) await deleteTestUser(aId);
    if (bId) await deleteTestUser(bId);
    if (outId) await deleteTestUser(outId);
  });

  it('returns shared + category_only totals in the window, EXCLUDES private', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    const { data } = await b.rpc('household_category_period_totals', { p_household_id: householdId, p_start: CUR_START, p_end: CUR_END });
    const byId = Object.fromEntries((data ?? []).map((r: { category_id: string; total: number }) => [r.category_id, Number(r.total)]));
    expect(byId[sharedCatId]).toBe(100); // in-window only (999 from May excluded)
    expect(byId[catOnlyId]).toBe(30);
    expect(byId[privateCatId]).toBeUndefined(); // private never appears
  });

  it('returns nothing to an outsider', async () => {
    const out = await signInAsTestUser(outEmail, PWD);
    const { data } = await out.rpc('household_category_period_totals', { p_household_id: householdId, p_start: CUR_START, p_end: CUR_END });
    expect(data ?? []).toEqual([]);
  });
});
