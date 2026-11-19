/**
 * @jest-environment node
 *
 * Account deletion that never destroys another member's data - against Postgres.
 * Spec: _bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md
 *
 * Two principles, which pull against each other:
 *   P1  a member never loses their own data because someone else left
 *   P2  a person who deletes their account leaves no personal data behind
 *
 * Deletions run through the REAL settingsService.deleteUserAccount (the app's
 * service-role client pinned to the local stack), not a copy of its steps that
 * could drift from it. Test 2 alone drives the two steps by hand, because what it
 * tests is the gap between them.
 *
 * Every deletion ends with a residue scan of every user-referencing column the
 * catalog has (see `referencesTo`), so each scenario stands alone; test 4 proves
 * the scan itself can see.
 *
 * Env-gated via `rlsDescribe` (skipped unless RLS_TEST_* is set). The scan also
 * needs LOCAL_DB_URL, which the shared local-stack action exports; when the harness
 * is configured and that is missing, the scan FAILS as NOT MEASURED.
 */

import { Client } from 'pg';
import {
  rlsDescribe,
  createServiceClient,
  createTestUser,
  seedSingle,
  pinAppServiceRoleToLocalStack,
  assertAppPinnedToLocalStack,
} from '@/lib/test-utils/rlsClient';
import { deleteUserAccount } from '@/lib/services/settingsService';

const PWD = 'rls-test-passw0rd!';
const stamp = Date.now();
const svc = () => createServiceClient();

/** Users still alive, deleted in afterAll through the same path. */
const toCleanUp: string[] = [];
/** Every test user's email: the residue scan looks for it as well as the id. */
const emails = new Map<string, string>();

function forget(userId: string): void {
  const i = toCleanUp.indexOf(userId);
  if (i >= 0) toCleanUp.splice(i, 1);
}

function emailOf(tag: string): string {
  return `rls-del-${tag}-${stamp}@example.test`;
}

async function makeUser(tag: string): Promise<string> {
  const email = emailOf(tag);
  const id = await createTestUser(email, PWD);
  toCleanUp.push(id);
  emails.set(id, email);
  return id;
}

async function invite(
  householdId: string,
  email: string,
  invitedBy: string,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const i = await seedSingle<{ id: string }>(
    svc()
      .from('household_invitations')
      .insert({
        household_id: householdId,
        email,
        invited_by: invitedBy,
        expires_at: '2099-01-01T00:00:00Z',
        ...extra,
      })
      .select('id')
      .single(),
    `invitation to ${email}`
  );
  return i.id;
}

type Prepared = {
  ownership_transferred: boolean;
  shared_objects_moved: number;
  categories_copied: number;
  rows_repointed: number;
};
const NO_OP: Prepared = {
  ownership_transferred: false,
  shared_objects_moved: 0,
  categories_copied: 0,
  rows_repointed: 0,
};

/** Calls the preparation directly - only to observe its return contract. */
async function prepare(userId: string): Promise<Prepared> {
  const { data, error } = await svc().rpc('prepare_account_deletion', { p_user: userId });
  if (error) throw new Error(`prepare_account_deletion failed: ${error.message}`);
  return data as Prepared;
}

/** The REAL deletion, then the residue scan. */
async function deleteAccount(userId: string): Promise<void> {
  assertAppPinnedToLocalStack();
  await deleteUserAccount(userId); // throws "Failed to ..." on either step
  forget(userId);
  await expectNoResidue(userId);
}

async function household(
  name: string,
  createdBy: string,
  members: Array<{ id: string; role: 'admin' | 'member'; joinedAt: string | null }>
): Promise<string> {
  const h = await seedSingle<{ id: string }>(
    svc().from('households').insert({ name, created_by: createdBy }).select('id').single(),
    `household ${name}`
  );
  const { error } = await svc()
    .from('household_members')
    .insert(
      members.map((m) => ({
        household_id: h.id,
        user_id: m.id,
        role: m.role,
        joined_at: m.joinedAt,
      }))
    );
  if (error) throw new Error(`seed members of ${name}: ${error.message}`);
  return h.id;
}

