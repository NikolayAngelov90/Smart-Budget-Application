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

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

interface ChainStub {
  select: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
}

/** A chainable query stub: every method returns `this`; terminals + await resolve to `result`. */
function chain(result: { data: unknown; error: unknown }): ChainStub {
  const q = {} as ChainStub;
  const bag = q as unknown as Record<string, jest.Mock>;
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update', 'delete']) {
    bag[m] = jest.fn(() => q);
  }
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.single = jest.fn().mockResolvedValue(result);
  (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

type Plan = Record<string, { data: unknown; error: unknown } | { data: unknown; error: unknown }[]>;

/** Builds a client whose `from(table)` consumes the next queued result for that table. */
function makeClient(plan: Plan) {
  const queues: Record<string, { data: unknown; error: unknown }[] | { data: unknown; error: unknown }> = {};
  for (const [k, v] of Object.entries(plan)) queues[k] = Array.isArray(v) ? [...v] : v;
  const from = jest.fn((table: string) => {
    const q = queues[table];
    let result: { data: unknown; error: unknown } = { data: null, error: null };
    if (Array.isArray(q)) result = q.length ? q.shift()! : { data: null, error: null };
    else if (q) result = q;
    return chain(result);
  });
  return { from };
}

/** All chains created for a given table, in call order. */
function chainsFor(client: { from: jest.Mock }, table: string): ChainStub[] {
  const out: ChainStub[] = [];
  for (let i = 0; i < client.from.mock.calls.length; i++) {
    if (client.from.mock.calls[i][0] === table) out.push(client.from.mock.results[i]!.value as ChainStub);
  }
  return out;
}

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
      }) as never
    );

    const plan = await getValuesPlan('user-1');
    expect(plan).toEqual([
      { id: 'v1', name: 'Health', priority: 0, category_ids: ['c1', 'c2'] },
      { id: 'v2', name: 'Fun', priority: 1, category_ids: ['c3'] },
    ]);
  });

  it('returns [] (and skips the mappings query) when there are no values', async () => {
    const client = makeClient({ user_values: { data: [], error: null } });
    mockCreateClient.mockResolvedValue(client as never);
    expect(await getValuesPlan('user-1')).toEqual([]);
    expect(chainsFor(client, 'value_categories')).toHaveLength(0);
  });
});

describe('createValue', () => {
  it('assigns the next priority and inserts category mappings', async () => {
    const client = makeClient({
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
    mockCreateClient.mockResolvedValue(client as never);

    const result = await createValue('user-1', { name: '  Growth  ', categoryIds: ['c1', 'c2'] });
    expect(result).toEqual({ id: 'v9', name: 'Growth', priority: 3, category_ids: ['c1', 'c2'] });

    const insertChain = chainsFor(client, 'user_values').find((q) => q.insert.mock.calls.length > 0)!;
    expect(insertChain.insert).toHaveBeenCalledWith({ user_id: 'user-1', name: 'Growth', priority: 3 });

    const mapInsert = chainsFor(client, 'value_categories').find((q) => q.insert.mock.calls.length > 0)!;
    expect(mapInsert.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', value_id: 'v9', category_id: 'c1' },
      { user_id: 'user-1', value_id: 'v9', category_id: 'c2' },
    ]);
  });

  it('starts priority at 0 when the user has no values', async () => {
    const client = makeClient({
      user_values: [
        { data: null, error: null }, // no existing rows
        { data: { id: 'v1', name: 'First', priority: 0 }, error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);
    const result = await createValue('user-1', { name: 'First' });
    expect(result.priority).toBe(0);
    const insertChain = chainsFor(client, 'user_values').find((q) => q.insert.mock.calls.length > 0)!;
    expect(insertChain.insert).toHaveBeenCalledWith({ user_id: 'user-1', name: 'First', priority: 0 });
  });

  it('rejects an empty name without touching the DB', async () => {
    const client = makeClient({});
    mockCreateClient.mockResolvedValue(client as never);
    await expect(createValue('user-1', { name: '   ' })).rejects.toThrow(/1–50/);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects a name longer than 50 chars', async () => {
    mockCreateClient.mockResolvedValue(makeClient({}) as never);
    await expect(createValue('user-1', { name: 'x'.repeat(51) })).rejects.toThrow(/1–50/);
  });

  it('maps a duplicate-name DB error to a friendly message', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        user_values: [
          { data: null, error: null },
          { data: null, error: { code: '23505', message: 'dup' } },
        ],
      }) as never
    );
    await expect(createValue('user-1', { name: 'Health' })).rejects.toThrow(/already exists/);
  });
});

describe('setValueCategories', () => {
  it('replaces the mappings: deletes existing then inserts the new set', async () => {
    const client = makeClient({
      user_values: { data: { id: 'v1' }, error: null }, // ownership lookup
      categories: { data: [{ id: 'c3' }, { id: 'c4' }], error: null }, // visibility filter
      value_categories: [
        { data: null, error: null }, // delete
        { data: null, error: null }, // insert
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);

    await setValueCategories('user-1', 'v1', ['c3', 'c4']);
    const del = chainsFor(client, 'value_categories').find((q) => q.delete.mock.calls.length > 0)!;
    expect(del.delete).toHaveBeenCalled();
    const ins = chainsFor(client, 'value_categories').find((q) => q.insert.mock.calls.length > 0)!;
    expect(ins.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', value_id: 'v1', category_id: 'c3' },
      { user_id: 'user-1', value_id: 'v1', category_id: 'c4' },
    ]);
  });

  it('deletes but does not insert when given an empty set', async () => {
    const client = makeClient({
      user_values: { data: { id: 'v1' }, error: null },
      value_categories: { data: null, error: null },
    });
    mockCreateClient.mockResolvedValue(client as never);
    await setValueCategories('user-1', 'v1', []);
    const ins = chainsFor(client, 'value_categories').find((q) => q.insert.mock.calls.length > 0);
    expect(ins).toBeUndefined();
  });

  it('throws when the value is not the caller’s', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ user_values: { data: null, error: null } }) as never
    );
    await expect(setValueCategories('user-1', 'v1', ['c1'])).rejects.toThrow(/not found/);
  });

  it('drops category ids the caller cannot see (RLS visibility filter)', async () => {
    const client = makeClient({
      user_values: { data: { id: 'v1' }, error: null },
      categories: { data: [{ id: 'c3' }], error: null }, // only c3 is visible; c-evil filtered out
      value_categories: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);
    await setValueCategories('user-1', 'v1', ['c3', 'c-evil']);
    const ins = chainsFor(client, 'value_categories').find((q) => q.insert.mock.calls.length > 0)!;
    expect(ins.insert).toHaveBeenCalledWith([{ user_id: 'user-1', value_id: 'v1', category_id: 'c3' }]);
  });
});

describe('reorderValues', () => {
  it('rewrites priority to the array index for each id', async () => {
    const client = makeClient({ user_values: { data: null, error: null } });
    mockCreateClient.mockResolvedValue(client as never);

    await reorderValues('user-1', ['a', 'b', 'c']);
    const updates = chainsFor(client, 'user_values')
      .filter((q) => q.update.mock.calls.length > 0)
      .map((q) => q.update.mock.calls[0][0]);
    expect(updates).toEqual([{ priority: 0 }, { priority: 1 }, { priority: 2 }]);
  });
});
