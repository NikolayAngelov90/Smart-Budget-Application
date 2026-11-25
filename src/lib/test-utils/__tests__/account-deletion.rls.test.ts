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
  signInAsTestUser,
  pinAppServiceRoleToLocalStack,
  assertAppPinnedToLocalStack,
} from '@/lib/test-utils/rlsClient';
import { deleteUserAccount } from '@/lib/services/settingsService';
import { removeMember } from '@/lib/services/householdMemberService';
import {
  AccountDeletionRefusedError,
  resolveRefusalNames,
} from '@/lib/services/accountDeletionRefusal';

// Each real deletion is followed by a residue scan of every column in three
// schemas (hundreds of catalog queries); a test that deletes three people does
// that three times. Jest's 5 s default timed test 11 out in a full run.
jest.setTimeout(60_000);

const PWD = 'rls-test-passw0rd!';
const stamp = Date.now();
const svc = () => createServiceClient();

/** Users still alive, deleted in afterAll through the same path. */
const toCleanUp: string[] = [];
/** Every test user's email: the residue scan looks for it as well as the id. */
// null = the account has NO email (phone/OAuth-without-email, or blanked):
// there is nothing of that kind to leave behind. undefined = never recorded.
const emails = new Map<string, string | null>();
/**
 * Every test user's DISPLAY NAME: the scan looks for it too (P2). A notice that
 * said "Ivan left" would store the departing person's name without their id or
 * email, so neither of those scans could see it. Same convention as `emails`:
 * null = the account has no display name; undefined = never recorded.
 */
const displayNames = new Map<string, string | null>();

function forget(userId: string): void {
  const i = toCleanUp.indexOf(userId);
  if (i >= 0) toCleanUp.splice(i, 1);
}

function emailOf(tag: string): string {
  return `rls-del-${tag}-${stamp}@example.test`;
}

/** Distinctive on purpose: a substring scan must not match ordinary text. */
function displayNameOf(tag: string): string {
  return `Rls Person ${tag} ${stamp}`;
}

/** Sets the profile's display name (the signup trigger made the row) and records it. */
async function giveDisplayName(id: string, tag: string): Promise<void> {
  const name = displayNameOf(tag);
  const { error } = await svc().from('user_profiles').update({ display_name: name }).eq('id', id);
  if (error) throw new Error(`seed display name for ${tag}: ${error.message}`);
  displayNames.set(id, name);
}

async function makeUser(tag: string): Promise<string> {
  const email = emailOf(tag);
  const id = await createTestUser(email, PWD);
  toCleanUp.push(id);
  emails.set(id, email);
  await giveDisplayName(id, tag);
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
async function deleteAccount(userId: string, allowed: Allowance[] = []): Promise<void> {
  assertAppPinnedToLocalStack();
  await deleteUserAccount(userId); // throws "Failed to ..." on either step
  forget(userId);
  await expectNoResidue(userId, allowed);
}

/**
 * A RAW auth delete - no preparation, no service: what the Supabase dashboard or
 * any other admin path does. The auth.users trigger must still do its part.
 */
async function deleteRaw(userId: string, allowed: Allowance[] = []): Promise<void> {
  const { error } = await svc().auth.admin.deleteUser(userId);
  if (error) throw new Error(`raw admin.deleteUser failed: ${error.message}`);
  forget(userId);
  await expectNoResidue(userId, allowed);
}

/** Direct SQL on the LOCAL test database (LOCAL_DB_URL), for catalog reads and fixtures the API cannot make. */
async function db<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const url = process.env.LOCAL_DB_URL;
  if (!url) throw new Error('NOT MEASURED - LOCAL_DB_URL is unset');
  const pg = new Client({ connectionString: url });
  await pg.connect();
  try {
    return (await pg.query<T>(text, params)).rows;
  } finally {
    await pg.end();
  }
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

type Notice = {
  id?: string;
  kind: string;
  cause: string;
  household_id: string | null;
  params: Record<string, unknown>;
};

/** A person's account notices, sorted by kind, read with the service role. */
async function noticesFor(userId: string, withId = false): Promise<Notice[]> {
  const { data, error } = await svc()
    .from('account_notices')
    .select('id, kind, cause, household_id, params')
    .eq('recipient_id', userId)
    .order('kind');
  if (error) throw new Error(`read notices for ${userId}: ${error.message}`);
  return ((data ?? []) as Required<Notice>[]).map(({ id, ...rest }) =>
    withId ? { id, ...rest } : rest
  );
}

/** Notices STAGED for a deletion that has not happened (yet), read directly. */
async function stagedFor(departingUserId: string): Promise<number> {
  const rows = await db<{ n: number }>(
    'select count(*)::int as n from private.pending_account_notices where departing_user = $1',
    [departingUserId]
  );
  return rows[0]!.n;
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
 * Every column of every app table (schemas public, storage and private - where
 * staged account notices wait) that could hold a
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
  email?: string,
  displayName?: string
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
        where n.nspname in ('public', 'storage', 'private') and t.relkind in ('r', 'p')
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
      // The DISPLAY NAME, the same way: what a stored notice naming the person
      // would hold, with neither their id nor their email in it.
      if (displayName && r.kind === 'text') {
        const dr = await pg.query<{ n: number }>(
          `select count(*)::int as n from ${pg.escapeIdentifier(r.sch)}.${pg.escapeIdentifier(r.tbl)}
            where position(lower($1) in lower(${col}::text)) > 0`,
          [displayName]
        );
        if (dr.rows[0]!.n > 0) hits.push(`${name(r)}: ${dr.rows[0]!.n} (display name)`);
      }
    }
    return { fkColumns, scanned: rows.map(name), hits };
  } finally {
    await pg.end();
  }
}