async function category(
  userId: string,
  name: string,
  householdId: string | null = null
): Promise<string> {
  const c = await seedSingle<{ id: string }>(
    svc()
      .from('categories')
      .insert({
        user_id: userId,
        name,
        color: '#123456',
        type: 'expense',
        household_id: householdId,
      })
      .select('id')
      .single(),
    `category ${name}`
  );
  return c.id;
}

async function tx(
  userId: string,
  categoryId: string,
  householdId: string | null = null,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const t = await seedSingle<{ id: string }>(
    svc()
      .from('transactions')
      .insert({
        user_id: userId,
        category_id: categoryId,
        amount: 12.5,
        type: 'expense',
        date: '2026-06-01',
        currency: 'EUR',
        household_id: householdId,
        ...extra,
      })
      .select('id')
      .single(),
    'transaction'
  );
  return t.id;
}

async function goal(
  userId: string,
  name: string,
  householdId: string | null,
  current: number
): Promise<string> {
  const g = await seedSingle<{ id: string }>(
    svc()
      .from('goals')
      .insert({
        user_id: userId,
        name,
        target_amount: 1000,
        current_amount: current,
        household_id: householdId,
      })
      .select('id')
      .single(),
    `goal ${name}`
  );
  return g.id;
}

async function contribute(goalId: string, userId: string, amount: number): Promise<string> {
  const c = await seedSingle<{ id: string }>(
    svc()
      .from('goal_contributions')
      .insert({ goal_id: goalId, user_id: userId, amount })
      .select('id')
      .single(),
    'contribution'
  );
  return c.id;
}

async function row<T = Record<string, unknown>>(table: string, id: string): Promise<T | null> {
  const { data, error } = await svc().from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`read ${table} ${id}: ${error.message}`);
  return data as T | null;
}

async function countRows(table: string, filters: Record<string, string | null>): Promise<number> {
  let q = svc().from(table).select('id', { count: 'exact', head: true });
  for (const [col, val] of Object.entries(filters))
    q = val === null ? q.is(col, null) : q.eq(col, val);
  const { count, error } = await q;
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? -1;
}

async function rolesIn(householdId: string): Promise<Array<{ user_id: string; role: string }>> {
  const { data, error } = await svc()
    .from('household_members')
    .select('user_id, role')
    .eq('household_id', householdId);
  if (error) throw new Error(`read roles of ${householdId}: ${error.message}`);
  return data as Array<{ user_id: string; role: string }>;
}

async function goalTotals(goalId: string): Promise<{ current: number; sum: number }> {
  const g = await row<{ current_amount: number }>('goals', goalId);
  const { data, error } = await svc()
    .from('goal_contributions')
    .select('amount')
    .eq('goal_id', goalId);
  if (error) throw new Error(`sum contributions of ${goalId}: ${error.message}`);
  const sum = (data ?? []).reduce((n, r) => n + Number((r as { amount: number }).amount), 0);
  return { current: Number(g?.current_amount), sum };
}

/** P2 for the auth side: the auth user is gone - a not-found, not some other error. */
async function expectAuthUserGone(userId: string): Promise<void> {
  const { data, error } = await svc().auth.admin.getUserById(userId);
  expect(data.user).toBeNull();
  expect(error?.status).toBe(404);
}

/**
 * Every column of every app table (schemas public and storage) that could hold a
 * user id - uuid, uuid[], and text-like (text, varchar, json, jsonb, arrays of
 * them) - enumerated from the catalog NOW, and which of them still hold `userId`.
 *
 * WHY WIDER THAN THE FKs TO auth.users: for an FK column the answer is guaranteed
 * by referential integrity - once the auth row is gone each one has cascaded, gone
 * NULL, or refused the delete - so scanning only those can never fail. A column
 * that CAN still hold a deleted id has no FK: a bare `user_id` added later, an id
 * inside a jsonb payload, a storage object's owner. Not scanned: the `auth` schema
 * (GoTrue's own tables, incl. its audit log, are not the app's to clean).
 *
 * MUST-FIND, on every call: the enumeration must see `public.user_profiles.id`
 * among the auth.users FKs, or the scan is NOT MEASURED - never "zero hits".
 */
