/**
 * Categories route — shared-category POST logic (Story 13.5)
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { POST } from '../route';
import { createSupabaseMock } from '@/test-utils/supabaseChain';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

/**
 * Builds a Supabase mock routed by table:
 * - household_members: select().eq().maybeSingle() -> membership
 * - categories: select().eq().eq().eq().maybeSingle() -> dup check; insert().select().single() -> inserted row
 */
/*
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. POST reads
 * household_members (shared categories only), then categories: the duplicate
 * check (none), then the insert. The hand-captured insert row is now read off
 * the insert call.
 */
function makeSupabase(opts: {
  user?: object | null;
  membership?: object | null;
  inserted?: object;
}) {
  const { user = { id: 'user-1' }, membership = null, inserted = { id: 'cat-1' } } = opts;
  const db = createSupabaseMock({
    user: user as { id: string } | null,
    tables: {
      household_members: { data: membership, error: null },
      categories: [
        { data: null, error: null }, // duplicate check: none
        { data: inserted, error: null }, // the insert
      ],
    },
  });
  return {
    client: db.client,
    getInsert: () =>
      db.allCallsTo('categories', 'insert')[0]?.[0] as Record<string, unknown> | undefined,
  };
}

function req(body: unknown) {
  return { json: async () => body } as never;
}

beforeEach(() => jest.clearAllMocks());

it('creates a shared category with household_id when the caller has a household', async () => {
  const { client, getInsert } = makeSupabase({
    membership: { household_id: 'h-1' },
    inserted: { id: 'cat-1', household_id: 'h-1' },
  });
  mockCreateClient.mockResolvedValue(client as never);

  const res = await POST(
    req({ name: 'Groceries', color: '#48bb78', type: 'expense', shared: true })
  );
  expect(res.status).toBe(201);
  expect(getInsert()).toMatchObject({ household_id: 'h-1', user_id: 'user-1' });
});

it('returns 403 when shared is requested but the caller has no household', async () => {
  const { client } = makeSupabase({ membership: null });
  mockCreateClient.mockResolvedValue(client as never);

  const res = await POST(
    req({ name: 'Groceries', color: '#48bb78', type: 'expense', shared: true })
  );
  expect(res.status).toBe(403);
});

it('creates a personal category (household_id null) when not shared', async () => {
  const { client, getInsert } = makeSupabase({ inserted: { id: 'cat-2' } });
  mockCreateClient.mockResolvedValue(client as never);

  const res = await POST(req({ name: 'Personal', color: '#f56565', type: 'expense' }));
  expect(res.status).toBe(201);
  expect(getInsert()).toMatchObject({ household_id: null });
});
