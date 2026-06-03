/**
 * REFERENCE RLS integration test (PREP-1).
 *
 * Runs in the default jsdom env (Node 22 provides global fetch; this project's
 * jest.setup.js accesses `window`, so `@jest-environment node` is avoided — see
 * project testing notes). The harness imports the raw supabase-js client, which
 * is unaffected by jest.setup.js's global mock of @/lib/supabase/server.
 *
 * Proves the harness pattern on EXISTING tables (user-to-user `transactions`
 * isolation) so Epic 13 starts household RLS tests from a working example rather
 * than a blank page. It is env-gated via `rlsDescribe` — skipped unless the
 * RLS_TEST_* vars are set (see docs/testing/rls-integration-test-strategy.md),
 * so `npm test` stays green without a database. Run for real with:
 *   npx supabase start && npm run test:rls
 *
 * Epic 13 household tests follow this exact shape, expanded to the
 * shared / category_only / private transparency matrix (NFR10/NFR11).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  rlsDescribe,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  signInAsTestUser,
} from '@/lib/test-utils/rlsClient';

const PWD = 'rls-test-passw0rd!';
const userAEmail = `rls-a-${Date.now()}@example.test`;
const userBEmail = `rls-b-${Date.now()}@example.test`;

rlsDescribe('RLS reference — transaction isolation between users', () => {
  let userAId: string;
  let userBId: string;
  let categoryAId: string;
  let txAId: string;

  beforeAll(async () => {
    const svc = createServiceClient();
    userAId = await createTestUser(userAEmail, PWD);
    userBId = await createTestUser(userBEmail, PWD);

    // Seed (service role bypasses RLS — seeding only, never asserted through).
    const { data: cat } = await svc
      .from('categories')
      .insert({ user_id: userAId, name: 'RLS Dining', color: '#000000', type: 'expense' })
      .select('id')
      .single();
    categoryAId = cat!.id;

    const { data: tx } = await svc
      .from('transactions')
      .insert({
        user_id: userAId,
        category_id: categoryAId,
        amount: 42.0,
        type: 'expense',
        date: '2026-06-01',
        currency: 'EUR',
      })
      .select('id')
      .single();
    txAId = tx!.id;
  });

  afterAll(async () => {
    // Cascades app rows via ON DELETE CASCADE on user_id FKs.
    if (userAId) await deleteTestUser(userAId);
    if (userBId) await deleteTestUser(userBId);
  });

  it('owner (user A) CAN read their own transaction', async () => {
    const a = await signInAsTestUser(userAEmail, PWD);
    const { data } = await a.from('transactions').select('id').eq('id', txAId);
    expect(data).toHaveLength(1);
  });

  it('other user (user B) CANNOT read user A’s transaction', async () => {
    const b: SupabaseClient = await signInAsTestUser(userBEmail, PWD);
    // The assertion that matters: the DB returns [] to B even though the row exists.
    const { data } = await b.from('transactions').select('id').eq('id', txAId);
    expect(data).toEqual([]);
  });

  it('other user (user B) CANNOT read user A’s category', async () => {
    const b = await signInAsTestUser(userBEmail, PWD);
    const { data } = await b.from('categories').select('id').eq('id', categoryAId);
    expect(data).toEqual([]);
  });

  it('other user (user B) CANNOT write into user A’s scope', async () => {
    const b = await signInAsTestUser(userBEmail, PWD);
    const { error } = await b.from('transactions').insert({
      user_id: userAId, // attempt to impersonate A — RLS WITH CHECK must reject
      category_id: categoryAId,
      amount: 1,
      type: 'expense',
      date: '2026-06-02',
      currency: 'EUR',
    });
    expect(error).not.toBeNull();
  });
});