async function referencesTo(
  userId: string,
  email?: string
): Promise<{ fkColumns: string[]; scanned: string[]; hits: string[] }> {
  const url = process.env.LOCAL_DB_URL;
  if (!url) throw new Error('NOT MEASURED - LOCAL_DB_URL is unset, so the catalog cannot be read');
  const pg = new Client({ connectionString: url });
  await pg.connect();
  try {
    // relname/nspname, not regclass::text - the latter is qualified or not
    // depending on search_path, which would turn the must-find into a false red.
    const { rows } = await pg.query<{
      sch: string;
      tbl: string;
      col: string;
      kind: string;
      fk: boolean;
    }>(
      `select n.nspname as sch, t.relname as tbl, a.attname as col,
              case when a.atttypid = 'uuid'::regtype then 'uuid'
                   when a.atttypid = 'uuid[]'::regtype then 'uuid[]'
                   else 'text' end as kind,
              exists (select 1 from pg_constraint c
                       where c.conrelid = t.oid and c.contype = 'f'
                         and c.confrelid = 'auth.users'::regclass
                         and a.attnum = any(c.conkey)) as fk
         from pg_attribute a
         join pg_class t on t.oid = a.attrelid
         join pg_namespace n on n.oid = t.relnamespace
        where n.nspname in ('public', 'storage') and t.relkind in ('r', 'p')
          and a.attnum > 0 and not a.attisdropped
          and a.atttypid in ('uuid'::regtype, 'uuid[]'::regtype,
                             'text'::regtype, 'varchar'::regtype, 'json'::regtype, 'jsonb'::regtype,
                             'text[]'::regtype, 'varchar[]'::regtype, 'jsonb[]'::regtype)
        order by 1, 2, 3`
    );
    const name = (r: { sch: string; tbl: string; col: string }) => `${r.sch}.${r.tbl}.${r.col}`;
    const fkColumns = rows.filter((r) => r.fk).map(name);
    if (!fkColumns.includes('public.user_profiles.id')) {
      throw new Error(
        `NOT MEASURED - the catalog enumeration did not find public.user_profiles.id ` +
          `(it found ${fkColumns.length} FK column(s): ${fkColumns.join(', ') || 'none'})`
      );
    }
    const hits: string[] = [];
    for (const r of rows) {
      const col = pg.escapeIdentifier(r.col);
      const predicate =
        r.kind === 'uuid'
          ? `${col} = $1::uuid`
          : r.kind === 'uuid[]'
            ? `$1::uuid = any(${col})`
            : `position($1 in ${col}::text) > 0`;
      const res = await pg.query<{ n: number }>(
        `select count(*)::int as n from ${pg.escapeIdentifier(r.sch)}.${pg.escapeIdentifier(r.tbl)}
          where ${predicate}`,
        [userId]
      );
      if (res.rows[0]!.n > 0) hits.push(`${name(r)}: ${res.rows[0]!.n}`);
      // The EMAIL, case-insensitively: personal data that never contains the id,
      // so an id-only scan cannot see it (an invitation addressed to the person).
      if (email && r.kind === 'text') {
        const er = await pg.query<{ n: number }>(
          `select count(*)::int as n from ${pg.escapeIdentifier(r.sch)}.${pg.escapeIdentifier(r.tbl)}
            where position(lower($1) in lower(${col}::text)) > 0`,
          [email]
        );
        if (er.rows[0]!.n > 0) hits.push(`${name(r)}: ${er.rows[0]!.n} (email)`);
      }
    }
    return { fkColumns, scanned: rows.map(name), hits };
  } finally {
    await pg.end();
  }
}

async function expectNoResidue(userId: string): Promise<void> {
  const email = emails.get(userId);
  if (!email)
    throw new Error(`NOT MEASURED - no email recorded for ${userId}, so the email scan cannot run`);
  expect({ userId, hits: (await referencesTo(userId, email)).hits }).toEqual({ userId, hits: [] });
}

