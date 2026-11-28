/**
 * @jest-environment node
 *
 * Names in any script (spec-cyrillic-names), at the DATABASE layer.
 *
 * The app's one rule (src/lib/validation/names.ts) and the database's
 * never-allowed half (public.is_clean_name, a CHECK on every name column) must
 * agree:
 *   - one shared list of names (src/lib/test-utils/nameCorpus.ts, the list the
 *     validator's unit test runs too) goes through both;
 *   - EXHAUSTIVELY: every code point that is never allowed - control (Cc),
 *     format (Cf), default-ignorable (invisible), line or paragraph separator -
 *     is refused by both, and every one trim() removes is refused at either end;
 *     every code point the validator accepts is accepted by the database;
 *   - each of the six columns enforces the CHECK, for the server and, where a
 *     person writes it themselves, for a signed-in user through RLS;
 *   - the shared-category rename ("Name 2") never produces a doubled space, on
 *     both paths that run it (member removal, account deletion).
 */

import { Client } from 'pg';
import {
  rlsDescribe,
  createServiceClient,
  createTestUser,
  deleteTestUser,
  signInAsTestUser,
} from '@/lib/test-utils/rlsClient';
import { checkName } from '@/lib/validation/names';
import { NAME_CORPUS } from '@/lib/test-utils/nameCorpus';

// Test 2 checks every code point (~1.1 million) against both layers.
jest.setTimeout(120_000);

const PWD = 'rls-test-passw0rd!';
const stamp = Date.now();

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

/** The database's verdict for each name, in one round trip. */
async function dbClean(names: string[]): Promise<boolean[]> {
  const rows = await db<{ ok: boolean }>(
    'select public.is_clean_name(x) as ok from unnest($1::text[]) with ordinality as t(x, i) order by i',
    [names]
  );
  return rows.map((r) => r.ok);
}

/**
 * The never-allowed half, as the database enforces it: control, format,
 * default-ignorable (invisible), line and paragraph separators.
 */
const NEVER_ALLOWED = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}]/u;

/** Every code point except surrogates and U+0000 (which Postgres text cannot hold). */
function* allCodePoints(): Generator<number> {
  for (let c = 1; c <= 0x10ffff; c++) {
    if (c >= 0xd800 && c <= 0xdfff) continue;
    yield c;
  }
}

