/**
 * valuesService tests — Story 14.1
 * Mocked Supabase (service boundary). Real owner-only RLS is covered by the harness
 * (values.rls.test.ts), not here.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import {
  getValuesPlan,
  createValue,
  setValueCategories,
  reorderValues,
} from '@/lib/services/valuesService';
import { createSupabaseMock, type QueryChain, type SupabaseMock } from '@/test-utils/supabaseChain';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

/*
 * MIGRATED to `@/test-utils/supabaseChain`. This file carried its own copy of a
 * per-table `makeClient` - the SAME builder hand-copied into budgetService,
 * streakService, valuesService and wishlistService tests, never extracted. It
 * already had the factory's queue model (per table, consumed in from() order);
 * what it lacked was method coverage: a fixed list of stubbed methods, so a
 * query using any other method threw a TypeError.
 *
 * Two semantic differences, stated rather than hidden: a queue that runs DRY
 * returned { data: null } there and repeats its last entry here; an unlisted
 * table returned { data: null } there and { data: [] } here (null for
 * single/maybeSingle). The tests passed unchanged across both.
 *
 * CONTROL-ARM FILE: valuesService has no catch at all, so a mock gap here fails
 * visibly. It was missed by the original census, which matched only
 * `from: jest.fn(` and not `const from = jest.fn(`.
 */
type Result = { data: unknown; error: unknown };
type Plan = Record<string, Result | Result[]>;

function makeClient(plan: Plan) {
  return createSupabaseMock({ tables: plan as never });
}

/** All chains handed out for a table, in from() order ([] if never queried). */
const chainsFor = (db: SupabaseMock, table: string): QueryChain[] => db.chains[table] ?? [];

beforeEach(() => jest.clearAllMocks());

describe('getValuesPlan', () => {
  it('groups category_ids per value, in priority order', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        user_values: {
          data: [
            { id: 'v1', name: 'Health', priority: 0 },
            { id: 'v2', name: 'Fun', priority: 1 },
          ],
          error: null,
        },
        value_categories: {
          data: [
            { value_id: 'v1', category_id: 'c1' },
            { value_id: 'v1', category_id: 'c2' },
            { value_id: 'v2', category_id: 'c3' },
          ],
          error: null,
        },
      }).client as never
    );

    const plan = await getValuesPlan('user-1');
    expect(plan).toEqual([
      { id: 'v1', name: 'Health', priority: 0, category_ids: ['c1', 'c2'] },
      { id: 'v2', name: 'Fun', priority: 1, category_ids: ['c3'] },
    ]);
  });

  it('returns [] (and skips the mappings query) when there are no values', async () => {
    const db = makeClient({ user_values: { data: [], error: null } });
    mockCreateClient.mockResolvedValue(db.client as never);
    expect(await getValuesPlan('user-1')).toEqual([]);
    expect(chainsFor(db, 'value_categories')).toHaveLength(0);
  });
});