rlsDescribe(
  'Account deletion keeps members whole (spec-household-creator-account-deletion)',
  () => {
    let restoreEnv: () => void = () => {};

    beforeAll(() => {
      restoreEnv = pinAppServiceRoleToLocalStack();
    });

    afterAll(async () => {
      // Every remaining user goes through the same path, newest first. EVERY one is
      // attempted; failures are collected, so one leftover cannot strand the rest.
      const failures: string[] = [];
      for (const id of [...toCleanUp].reverse()) {
        try {
          await deleteAccount(id);
        } catch (e) {
          failures.push(`${id}: ${(e as Error).message}`);
        }
      }
      restoreEnv();
      if (failures.length)
        throw new Error(`cleanup failed for ${failures.length} user(s):\n${failures.join('\n')}`);
    });

    it('1. creator with a member: ownership transfers, the member keeps every row, the creator is gone', async () => {
      const c = await makeUser('c1');
      const m = await makeUser('m1');
      const h = await household('H1', c, [
        { id: c, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: m, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);

      // C's PERSONAL category, used by M four ways.
      const catC = await category(c, 'C-Hobby');
      const mTx = await tx(m, catC, h);
      const mBudget = await seedSingle<{ id: string }>(
        svc()
          .from('category_budgets')
          .insert({ user_id: m, category_id: catC, period: 'monthly', limit_amount: 50 })
          .select('id')
          .single(),
        "M's personal budget on C's category"
      );
      const mValue = await seedSingle<{ id: string }>(
        svc().from('user_values').insert({ user_id: m, name: 'Joy' }).select('id').single(),
        'value'
      );
      const mMap = await seedSingle<{ id: string }>(
        svc()
          .from('value_categories')
          .insert({ user_id: m, value_id: mValue.id, category_id: catC })
          .select('id')
          .single(),
        "M's value mapping to C's category"
      );
      const mWish = await seedSingle<{ id: string }>(
        svc()
          .from('wishlist_items')
          .insert({ user_id: m, category_id: catC, name: 'Paint', price: 20 })
          .select('id')
          .single(),
        "M's wishlist item on C's category"
      );

      // C's SHARED category - and M already owns that name AND "name 2": the
      // rename must take the LOWEST FREE n >= 2, so it walks past 2 to 3.
      const catS = await category(c, 'Groceries', h);
      await category(m, 'Groceries');
      await category(m, 'Groceries 2');
      const sharedBudget = await seedSingle<{ id: string }>(
        svc()
          .from('category_budgets')
          .insert({
            user_id: c,
            household_id: h,
            category_id: catS,
            period: 'monthly',
            limit_amount: 300,
          })
          .select('id')
          .single(),
        "C's shared budget"
      );

      // A shared goal C created and both contributed to (current = SUM, as the
      // service keeps it); and a PERSONAL goal of C's that M contributed to - the
      // accepted loss. M's savings transaction for that contribution is linked to it
      // exactly as logSavingsContribution links it (transactions.goal_contribution_id,
      // ON DELETE SET NULL), so the cascade reaches it and must leave it standing.
      const gShared = await goal(c, 'Holiday', h, 100);
      await contribute(gShared, c, 40);
      await contribute(gShared, m, 60);
      const gPersonal = await goal(c, 'C-Bike', null, 10);
      const mContribution = await contribute(gPersonal, m, 10);
      const mSavingsCat = await category(m, 'Savings');
      const mSavingsTx = await tx(m, mSavingsCat, null, {
        notes: 'Savings: C-Bike',
        goal_contribution_id: mContribution,
      });

      // REUSE, not copy: M already owns "Books", so M's rows on C's "Books" move to
      // M's own - and where M ALREADY has the same value mapping / the same personal
      // budget period on M's "Books", the repoint is skipped instead of colliding
      // with UNIQUE(value_id, category_id) / the personal-budget unique index.
      const cBooks = await category(c, 'Books');
      const mBooks = await category(m, 'Books');
      const mTxBooks = await tx(m, cBooks);
      for (const catId of [cBooks, mBooks]) {
        await seedSingle(
          svc()
            .from('value_categories')
            .insert({ user_id: m, value_id: mValue.id, category_id: catId })
            .select('id')
            .single(),
          `M's value mapping to Books ${catId}`
        );
        await seedSingle(
          svc()
            .from('category_budgets')
            .insert({ user_id: m, category_id: catId, period: 'monthly', limit_amount: 40 })
            .select('id')
            .single(),
          `M's personal budget on Books ${catId}`
        );
      }

      // A pending invitation C sent: kept, and UNATTRIBUTED (P2) - never handed to M.
      const invite = await seedSingle<{ id: string }>(
        svc()
          .from('household_invitations')
          .insert({
            household_id: h,
            email: `rls-del-invitee-${stamp}@example.test`,
            invited_by: c,
            expires_at: '2099-01-01T00:00:00Z',
          })
          .select('id')
          .single(),
        "C's invitation"
      );

      await deleteAccount(c);

      // Ownership: M owns H and is its only admin.
      expect((await row<{ created_by: string }>('households', h))?.created_by).toBe(m);
      expect(await rolesIn(h)).toEqual([{ user_id: m, role: 'admin' }]);

      // P1, the copy: M's transaction, budget, value mapping and wishlist item all
      // point at M's own "C-Hobby" - exactly one, newly made - and nothing is
      // uncategorised.
      expect(await countRows('categories', { user_id: m, name: 'C-Hobby' })).toBe(1);
      const mCat = await seedSingle<{ id: string }>(
        svc().from('categories').select('id').eq('user_id', m).eq('name', 'C-Hobby').single(),
        "M's copy of C-Hobby"
      );
      expect((await row<{ category_id: string }>('transactions', mTx))?.category_id).toBe(mCat.id);
      expect(
        (await row<{ category_id: string }>('category_budgets', mBudget.id))?.category_id
      ).toBe(mCat.id);
      expect((await row<{ category_id: string }>('value_categories', mMap.id))?.category_id).toBe(
        mCat.id
      );
      expect((await row<{ category_id: string }>('wishlist_items', mWish.id))?.category_id).toBe(
        mCat.id
      );

      // P1, the rewrites: C's shared category moved to M, renamed language-neutrally
      // to the lowest free number ("Groceries" and "Groceries 2" are M's already).
      const s = await row<{ user_id: string; name: string; household_id: string }>(
        'categories',
        catS
      );
      expect(s).toMatchObject({ user_id: m, name: 'Groceries 3', household_id: h });
      expect((await row<{ user_id: string }>('category_budgets', sharedBudget.id))?.user_id).toBe(
        m
      );

      // Shared goal: moved to M; C's contribution gone (P2); total = remaining sum.
      expect((await row<{ user_id: string }>('goals', gShared))?.user_id).toBe(m);
      expect(await goalTotals(gShared)).toEqual({ current: 60, sum: 60 });

      // Accepted loss: C's PERSONAL goal goes, with M's contribution to it - and M's
      // savings transaction stays, unlinked.
      expect(await row('goals', gPersonal)).toBeNull();
      expect(await row('goal_contributions', mContribution)).toBeNull();
      expect(await row('transactions', mSavingsTx)).toMatchObject({
        user_id: m,
        category_id: mSavingsCat,
        goal_contribution_id: null,
      });

      // Reuse: M's transaction is on M's OWN Books, M still has exactly one Books,
      // and exactly one mapping and one personal budget on it - the skipped
      // duplicates went with C's category, and nothing collided.
      expect((await row<{ category_id: string }>('transactions', mTxBooks))?.category_id).toBe(
        mBooks
      );
      expect(await countRows('categories', { user_id: m, name: 'Books' })).toBe(1);
      expect(
        await countRows('value_categories', { value_id: mValue.id, category_id: mBooks })
      ).toBe(1);
      expect(
        await countRows('category_budgets', { user_id: m, category_id: mBooks, household_id: null })
      ).toBe(1);

      // The invitation survives, in H, attributed to nobody.
      expect(await row('household_invitations', invite.id)).toMatchObject({
        household_id: h,
        invited_by: null,
      });

      // P2: C is gone - auth user and profile (and every column: deleteAccount's scan).
      await expectAuthUserGone(c);
      expect(await row('user_profiles', c)).toBeNull();
    });

    it('2. a REFUSED auth delete destroys nothing', async () => {
      const c = await makeUser('c2');
      const m = await makeUser('m2');
      const h = await household('H2', c, [
        { id: c, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: m, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);
      const catLate = await category(c, 'C2-Late');
      const cTx = await tx(c, catLate);
      // Another household's pending invitation addressed to C.
      const other = await makeUser('other2');
      const hOther = await household('H2-other', other, [
        { id: other, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
      ]);
      const inviteToC = await invite(hOther, emailOf('c2'), other);

      // The two steps by hand, because the gap between them is the subject: the
      // preparation runs; THEN M tags a transaction with C's category, which the
      // preparation could not have seen. transactions.category_id is ON DELETE
      // RESTRICT, so the real auth delete is refused.
      expect(await prepare(c)).toMatchObject({ ownership_transferred: true });
      const raceTx = await tx(m, catLate, h);
      const { error: refused } = await svc().auth.admin.deleteUser(c);
      expect(refused).not.toBeNull();

      // Nothing destructive happened: the account, profile, categories and rows all
      // remain, and the household is valid (M owns it and is its only admin; C is a
      // member).
      const { data: authUser, error: authReadError } = await svc().auth.admin.getUserById(c);
      expect(authReadError).toBeNull();
      expect(authUser.user?.id).toBe(c);
      expect(await row('user_profiles', c)).not.toBeNull();
      expect(await row('categories', catLate)).not.toBeNull();
      expect(await row('transactions', cTx)).not.toBeNull();
      expect(await row('transactions', raceTx)).not.toBeNull();
      expect(await row('household_invitations', inviteToC)).not.toBeNull();
      expect((await row<{ created_by: string }>('households', h))?.created_by).toBe(m);
      expect(await rolesIn(h)).toEqual(
        expect.arrayContaining([
          { user_id: m, role: 'admin' },
          { user_id: c, role: 'member' },
        ])
      );
      expect((await rolesIn(h)).filter((r) => r.role === 'admin')).toHaveLength(1);

      // A retry through the real service succeeds: the preparation is re-runnable
      // and copies the raced category.
      await deleteAccount(c); // its residue scan includes C's email
      expect(await row('household_invitations', inviteToC)).toBeNull();
      const copy = await seedSingle<{ id: string }>(
        svc().from('categories').select('id').eq('user_id', m).eq('name', 'C2-Late').single(),
        "M's copy of C2-Late"
      );
      expect((await row<{ category_id: string }>('transactions', raceTx))?.category_id).toBe(
        copy.id
      );
    });

    it('3. a sole-member creator: the household is deleted, as before; a user in no household deletes cleanly', async () => {
      const c = await makeUser('c3');
      const h = await household('H3', c, [
        { id: c, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
      ]);
      const catS = await category(c, 'C3-Shared', h);

      // Sole member: nobody to transfer to and nothing to move - a literal no-op
      // (observed directly; the service then re-runs it, still a no-op, and deletes).
      expect(await prepare(c)).toEqual(NO_OP);
      await deleteAccount(c);

      expect(await row('households', h)).toBeNull();
      expect(await row('categories', catS)).toBeNull();

      // No household at all: preparation is a no-op, deletion as before.
      const loner = await makeUser('loner');
      const lCat = await category(loner, 'Loner');
      const lTx = await tx(loner, lCat);
      expect(await prepare(loner)).toEqual(NO_OP);
      await deleteAccount(loner);
      expect(await row('categories', lCat)).toBeNull();
      expect(await row('transactions', lTx)).toBeNull();
      await expectAuthUserGone(loner);
    });

    it('4. the residue scan can see: a living user is found, in uuid AND text-like columns, and the enumeration covers the FKs', async () => {
      // Its own fixture - no dependence on the other scenarios or their order.
      const live = await makeUser('live');
      await household('H4', live, [{ id: live, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' }]);
      // A text-like presence control: the living user's id inside a jsonb payload.
      await seedSingle(
        svc()
          .from('analytics_events')
          .insert({
            user_id: live,
            event_name: 'rls_residue_probe',
            event_properties: { subject: live },
          })
          .select('id')
          .single(),
        'analytics probe'
      );
      // An email presence control: another household's invitation addressed to the
      // living user, spelled in capitals.
      const inviter = await makeUser('inviter4');
      const h4b = await household('H4-inviter', inviter, [
        { id: inviter, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
      ]);
      await invite(h4b, emailOf('live').toUpperCase(), inviter);

      const r = await referencesTo(live, emailOf('live'));
      // The enumeration: the auth.users FKs are all inside it (the 26 classified in
      // the spec; more is allowed, fewer means it is broken), and it is WIDER than
      // them - otherwise it could never fail.
      expect(r.fkColumns).toEqual(
        expect.arrayContaining(['public.transactions.user_id', 'public.households.created_by'])
      );
      expect(r.fkColumns.length).toBeGreaterThanOrEqual(26);
      expect(r.scanned).toEqual(expect.arrayContaining(r.fkColumns));
      expect(r.scanned.length).toBeGreaterThan(r.fkColumns.length);
      // PRESENCE: the counter finds a user who exists - through uuid FK columns AND
      // through the text-like path (a jsonb payload). Without this, "no hits" for a
      // deleted user is also what a broken counter returns.
      expect(r.hits).toEqual(
        expect.arrayContaining([
          'public.user_profiles.id: 1',
          'public.households.created_by: 1',
          'public.analytics_events.event_properties: 1',
          // found case-insensitively: the invitation spells the address in capitals
          'public.household_invitations.email: 1 (email)',
        ])
      );
    });

    it('5. a PLAIN member leaves: the shared goal drops by exactly their contributions; a personal goal is not recomputed', async () => {
      const o = await makeUser('o5');
      const p = await makeUser('p5');
      const h = await household('H5', o, [
        { id: o, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: p, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);
      const g = await goal(o, 'Roof', h, 100);
      await contribute(g, o, 70);
      await contribute(g, p, 30);
      // A goal UN-SHARED after P contributed (matrix row 39's shape). Personal goals
      // are outside the trigger by design - the invariant was never established for
      // them - so its total must stay as it was, not be "corrected" to its rows.
      const gUnshared = await goal(o, 'Bike', null, 50);
      await contribute(gUnshared, o, 20);
      await contribute(gUnshared, p, 30);

      // P2 for the EMAIL: every invitation addressed to P goes - the one P accepted
      // (the admin's invitation list would keep showing P's address), a revoked one,
      // and a pending one in another household spelled in capitals. P1: H5's
      // invitation to SOMEONE ELSE stays.
      const accepted = await invite(h, emailOf('p5'), o, {
        status: 'accepted',
        accepted_by: p,
        accepted_at: '2026-02-01T00:00:00Z',
      });
      // Accepted at an address P has since CHANGED: acceptance checks the email only
      // at acceptance time. Only accepted_by finds this row - and the email scan
      // cannot (the address is no longer P's), so it is asserted explicitly below.
      const acceptedOldAddress = await invite(h, `rls-del-p5-old-${stamp}@example.test`, o, {
        status: 'accepted',
        accepted_by: p,
        accepted_at: '2026-01-15T00:00:00Z',
      });
      const revoked = await invite(h, emailOf('p5'), o, { status: 'revoked' });
      const elsewhere = await makeUser('x5');
      const hElse = await household('H5-else', elsewhere, [
        { id: elsewhere, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
      ]);
      const pendingElsewhere = await invite(hElse, emailOf('p5').toUpperCase(), elsewhere);
      const someoneElse = await invite(h, `rls-del-someone-${stamp}@example.test`, o);

      await deleteAccount(p); // its residue scan includes P's email

      for (const id of [accepted, acceptedOldAddress, revoked, pendingElsewhere]) {
        expect({ id, row: await row('household_invitations', id) }).toEqual({ id, row: null });
      }
      expect(await row('household_invitations', someoneElse)).toMatchObject({
        household_id: h,
        invited_by: o,
      });

      // Red state without the trigger: current stays 100 against a sum of 70.
      expect(await row('goals', g)).not.toBeNull();
      expect(await goalTotals(g)).toEqual({ current: 70, sum: 70 });
      // Red state without the shared-only guard: current becomes 20.
      expect(await goalTotals(gUnshared)).toEqual({ current: 50, sum: 20 });
    });

    it("6. a PLAIN member's shared objects go to the owner - the same rule removeMember uses - and only theirs", async () => {
      const o = await makeUser('o6');
      const p = await makeUser('p6');
      const m = await makeUser('m6');
      const h = await household('H6', o, [
        { id: o, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: p, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
        { id: m, role: 'member', joinedAt: '2026-03-01T00:00:00Z' },
      ]);
      // current = SUM(contributions), as the service keeps a shared goal.
      const pGoal = await goal(p, 'Sofa', h, 80);
      await contribute(pGoal, o, 50);
      await contribute(pGoal, m, 25);
      await contribute(pGoal, p, 5);
      const pCat = await category(p, 'P6-Shared', h);
      const mTx = await tx(m, pCat, h);
      const pBudget = await seedSingle<{ id: string }>(
        svc()
          .from('category_budgets')
          .insert({
            user_id: p,
            household_id: h,
            category_id: pCat,
            period: 'monthly',
            limit_amount: 80,
          })
          .select('id')
          .single(),
        "P's shared budget"
      );
      // A 100-character name the owner already uses: the suffix must fit VARCHAR(100).
      const longName = 'L'.repeat(100);
      const pLong = await category(p, longName, h);
      await category(o, longName);
      // Another member's OWN shared category: the scope guard - it must not move.
      const mCat = await category(m, 'M6-Shared', h);

      await deleteAccount(p);

      // The scope guard first, so a mutant that moves every member's shared rows
      // is attributed here and not masked by a later assertion.
      expect((await row<{ user_id: string }>('categories', mCat))?.user_id).toBe(m);
      expect((await row<{ user_id: string }>('goals', pGoal))?.user_id).toBe(o);
      expect((await row<{ user_id: string }>('categories', pCat))?.user_id).toBe(o);
      expect((await row<{ category_id: string }>('transactions', mTx))?.category_id).toBe(pCat);
      expect((await row<{ user_id: string }>('category_budgets', pBudget.id))?.user_id).toBe(o);
      expect(await row<{ user_id: string; name: string }>('categories', pLong)).toMatchObject({
        user_id: o,
        name: `${'L'.repeat(98)} 2`,
      });
      // Down by exactly P's 5.
      expect(await goalTotals(pGoal)).toEqual({ current: 75, sum: 75 });
    });

    it('7. the new owner is the LONGEST-STANDING member: earliest joined_at, ties to the lowest user_id, never a NULL join date - and only they become admin', async () => {
      const c = await makeUser('c7');
      const late = await makeUser('late7');
      const tieA = await makeUser('tieA7');
      const tieB = await makeUser('tieB7');
      const undated = await makeUser('undated7');
      const h = await household('H7', c, [
        { id: c, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: late, role: 'member', joinedAt: '2026-05-01T00:00:00Z' },
        { id: tieA, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
        { id: tieB, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
        { id: undated, role: 'member', joinedAt: null },
      ]);
      const expected = [tieA, tieB].sort()[0]!;

      await deleteAccount(c);

      expect((await row<{ created_by: string }>('households', h))?.created_by).toBe(expected);
      const roles = await rolesIn(h);
      expect(roles).toHaveLength(4);
      expect(roles.filter((r) => r.role === 'admin')).toEqual([
        { user_id: expected, role: 'admin' },
      ]);
    });
  }
);