rlsDescribe('Names in any script (spec-cyrillic-names)', () => {
  // Created in beforeAll: a skipped describe still runs its body, and the
  // client throws when the RLS harness is not configured.
  let svc: ReturnType<typeof createServiceClient>;
  const users: string[] = [];
  beforeAll(() => {
    svc = createServiceClient();
  });

  async function makeUser(tag: string): Promise<{ id: string; email: string }> {
    const email = `rls-names-${tag}-${stamp}@example.test`;
    const id = await createTestUser(email, PWD);
    users.push(id);
    return { id, email };
  }

  afterAll(async () => {
    for (const id of users) await deleteTestUser(id);
  });

  it('1. ONE shared list of names, through the validator AND the database: they agree', async () => {
    const verdicts = await dbClean(NAME_CORPUS.map((c) => c.raw));
    // CONTROL: the list really has names on both sides of the database's rule.
    expect(verdicts.filter(Boolean).length).toBeGreaterThan(5);
    expect(verdicts.filter((v) => !v).length).toBeGreaterThan(5);
    const stored: string[] = [];
    NAME_CORPUS.forEach((c, i) => {
      const check = checkName(c.raw, 'category');
      expect({
        label: c.label,
        app: check.ok ? { name: check.name } : { problem: check.problem },
        dbRaw: verdicts[i],
      }).toEqual({ label: c.label, app: c.app, dbRaw: c.dbRaw });
      if (check.ok) stored.push(check.name);
    });
    // Whatever the validator accepts, it stores in a form the database accepts.
    expect(await dbClean(stored)).toEqual(stored.map(() => true));
    expect(stored).toEqual(expect.arrayContaining(['Храна за дома', 'Чай', 'Хра на']));
  });

  it('2. EXHAUSTIVE: every never-allowed character, and every trimmed white space, is refused by both; every character the validator accepts is accepted by the database', async () => {
    const neverAllowed: string[] = [];
    const trimmed: string[] = [];
    const accepted: string[] = [];
    for (const c of allCodePoints()) {
      const ch = String.fromCodePoint(c);
      if (NEVER_ALLOWED.test(ch)) neverAllowed.push(ch);
      if (`x${ch}`.trim() === 'x') trimmed.push(ch);
      const check = checkName(`a${ch}b`, 'category');
      if (check.ok) accepted.push(check.name);
    }
    // CONTROLS: the sets are what they should be, not accidentally empty.
    expect(neverAllowed.length).toBeGreaterThan(4_000); // the tag block alone is 4,096
    for (const ch of ['\u0007', '\u200B', '\u2028', '\u3164', '\uFE0F', '\u{E0001}']) {
      expect(neverAllowed).toContain(ch);
    }
    expect(trimmed).toEqual(expect.arrayContaining(['\t', '\u00A0', '\u3000', '\uFEFF']));
    expect(accepted.length).toBeGreaterThan(100_000);
    expect(accepted).toContain('aЖb');

    // The validator refuses every never-allowed character...
    expect(neverAllowed.filter((ch) => checkName(`a${ch}b`, 'category').ok)).toEqual([]);
    // ...and so does the database, inside a name and at either end.
    const inside = await dbClean(neverAllowed.map((ch) => `a${ch}b`));
    expect(neverAllowed.filter((_, i) => inside[i])).toEqual([]);
    const atEdges = await dbClean(trimmed.flatMap((ch) => [`${ch}a`, `a${ch}`]));
    expect(atEdges.filter(Boolean)).toEqual([]);

    // Nothing the validator accepts is refused by the database (in chunks).
    const refused: string[] = [];
    for (let i = 0; i < accepted.length; i += 20_000) {
      const chunk = accepted.slice(i, i + 20_000);
      const ok = await dbClean(chunk);
      chunk.forEach((name, j) => {
        if (!ok[j]) refused.push(name);
      });
    }
    expect(refused).toEqual([]);
  });

  it('3. every name column enforces it - for the server, and for a signed-in user through RLS', async () => {
    const u = await makeUser('cols');
    const { data: h, error: hErr } = await svc
      .from('households')
      .insert({ name: 'Вкъщи', created_by: u.id })
      .select('id')
      .single();
    expect(hErr).toBeNull();

    const dirty = 'Хра\u200Bна';
    const attempts: Array<
      [string, () => PromiseLike<{ error: { code?: string; message: string } | null }>]
    > = [
      [
        'categories',
        () =>
          svc
            .from('categories')
            .insert({ user_id: u.id, name: dirty, color: '#123456', type: 'expense' }),
      ],
      ['goals', () => svc.from('goals').insert({ user_id: u.id, name: dirty, target_amount: 100 })],
      ['households', () => svc.from('households').update({ name: dirty }).eq('id', h!.id)],
      [
        'wishlist_items',
        () => svc.from('wishlist_items').insert({ user_id: u.id, name: dirty, price: 10 }),
      ],
      ['user_values', () => svc.from('user_values').insert({ user_id: u.id, name: dirty })],
      [
        'user_profiles',
        () => svc.from('user_profiles').update({ display_name: dirty }).eq('id', u.id),
      ],
    ];
    for (const [table, attempt] of attempts) {
      const { error } = await attempt();
      expect({ table, code: error?.code, constraint: /_clean/.test(error?.message ?? '') }).toEqual(
        {
          table,
          code: '23514',
          constraint: true,
        }
      );
    }

    // The clean Bulgarian name is stored exactly, in every column.
    const clean = 'Дрехи & обувки';
    expect(
      (
        await svc
          .from('categories')
          .insert({ user_id: u.id, name: clean, color: '#123456', type: 'expense' })
      ).error
    ).toBeNull();
    expect(
      (await svc.from('goals').insert({ user_id: u.id, name: clean, target_amount: 100 })).error
    ).toBeNull();
    expect((await svc.from('households').update({ name: clean }).eq('id', h!.id)).error).toBeNull();
    expect(
      (await svc.from('wishlist_items').insert({ user_id: u.id, name: clean, price: 10 })).error
    ).toBeNull();
    expect((await svc.from('user_values').insert({ user_id: u.id, name: clean })).error).toBeNull();
    expect(
      (await svc.from('user_profiles').update({ display_name: clean }).eq('id', u.id)).error
    ).toBeNull();
    // A cleared display name (NULL) passes.
    expect(
      (await svc.from('user_profiles').update({ display_name: null }).eq('id', u.id)).error
    ).toBeNull();

    // A signed-in user writing through RLS meets the same rule (the CHECK runs as
    // them), on every column a person writes themselves. (The household name is
    // written by the server only.)
    const asU = await signInAsTestUser(u.email, PWD);
    const asUser: Array<
      [string, (name: string) => PromiseLike<{ error: { code?: string } | null }>]
    > = [
      [
        'categories',
        (name) =>
          asU.from('categories').insert({ user_id: u.id, name, color: '#123456', type: 'expense' }),
      ],
      ['goals', (name) => asU.from('goals').insert({ user_id: u.id, name, target_amount: 100 })],
      [
        'wishlist_items',
        (name) => asU.from('wishlist_items').insert({ user_id: u.id, name, price: 10 }),
      ],
      ['user_values', (name) => asU.from('user_values').insert({ user_id: u.id, name })],
      [
        'user_profiles',
        (name) => asU.from('user_profiles').update({ display_name: name }).eq('id', u.id),
      ],
    ];
    for (const [table, write] of asUser) {
      const refusedAsUser = await write(dirty);
      const storedAsUser = await write('Храна');
      expect({ table, refused: refusedAsUser.error?.code, stored: storedAsUser.error }).toEqual({
        table,
        refused: '23514',
        stored: null,
      });
    }
  });

  it('4. the shared-category rename never makes a doubled space: a 100-character name cut just after a space still moves, as "... 2" - on removal AND on account deletion', async () => {
    // 100 characters, a space at position 98: the cut for " 2" (98 characters)
    // ends ON that space.
    const long = `${'ж'.repeat(97)} жж`;
    expect([...long].length).toBe(100);

    /** A household where the owner and the member each have a category named `long`, the member's shared. */
    async function setUp(tag: string) {
      const owner = await makeUser(`own-${tag}`);
      const member = await makeUser(`mem-${tag}`);
      const h = await svc
        .from('households')
        .insert({ name: `H-names-${tag}`, created_by: owner.id })
        .select('id')
        .single();
      expect(h.error).toBeNull();
      const members = await svc.from('household_members').insert([
        {
          household_id: h.data!.id,
          user_id: owner.id,
          role: 'admin',
          joined_at: '2026-01-01T00:00:00Z',
        },
        {
          household_id: h.data!.id,
          user_id: member.id,
          role: 'member',
          joined_at: '2026-02-01T00:00:00Z',
        },
      ]);
      expect(members.error).toBeNull();
      const own = await svc
        .from('categories')
        .insert({ user_id: owner.id, name: long, color: '#123456', type: 'expense' });
      expect(own.error).toBeNull();
      const shared = await svc
        .from('categories')
        .insert({
          user_id: member.id,
          name: long,
          color: '#123456',
          type: 'expense',
          household_id: h.data!.id,
        })
        .select('id')
        .single();
      expect(shared.error).toBeNull();
      return {
        owner,
        member,
        household: h.data!.id as string,
        sharedId: shared.data!.id as string,
      };
    }

    async function movedTo(sharedId: string) {
      const { data, error } = await svc
        .from('categories')
        .select('user_id, name')
        .eq('id', sharedId)
        .single();
      expect(error).toBeNull();
      return data;
    }

    // Path 1: the member is removed.
    const r = await setUp('rm');
    const removed = await svc.rpc('remove_household_member', {
      p_household: r.household,
      p_member: r.member.id,
    });
    expect(removed.error).toBeNull();
    expect(await movedTo(r.sharedId)).toEqual({ user_id: r.owner.id, name: `${'ж'.repeat(97)} 2` });

    // Path 2: the member deletes their account (the preparation moves the shared objects).
    const d = await setUp('del');
    const prepared = await svc.rpc('prepare_account_deletion', { p_user: d.member.id });
    expect(prepared.error).toBeNull();
    expect(await movedTo(d.sharedId)).toEqual({ user_id: d.owner.id, name: `${'ж'.repeat(97)} 2` });
  });

  it('5. the function: executable by the server and signed-in users only; immutable; search_path pinned', async () => {
    const [fn] = await db<{
      volatility: string;
      config: string[] | null;
      anon: boolean;
      authed: boolean;
      server: boolean;
    }>(
      `select p.provolatile::text as volatility, p.proconfig as config,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as server
         from pg_proc p where p.oid = 'public.is_clean_name(text)'::regprocedure`
    );
    expect(fn).toEqual({
      volatility: 'i',
      config: ['search_path=""'],
      anon: false,
      authed: true,
      server: true,
    });
    const constraints = await db<{ name: string }>(
      `select conname as name from pg_constraint where contype = 'c' and conname like '%_clean' order by 1`
    );
    expect(constraints.map((c) => c.name)).toEqual([
      'categories_name_clean',
      'goals_name_clean',
      'households_name_clean',
      'user_profiles_display_name_clean',
      'user_values_name_clean',
      'wishlist_items_name_clean',
    ]);
  });
});