describe('createValue', () => {
  it('assigns the next priority and inserts category mappings', async () => {
    const db = makeClient({
      user_values: [
        { data: { priority: 2 }, error: null }, // max-priority lookup
        { data: { id: 'v9', name: 'Growth', priority: 3 }, error: null }, // insert ... returning
      ],
      categories: { data: [{ id: 'c1' }, { id: 'c2' }], error: null }, // visibility filter
      value_categories: [
        { data: null, error: null }, // delete existing
        { data: null, error: null }, // insert new rows
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await createValue('user-1', { name: '  Growth  ', categoryIds: ['c1', 'c2'] });
    expect(result).toEqual({ id: 'v9', name: 'Growth', priority: 3, category_ids: ['c1', 'c2'] });

    const insertChain = chainsFor(db, 'user_values').find((q) => q.insert.mock.calls.length > 0)!;
    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'Growth',
      priority: 3,
    });

    const mapInsert = chainsFor(db, 'value_categories').find(
      (q) => q.insert.mock.calls.length > 0
    )!;
    expect(mapInsert.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', value_id: 'v9', category_id: 'c1' },
      { user_id: 'user-1', value_id: 'v9', category_id: 'c2' },
    ]);
  });

  it('starts priority at 0 when the user has no values', async () => {
    const db = makeClient({
      user_values: [
        { data: null, error: null }, // no existing rows
        { data: { id: 'v1', name: 'First', priority: 0 }, error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);
    const result = await createValue('user-1', { name: 'First' });
    expect(result.priority).toBe(0);
    const insertChain = chainsFor(db, 'user_values').find((q) => q.insert.mock.calls.length > 0)!;
    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'First',
      priority: 0,
    });
  });

  it('rejects an empty name without touching the DB', async () => {
    const db = makeClient({});
    mockCreateClient.mockResolvedValue(db.client as never);
    await expect(createValue('user-1', { name: '   ' })).rejects.toThrow(/1–50/);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('rejects a name longer than 50 chars', async () => {
    mockCreateClient.mockResolvedValue(makeClient({}).client as never);
    await expect(createValue('user-1', { name: 'x'.repeat(51) })).rejects.toThrow(/1–50/);
  });

  // spec-cyrillic-names: 50 CHARACTERS, counted as Postgres counts (each of these
  // letters is two UTF-16 units).
  it('accepts 50 characters outside the Basic Multilingual Plane (the shared rule counts code points)', async () => {
    const db = makeClient({});
    mockCreateClient.mockResolvedValue(db.client as never);
    const name = '\u{20000}'.repeat(50);
    expect(name.length).toBe(100); // CONTROL: UTF-16 would call it too long
    const result = await createValue('user-1', { name }).catch((e: unknown) => e);
    expect(String(result)).not.toMatch(/1–50/);
    expect(db.allCallsTo('user_values', 'insert')).toEqual([[expect.objectContaining({ name })]]);
  });

  it('maps a duplicate-name DB error to a friendly message', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        user_values: [
          { data: null, error: null },
          { data: null, error: { code: '23505', message: 'dup' } },
        ],
      }).client as never
    );
    await expect(createValue('user-1', { name: 'Health' })).rejects.toThrow(/already exists/);
  });
});

describe('setValueCategories', () => {
  it('replaces the mappings: deletes existing then inserts the new set', async () => {
    const db = makeClient({
      user_values: { data: { id: 'v1' }, error: null }, // ownership lookup
      categories: { data: [{ id: 'c3' }, { id: 'c4' }], error: null }, // visibility filter
      value_categories: [
        { data: null, error: null }, // delete
        { data: null, error: null }, // insert
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    await setValueCategories('user-1', 'v1', ['c3', 'c4']);
    const del = chainsFor(db, 'value_categories').find((q) => q.delete.mock.calls.length > 0)!;
    expect(del.delete).toHaveBeenCalled();
    const ins = chainsFor(db, 'value_categories').find((q) => q.insert.mock.calls.length > 0)!;
    expect(ins.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', value_id: 'v1', category_id: 'c3' },
      { user_id: 'user-1', value_id: 'v1', category_id: 'c4' },
    ]);
  });

  it('deletes but does not insert when given an empty set', async () => {
    const db = makeClient({
      user_values: { data: { id: 'v1' }, error: null },
      value_categories: { data: null, error: null },
    });
    mockCreateClient.mockResolvedValue(db.client as never);
    await setValueCategories('user-1', 'v1', []);
    const ins = chainsFor(db, 'value_categories').find((q) => q.insert.mock.calls.length > 0);
    expect(ins).toBeUndefined();
  });

  it('throws when the value is not the caller’s', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ user_values: { data: null, error: null } }).client as never
    );
    await expect(setValueCategories('user-1', 'v1', ['c1'])).rejects.toThrow(/not found/);
  });

  it('drops category ids the caller cannot see (RLS visibility filter)', async () => {
    const db = makeClient({
      user_values: { data: { id: 'v1' }, error: null },
      categories: { data: [{ id: 'c3' }], error: null }, // only c3 is visible; c-evil filtered out
      value_categories: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);
    await setValueCategories('user-1', 'v1', ['c3', 'c-evil']);
    const ins = chainsFor(db, 'value_categories').find((q) => q.insert.mock.calls.length > 0)!;
    expect(ins.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', value_id: 'v1', category_id: 'c3' },
    ]);
  });
});

describe('reorderValues', () => {
  it('rewrites priority to the array index for each id', async () => {
    const db = makeClient({ user_values: { data: null, error: null } });
    mockCreateClient.mockResolvedValue(db.client as never);

    await reorderValues('user-1', ['a', 'b', 'c']);
    const updates = chainsFor(db, 'user_values')
      .filter((q) => q.update.mock.calls.length > 0)
      .map((q) => q.update.mock.calls[0][0]);
    expect(updates).toEqual([{ priority: 0 }, { priority: 1 }, { priority: 2 }]);
  });
});
