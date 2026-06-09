/**
 * @jest-environment node
 *
 * Values plan RLS tests — Story 14.1.
 *
 * Node env (global fetch); env-gated via rlsDescribe (skips without RLS_TEST_*).
 * Proves the owner-only guarantees at the DATA LAYER:
 *   - user_values + value_categories are OWNER-ONLY (user B cannot SELECT/UPDATE/DELETE A's)
 *   - deleting a value cascades to its value_categories mappings
 *   - the owner round-trips a value + its mappings
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
const aEmail = `rls-values-a-${stamp}@example.test`; // owner
const bEmail = `rls-values-b-${stamp}@example.test`; // must NOT see A's values

rlsDescribe('Values plan privacy (Story 14.1)', () => {
  let aId: string;
  let bId: string;
  let valueId: string;
  let categoryId: string;

  beforeAll(async () => {
    const svc = createServiceClient();
    aId = await createTestUser(aEmail, PWD);
    bId = await createTestUser(bEmail, PWD);

    const { data: v } = await svc
      .from('user_values')
      .insert({ user_id: aId, name: 'Health', priority: 0 })
      .select('id')
      .single();
    valueId = v!.id;

    const { data: cat } = await svc
      .from('categories')
      .insert({ user_id: aId, name: 'Values Cat', color: '#abcdef', type: 'expense' })
      .select('id')
      .single();
    categoryId = cat!.id;

    await svc
      .from('value_categories')
      .insert({ user_id: aId, value_id: valueId, category_id: categoryId });
  });

  afterAll(async () => {
    if (aId) await deleteTestUser(aId);
    if (bId) await deleteTestUser(bId);
  });

  it('user B CANNOT see user A’s values', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    const { data } = await b.from('user_values').select('id').eq('id', valueId);
    expect(data ?? []).toEqual([]);
  });

  it('user B CANNOT see user A’s value_categories mappings', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    const { data } = await b.from('value_categories').select('id').eq('value_id', valueId);
    expect(data ?? []).toEqual([]);
  });

  it('user B CANNOT update or delete user A’s value', async () => {
    const b = await signInAsTestUser(bEmail, PWD);
    await b.from('user_values').update({ name: 'Hacked' }).eq('id', valueId);
    await b.from('user_values').delete().eq('id', valueId);
    const svc = createServiceClient();
    const { data } = await svc.from('user_values').select('name').eq('id', valueId).single();
    expect(data?.name).toBe('Health'); // untouched
  });

  it('the owner round-trips their value with its mapped category', async () => {
    const a = await signInAsTestUser(aEmail, PWD);
    const { data: values } = await a.from('user_values').select('id, name').eq('id', valueId);
    expect((values ?? []).map((r: { name: string }) => r.name)).toEqual(['Health']);
    const { data: maps } = await a.from('value_categories').select('category_id').eq('value_id', valueId);
    expect((maps ?? []).map((r: { category_id: string }) => r.category_id)).toEqual([categoryId]);
  });

  it('deleting a value cascades to its value_categories mappings', async () => {
    const svc = createServiceClient();
    const { data: v } = await svc
      .from('user_values')
      .insert({ user_id: aId, name: 'Temp', priority: 1 })
      .select('id')
      .single();
    await svc.from('value_categories').insert({ user_id: aId, value_id: v!.id, category_id: categoryId });

    await svc.from('user_values').delete().eq('id', v!.id);
    const { data: maps } = await svc.from('value_categories').select('id').eq('value_id', v!.id);
    expect(maps ?? []).toEqual([]);
  });
});