/**
 * A hit the design KEEPS on purpose, with the reason. Each one must actually be
 * found - an allowance that matches nothing fails - so it can never quietly
 * outlive the row it excuses.
 */
type Allowance = { hit: string; why: string };

async function expectNoResidue(userId: string, allowed: Allowance[] = []): Promise<void> {
  const email = emails.get(userId);
  if (email === undefined)
    throw new Error(`NOT MEASURED - no email recorded for ${userId}, so the email scan cannot run`);
  const displayName = displayNames.get(userId);
  if (displayName === undefined)
    throw new Error(
      `NOT MEASURED - no display name recorded for ${userId}, so the display-name scan cannot run`
    );
  const { hits } = await referencesTo(userId, email ?? undefined, displayName ?? undefined);
  const allowedHits = allowed.map((a) => a.hit);
  expect({ userId, allowedFound: allowedHits.filter((h) => hits.includes(h)) }).toEqual({
    userId,
    allowedFound: allowedHits,
  });
  expect({ userId, hits: hits.filter((h) => !allowedHits.includes(h)) }).toEqual({
    userId,
    hits: [],
  });
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
      // Each survivor is deleted through the real service AND residue-scanned
      // (hundreds of catalog queries each), so this outlives Jest's 5 s default.
    }, 180_000);

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
      // Nobody stays, so nobody is told: nothing staged, nothing published.
      expect(
        await db<{ n: number }>(
          "select count(*)::int as n from public.account_notices where params->>'household' = 'H3'"
        )
      ).toEqual([{ n: 0 }]);

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

      const r = await referencesTo(live, emailOf('live'), displayNameOf('live').toUpperCase());
      // The enumeration: the auth.users FKs are all inside it (the 26 classified in
      // the spec; more is allowed, fewer means it is broken), and it is WIDER than
      // them - otherwise it could never fail.
      expect(r.fkColumns).toEqual(
        expect.arrayContaining(['public.transactions.user_id', 'public.households.created_by'])
      );
      expect(r.fkColumns.length).toBeGreaterThanOrEqual(26);
      expect(r.scanned).toEqual(expect.arrayContaining(r.fkColumns));
      expect(r.scanned.length).toBeGreaterThan(r.fkColumns.length);
      // MUST-FIND: the private schema is scanned too - where staged account
      // notices wait, holding a departing person's id until their deletion.
      expect(r.scanned).toEqual(
        expect.arrayContaining([
          'private.pending_account_notices.departing_user',
          'private.pending_account_notices.params',
        ])
      );
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
          // MUST-FIND for the display-name scan, searched for in capitals: the
          // living user's own profile. Without it, "no display-name hits" for a
          // deleted user is also what a scan that never looks returns.
          'public.user_profiles.display_name: 1 (display name)',
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

    it('8. privileges and structure: no client can EXECUTE any of the five functions, definer only where needed, search_path pinned, the auth trigger is BEFORE DELETE, and nothing on household_invitations can veto a deletion', async () => {
      const FIVE = [
        'prepare_account_deletion',
        'reassign_member_shared_objects',
        'recompute_shared_goal_totals',
        'enforce_household_owner_server_only',
        'delete_invitations_addressed_to_deleted_user',
      ];
      const fns = await db<{
        name: string;
        owner: string;
        definer: boolean;
        config: string | null;
        anon: boolean;
        authed: boolean;
        service: boolean;
      }>(
        `select p.proname as name, pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
                array_to_string(p.proconfig, ',') as config,
                has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
                has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed,
                has_function_privilege('service_role', p.oid, 'EXECUTE') as service
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = any($1) order by 1`,
        [FIVE]
      );
      // MUST-FIND: all five, or every absence below is NOT MEASURED.
      if (fns.length !== 5) {
        throw new Error(
          `NOT MEASURED - found ${fns.length} of the 5 functions: ${fns.map((f) => f.name).join(', ')}`
        );
      }
      // No client role can execute any of them.
      expect(fns.filter((f) => f.anon || f.authed).map((f) => f.name)).toEqual([]);
      // PAIRED: the grant check can see a grant - the server's two RPCs have one.
      expect(fns.filter((f) => f.service).map((f) => f.name)).toEqual(
        expect.arrayContaining(['prepare_account_deletion', 'reassign_member_shared_objects'])
      );
      // DEFINER only where needed: the created_by guard must run as the CALLER
      // (it reads auth.uid()); the rest write rows their callers cannot.
      expect(fns.filter((f) => !f.definer).map((f) => f.name)).toEqual([
        'enforce_household_owner_server_only',
      ]);
      // search_path pinned on all five (038), owner as the migration intends.
      expect(fns.filter((f) => f.config !== 'search_path=public').map((f) => f.name)).toEqual([]);
      expect(fns.filter((f) => f.owner !== 'postgres').map((f) => f.name)).toEqual([]);

      // The auth.users trigger: BEFORE (accepted_by still holds the id), DELETE,
      // per ROW, bound to the function. The drift dump now reads it in production.
      const trig = await db<{ def: string }>(
        `select pg_get_triggerdef(t.oid) as def from pg_trigger t
          where t.tgrelid = 'auth.users'::regclass and t.tgname = 'on_auth_user_deleted_remove_invitations'`
      );
      expect(trig).toHaveLength(1);
      expect(trig[0]!.def).toMatch(
        /BEFORE DELETE ON auth\.users FOR EACH ROW EXECUTE FUNCTION (public\.)?delete_invitations_addressed_to_deleted_user\(\)/
      );

      // Nothing on household_invitations can make the trigger RAISE inside every
      // account deletion: no FK points at it, no trigger or rule on it, RLS not
      // forced on its owner (the definer), and that owner is the function's.
      const veto = await db<{ what: string; n: number }>(
        `select 'fk referencing it' as what, count(*)::int as n from pg_constraint
          where contype = 'f' and confrelid = 'public.household_invitations'::regclass
         union all select 'user triggers on it', count(*)::int from pg_trigger
          where tgrelid = 'public.household_invitations'::regclass and not tgisinternal
         union all select 'rules on it', count(*)::int from pg_rewrite
          where ev_class = 'public.household_invitations'::regclass
         union all select 'forced rls', (relforcerowsecurity)::int from pg_class
          where oid = 'public.household_invitations'::regclass
         union all select 'owner is not postgres', (pg_get_userbyid(relowner) <> 'postgres')::int from pg_class
          where oid = 'public.household_invitations'::regclass
         order by 1`
      );
      expect(veto).toEqual([
        { what: 'fk referencing it', n: 0 },
        { what: 'forced rls', n: 0 },
        { what: 'owner is not postgres', n: 0 },
        { what: 'rules on it', n: 0 },
        { what: 'user triggers on it', n: 0 },
      ]);
    });

    it("9. the email rule, adversarially: case and whitespace on BOTH sides, near-misses kept, another person's acceptance kept - and it fires on a RAW auth delete with no preparation", async () => {
      // The ACCOUNT address in mixed case ("Niki@x.bg"), invitations in other forms.
      const tag = 'mixed9';
      const mixedAccount = `Rls-Del-Mixed9-${stamp}@Example.Test`;
      const mixed = await createTestUser(mixedAccount, PWD);
      toCleanUp.push(mixed);
      emails.set(mixed, mixedAccount);
      await giveDisplayName(mixed, tag);
      const lower = mixedAccount.toLowerCase();

      const owner = await makeUser('own9');
      const hA = await household('H9-a', owner, [
        { id: owner, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
      ]);
      const owner2 = await makeUser('own9b');
      const hB = await household('H9-b', owner2, [
        { id: owner2, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
      ]);
      const owner3 = await makeUser('own9c');
      const hC = await household('H9-c', owner3, [
        { id: owner3, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
      ]);

      const padded = await invite(hA, `  ${lower}  `, owner); // whitespace around it
      const shouted = await invite(
        hB,
        `RLS-DEL-${tag.toUpperCase()}-${stamp}@example.TEST`,
        owner2
      ); // other casing
      // NEAR-MISSES: other people's addresses that merely CONTAIN this one.
      const prefixed = await invite(hA, `x${lower}`, owner);
      const suffixed = await invite(hA, `${lower}.evil`, owner);
      // ANOTHER person accepted an invitation at this same address earlier (they
      // have since changed theirs): that acceptance is THEIR record, and stays.
      const y = await makeUser('y9');
      const yAccepted = await invite(hC, lower, owner3, {
        status: 'accepted',
        accepted_by: y,
        accepted_at: '2026-01-10T00:00:00Z',
      });

      await deleteRaw(mixed, [
        {
          hit: 'public.household_invitations.email: 3 (email)',
          why: "the two near-misses CONTAIN the address (the scan is a substring search) and y's acceptance IS the address - all three kept by design",
        },
      ]);

      for (const id of [padded, shouted]) {
        expect({ id, row: await row('household_invitations', id) }).toEqual({ id, row: null });
      }
      for (const id of [prefixed, suffixed, yAccepted]) {
        expect({ id, kept: (await row('household_invitations', id)) !== null }).toEqual({
          id,
          kept: true,
        });
      }
      expect(await row('household_invitations', yAccepted)).toMatchObject({
        accepted_by: y,
        status: 'accepted',
      });
    });

    it('10. accounts with NO usable or PROVEN email: a NULL or blank address deletes cleanly and matches nothing; an UNCONFIRMED address is not treated as theirs', async () => {
      const owner = await makeUser('own10');
      const h = await household('H10', owner, [
        { id: owner, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
      ]);
      const unrelated = await invite(h, `rls-del-unrelated10-${stamp}@example.test`, owner);

      for (const [tag, value] of [
        ['null10', null],
        ['blank10', '   '],
      ] as const) {
        const u = await makeUser(tag);
        // Accepted under an address the account no longer has; only accepted_by finds it.
        const acc = await invite(h, `rls-del-${tag}-former-${stamp}@example.test`, owner, {
          status: 'accepted',
          accepted_by: u,
          accepted_at: '2026-01-05T00:00:00Z',
        });
        // What a phone/OAuth sign-up without an email looks like (NULL), and a
        // blank one: made directly, because the API cannot make either.
        await db('update auth.users set email = $2 where id = $1', [u, value]);
        emails.set(u, null);

        await deleteAccount(u); // must not raise

        expect({ tag, accepted: await row('household_invitations', acc) }).toEqual({
          tag,
          accepted: null,
        });
        expect({
          tag,
          unrelatedKept: (await row('household_invitations', unrelated)) !== null,
        }).toEqual({
          tag,
          unrelatedKept: true,
        });
      }

      // UNCONFIRMED: the address is not proven to be this account's. Deleting a
      // never-confirmed sign-up (e.g. a dashboard spam clean-up) must not wipe the
      // real owner's invitations.
      const squatAddr = `rls-del-unconfirmed10-${stamp}@example.test`;
      const { data: created, error } = await svc().auth.admin.createUser({
        email: squatAddr,
        password: PWD,
        email_confirm: false,
      });
      if (error || !created.user) throw new Error(`create unconfirmed user: ${error?.message}`);
      const squatter = created.user.id;
      toCleanUp.push(squatter);
      emails.set(squatter, squatAddr);
      await giveDisplayName(squatter, 'squat10');
      const realOwnersInvite = await invite(h, squatAddr, owner);

      await deleteAccount(squatter, [
        {
          hit: 'public.household_invitations.email: 1 (email)',
          why: "addressed to an UNCONFIRMED address - not proven to be the deleted account's, so kept",
        },
      ]);
      expect(await row('household_invitations', realOwnersInvite)).toMatchObject({
        status: 'pending',
      });
    });
    it('11. a REFUSED deletion through the real service reports what the preparation did, and names the household and its new owner through the person’s own session (spec-account-deletion-refused-message)', async () => {
      // A creator with a member and a SHARED category: prepare transfers H AND
      // moves the category - the case in which the dialog must say shared items moved.
      const c = await makeUser('c11');
      const m = await makeUser('m11');
      const h = await household('H11', c, [
        { id: c, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: m, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);
      const shared = await category(c, 'C11-Shared', h);
      // A PLAIN member with a shared category in another household: nothing is
      // transferred, but the category goes to that household's owner.
      const o = await makeUser('o11');
      const p = await makeUser('p11');
      const h2 = await household('H11-b', o, [
        { id: o, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: p, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);
      const pShared = await category(p, 'P11-Shared', h2);
      // A user in no household: the refusal changes nothing of theirs.
      const loner = await makeUser('loner11');

      // A REAL refusal, after a real preparation: a fixture-only table whose
      // RESTRICT foreign key prepare knows nothing about, so GoTrue's delete of
      // auth.users fails exactly as a production refusal does.
      // A run killed mid-test must not wedge every later one.
      await db('DROP TABLE IF EXISTS public.rls_refusal_blocker');
      await db(
        'CREATE TABLE public.rls_refusal_blocker (user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT)'
      );
      let creatorResult: unknown;
      let memberResult: unknown;
      let lonerResult: unknown;
      try {
        await db('INSERT INTO public.rls_refusal_blocker (user_id) VALUES ($1), ($2), ($3)', [
          c,
          p,
          loner,
        ]);
        creatorResult = await deleteUserAccount(c).catch((e: unknown) => e);
        memberResult = await deleteUserAccount(p).catch((e: unknown) => e);
        lonerResult = await deleteUserAccount(loner).catch((e: unknown) => e);
      } finally {
        await db('DROP TABLE IF EXISTS public.rls_refusal_blocker');
      }

      // The service confirmed the refusal (both users still exist) and carried
      // prepare's OWN result.
      expect(creatorResult).toBeInstanceOf(AccountDeletionRefusedError);
      expect(creatorResult).toMatchObject({ ownershipTransferred: true, sharedObjectsMoved: true });
      expect(memberResult).toBeInstanceOf(AccountDeletionRefusedError);
      expect(memberResult).toMatchObject({ ownershipTransferred: false, sharedObjectsMoved: true });
      expect(lonerResult).toBeInstanceOf(AccountDeletionRefusedError);
      expect(lonerResult).toMatchObject({ ownershipTransferred: false, sharedObjectsMoved: false });

      // ...and that result matches the database: M owns H, and C's shared category
      // now belongs to M. This is the state the dialog text must describe.
      expect((await row<{ created_by: string }>('households', h))?.created_by).toBe(m);
      expect((await row<{ user_id: string }>('categories', shared))?.user_id).toBe(m);
      expect((await row<{ created_by: string }>('households', h2))?.created_by).toBe(o);
      expect((await row<{ user_id: string }>('categories', pShared))?.user_id).toBe(o);

      // The names, through C's OWN session (RLS bounds it to what C can see).
      const asC = await signInAsTestUser(emailOf('c11'), PWD);
      await expect(resolveRefusalNames(asC, c)).resolves.toEqual({
        household: 'H11',
        owner: emailOf('m11'),
      });
      const asP = await signInAsTestUser(emailOf('p11'), PWD);
      await expect(resolveRefusalNames(asP, p)).resolves.toEqual({
        household: 'H11-b',
        owner: emailOf('o11'),
      });
      // PAIRED: a session that is not in the household cannot name it.
      const asLoner = await signInAsTestUser(emailOf('loner11'), PWD);
      await expect(resolveRefusalNames(asLoner, loner)).resolves.toBeNull();

      // A NOTICE EXISTS ONLY IF ITS EVENT HAPPENED: the refused deletion told M
      // nothing (no "its creator deleted their account" while C still exists).
      // The notice is STAGED, waiting for a deletion that may still come.
      expect(await noticesFor(m)).toEqual([]);
      expect(await stagedFor(c)).toBeGreaterThan(0);

      // With the blocker gone, the retry deletes both (afterAll would too; doing it
      // here residue-scans them inside this test).
      await deleteAccount(c);
      await deleteAccount(p);
      await deleteAccount(loner);

      // The deletion happened, so its notice is published - and the staged row,
      // the only place C's id was held, went with C's auth row.
      expect((await noticesFor(m)).map((n) => n.kind)).toEqual(['household_transferred']);
      expect(await stagedFor(c)).toBe(0);

      // The REAL shape of "this user does not exist", which deleteUserAccount
      // reads as "the deletion happened": 404 AND code user_not_found. A bare 404
      // is deliberately not enough, so the code must really be there.
      const { data: gone, error: goneError } = await svc().auth.admin.getUserById(c);
      expect(gone.user).toBeNull();
      expect(goneError).toMatchObject({ status: 404, code: 'user_not_found' });
    });
    // -------------------------------------------------------------------------
    // ACCOUNT NOTICES (spec-account-deletion-notifications). A deletion's notices
    // are STAGED by prepare and PUBLISHED by the auth.users trigger in the
    // deletion's own transaction; a removal's are written in the removal's one
    // transaction. The residue scan above (id, email, DISPLAY NAME; public,
    // storage, private) runs inside every deleteAccount().
    // -------------------------------------------------------------------------

    it('12. a creator leaves: the new owner is told everything that changed for them - and nothing names the creator', async () => {
      const c = await makeUser('c12');
      const m = await makeUser('m12');
      const h = await household('H12', c, [
        { id: c, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: m, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);
      // C's SHARED category whose name M already uses: moved to M and renamed.
      const shared = await category(c, 'Food12', h);
      await category(m, 'Food12');
      // A shared category M does NOT have: moved, not renamed - no notice for it.
      await category(c, 'Unique12', h);
      // C's shared goal and budget: moved to M.
      await goal(c, 'Trip12', h, 0);
      await seedSingle(
        svc()
          .from('category_budgets')
          .insert({
            user_id: c,
            household_id: h,
            category_id: shared,
            period: 'monthly',
            limit_amount: 50,
          })
          .select('id')
          .single(),
        "C's shared budget"
      );
      // C's PERSONAL category that M used: copied to M.
      const personal = await category(c, 'Hobby12');
      await tx(m, personal);
      // C's personal category whose name M ALREADY has: M's rows move to M's own
      // "Books12" (REUSED, not copied), so it must not be listed as a copy.
      const cBooks = await category(c, 'Books12');
      await category(m, 'Books12');
      await tx(m, cBooks);
      // Two more copies, to pin "sorted, distinct": a name that sorts FIRST, and
      // the SAME name as Hobby12 but of the other type (copied too, listed once).
      const art = await category(c, 'Art12');
      await tx(m, art);
      const hobbyIncome = await seedSingle<{ id: string }>(
        svc()
          .from('categories')
          .insert({ user_id: c, name: 'Hobby12', color: '#123456', type: 'income' })
          .select('id')
          .single(),
        "C's income Hobby12"
      );
      await tx(m, hobbyIncome.id, null, { type: 'income' });

      await deleteAccount(c); // its residue scan searches C's id, email AND display name

      expect(await noticesFor(m)).toEqual([
        {
          kind: 'categories_copied',
          cause: 'account_deleted',
          household_id: null,
          params: { categories: ['Art12', 'Hobby12'], shared_household: true },
        },
        {
          kind: 'category_renamed',
          cause: 'account_deleted',
          household_id: h,
          params: { household: 'H12', from: 'Food12', to: 'Food12 2' },
        },
        {
          kind: 'household_transferred',
          cause: 'account_deleted',
          household_id: h,
          // every candidate had a join date, so "longest-standing" is KNOWN
          params: { household: 'H12', seniority: true },
        },
        {
          kind: 'shared_plans_received',
          cause: 'account_deleted',
          household_id: h,
          params: { household: 'H12', goals: 1, budgets: 1 },
        },
      ]);

      // A recipient's notices go with their OWN account.
      await deleteAccount(m);
      expect(await noticesFor(m)).toEqual([]);
    });

    it('12b. the texts claim only what the database knew: no seniority without join dates, no "household member" for someone outside the household', async () => {
      const c = await makeUser('c12b');
      const m = await makeUser('m12b');
      const outsider = await makeUser('x12b');
      const h = await household('H12b', c, [
        { id: c, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: m, role: 'member', joinedAt: null }, // no join date: the pick fell back to id order
      ]);
      // Someone NOT in C's household whose rows use C's category (e.g. a former member).
      const cCat = await category(c, 'Shared12b');
      await tx(outsider, cCat);

      await deleteAccount(c);

      expect((await noticesFor(m)).find((n) => n.kind === 'household_transferred')).toMatchObject({
        household_id: h,
        params: { household: 'H12b', seniority: false },
      });
      expect(await noticesFor(outsider)).toEqual([
        {
          kind: 'categories_copied',
          cause: 'account_deleted',
          household_id: null,
          params: { categories: ['Shared12b'], shared_household: false },
        },
      ]);
    });

    it('13. a plain member leaves: the owner is told about the renamed category and the shared goal; nobody else is told anything', async () => {
      const o = await makeUser('o13');
      const p = await makeUser('p13');
      const bystander = await makeUser('b13');
      const h = await household('H13', o, [
        { id: o, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: p, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
        { id: bystander, role: 'member', joinedAt: '2026-03-01T00:00:00Z' },
      ]);
      await category(p, 'Rent13', h);
      await category(o, 'Rent13');
      await goal(p, 'Sofa13', h, 0);

      await deleteAccount(p);

      expect(await noticesFor(o)).toEqual([
        {
          kind: 'category_renamed',
          cause: 'account_deleted',
          household_id: h,
          params: { household: 'H13', from: 'Rent13', to: 'Rent13 2' },
        },
        {
          kind: 'shared_plans_received',
          cause: 'account_deleted',
          household_id: h,
          params: { household: 'H13', goals: 1, budgets: 0 },
        },
      ]);
      expect(await noticesFor(bystander)).toEqual([]);
    });

    it('14. removeMember: the owner is told with cause member_removed; the removed person gets no notice', async () => {
      const o = await makeUser('o14');
      const r = await makeUser('r14');
      const h = await household('H14', o, [
        { id: o, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: r, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);
      const rCat = await category(r, 'Gym14', h);
      await category(o, 'Gym14');
      await seedSingle(
        svc()
          .from('category_budgets')
          .insert({
            user_id: r,
            household_id: h,
            category_id: rCat,
            period: 'monthly',
            limit_amount: 30,
          })
          .select('id')
          .single(),
        "R's shared budget"
      );

      await removeMember(o, r); // the real service, as the route calls it

      expect(await noticesFor(o)).toEqual([
        {
          kind: 'category_renamed',
          cause: 'member_removed',
          household_id: h,
          params: { household: 'H14', from: 'Gym14', to: 'Gym14 2' },
        },
        {
          kind: 'shared_plans_received',
          cause: 'member_removed',
          household_id: h,
          params: { household: 'H14', goals: 0, budgets: 1 },
        },
      ]);
      expect(await noticesFor(r)).toEqual([]);
      expect(await countRows('household_members', { household_id: h, user_id: r })).toBe(0);

      // ONE TRANSACTION: a removal that fails rolls back the move AND its notice.
      // Someone who still owns a shared category in H but is no longer a member:
      // the move would succeed, the membership delete finds nothing and raises.
      const ghost = await makeUser('g14');
      await db(
        'insert into public.household_members (household_id, user_id, role) values ($1, $2, $3)',
        [h, ghost, 'member']
      );
      const ghostCat = await category(ghost, 'Gym14', h);
      await db('delete from public.household_members where household_id = $1 and user_id = $2', [
        h,
        ghost,
      ]);
      const before = (await noticesFor(o)).length;

      const { error } = await svc().rpc('remove_household_member', {
        p_household: h,
        p_member: ghost,
      });

      expect(error).not.toBeNull();
      expect(await row<{ user_id: string; name: string }>('categories', ghostCat)).toMatchObject({
        user_id: ghost, // not moved: rolled back
        name: 'Gym14',
      });
      expect((await noticesFor(o)).length).toBe(before); // no "a member was removed"
    });

    it('15. OFF THE CRITICAL PATH: a notice that cannot be STAGED, PUBLISHED or WRITTEN never stops a deletion or a removal', async () => {
      const c = await makeUser('c15');
      const m = await makeUser('m15');
      const h = await household('H15', c, [
        { id: c, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: m, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);
      const cShared = await category(c, 'Food15', h);
      await category(m, 'Food15');
      const o = await makeUser('o15');
      const r = await makeUser('r15');
      const h2 = await household('H15-b', o, [
        { id: o, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: r, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);
      const rShared = await category(r, 'Gym15', h2);
      await category(o, 'Gym15');
      const c2 = await makeUser('c15b');
      const m2 = await makeUser('m15b');
      const h3 = await household('H15-c', c2, [
        { id: c2, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: m2, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);

      const force = async (table: string) => {
        await db(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS rls_force_notice_failure`);
        await db(
          `ALTER TABLE ${table} ADD CONSTRAINT rls_force_notice_failure CHECK (false) NOT VALID`
        );
      };
      const release = (table: string) =>
        db(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS rls_force_notice_failure`);

      // PHASE A - staging WORKS, publication and the removal's write FAIL. Run the
      // preparation first so there IS something staged for the trigger to try to
      // publish (otherwise its INSERT selects nothing and its savepoint is never
      // exercised - the gap mutant V3 found).
      expect((await prepare(c)).ownership_transferred).toBe(true);
      expect(await stagedFor(c)).toBeGreaterThan(0); // the control: publication WILL be attempted
      await force('public.account_notices');
      try {
        await deleteAccount(c); // throws if the deletion failed; then residue-scans C
        await removeMember(o, r); // throws if the removal failed
      } finally {
        await release('public.account_notices');
      }

      // PHASE B - STAGING fails (prepare's notice for the new owner).
      await force('private.pending_account_notices');
      try {
        await deleteAccount(c2);
      } finally {
        await release('private.pending_account_notices');
      }

      // The changes happened exactly as without notices...
      expect((await row<{ created_by: string }>('households', h))?.created_by).toBe(m);
      expect(await row<{ user_id: string; name: string }>('categories', cShared)).toMatchObject({
        user_id: m,
        name: 'Food15 2',
      });
      expect(await countRows('household_members', { household_id: h2, user_id: r })).toBe(0);
      expect(await row<{ user_id: string; name: string }>('categories', rShared)).toMatchObject({
        user_id: o,
        name: 'Gym15 2',
      });
      expect((await row<{ created_by: string }>('households', h3))?.created_by).toBe(m2);
      // ...and the forced failures really did stop every notice (the controls).
      expect(await noticesFor(m)).toEqual([]);
      expect(await noticesFor(o)).toEqual([]);
      expect(await noticesFor(m2)).toEqual([]);
      expect(await stagedFor(c)).toBe(0); // went with C's auth row
    });

    it("16. notices are read-own and written only by the server: no client can insert, update, delete or see another person's; the new functions are definer-only with a pinned search_path", async () => {
      const o = await makeUser('o16');
      const p = await makeUser('p16');
      const outsider = await makeUser('x16');
      const h = await household('H16', o, [
        { id: o, role: 'admin', joinedAt: '2026-01-01T00:00:00Z' },
        { id: p, role: 'member', joinedAt: '2026-02-01T00:00:00Z' },
      ]);
      await goal(p, 'Goal16', h, 0);
      await deleteAccount(p);
      const [own] = await noticesFor(o, true);
      expect(own).toBeDefined(); // MUST-FIND: there is a notice to protect
      const ownId = own!.id!;

      const asOwner = await signInAsTestUser(emailOf('o16'), PWD);
      const asOutsider = await signInAsTestUser(emailOf('x16'), PWD);

      // Read: own yes, someone else's no.
      const mine = await asOwner.from('account_notices').select('id').eq('id', ownId);
      expect(mine.error).toBeNull();
      expect(mine.data).toHaveLength(1);
      const theirs = await asOutsider.from('account_notices').select('id').eq('id', ownId);
      expect(theirs.error).toBeNull();
      expect(theirs.data).toHaveLength(0);

      // Write: nothing, not even the recipient dismissing through PostgREST.
      const ins = await asOwner.from('account_notices').insert({
        recipient_id: o,
        kind: 'household_transferred',
        cause: 'account_deleted',
        params: {},
      });
      expect(ins.error?.code).toBe('42501');
      const upd = await asOwner
        .from('account_notices')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', ownId)
        .select('id');
      expect(upd.error?.code).toBe('42501');
      const del = await asOwner.from('account_notices').delete().eq('id', ownId).select('id');
      expect(del.error?.code).toBe('42501');
      expect(
        (await row<{ dismissed_at: string | null }>('account_notices', ownId))?.dismissed_at
      ).toBeNull();
      void outsider;

      // The functions: SECURITY DEFINER, search_path pinned, no client EXECUTE.
      const fns = await db<{
        fn: string;
        definer: boolean;
        config: string[] | null;
        client_exec: boolean;
      }>(
        `select p.oid::regprocedure::text as fn, p.prosecdef as definer, p.proconfig as config,
                (has_function_privilege('anon', p.oid, 'EXECUTE')
                 or has_function_privilege('authenticated', p.oid, 'EXECUTE')) as client_exec
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where (n.nspname, p.proname) in (('private', 'record_account_notice'),
                                           ('private', 'move_member_shared_objects'),
                                           ('private', 'publish_account_notices'),
                                           ('public', 'remove_household_member'))
          order by 1`
      );
      expect(fns.map((f) => f.fn)).toEqual([
        'private.move_member_shared_objects(uuid,uuid,text)',
        'private.publish_account_notices()',
        'private.record_account_notice(uuid,text,text,uuid,jsonb,uuid)',
        'remove_household_member(uuid,uuid)',
      ]);
      for (const f of fns) {
        expect({ fn: f.fn, definer: f.definer, clientExec: f.client_exec }).toEqual({
          fn: f.fn,
          definer: true,
          clientExec: false,
        });
        expect(f.config).toEqual(expect.arrayContaining(['search_path=public']));
      }

      // The staging table holds a departing person's id while they exist: no
      // client may touch it at all.
      const staged = await db<{ priv: string; anon: boolean; authed: boolean }>(
        `select p.priv,
                has_table_privilege('anon', 'private.pending_account_notices', p.priv) as anon,
                has_table_privilege('authenticated', 'private.pending_account_notices', p.priv) as authed
           from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p(priv)`
      );
      expect(staged.filter((x) => x.anon || x.authed)).toEqual([]);
      expect(staged).toHaveLength(4); // MUST-FIND: all four privileges were checked
    });
  }
);
