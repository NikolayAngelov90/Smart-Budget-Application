/**
 * @jest-environment node
 *
 * spec-account-deletion-notifications: GET /api/notices (own, undismissed, via
 * RLS) and POST /api/notices/[id]/dismiss (service role, scoped to the caller).
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { GET } from '../route';
import { POST } from '../[id]/dismiss/route';

const NOTICE_ID = '4b1f2c3d-1111-4222-8333-944455556666';
type Res = { status: number; json: () => Promise<{ data?: unknown; error?: { message: string } }> };

describe('GET /api/notices', () => {
  test('401 without a session', async () => {
    (createClient as jest.Mock).mockResolvedValue(createSupabaseMock({ user: null }).client);
    expect(((await GET()) as unknown as Res).status).toBe(401);
  });

  test("the caller's own UNDISMISSED notices, oldest first, through the session (RLS)", async () => {
    const notices = [{ id: NOTICE_ID, kind: 'household_transferred', params: { household: 'H' } }];
    const db = createSupabaseMock({
      user: { id: 'u-1' },
      tables: { account_notices: { data: notices, error: null } },
    });
    (createClient as jest.Mock).mockResolvedValue(db.client);

    const res = (await GET()) as unknown as Res;

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(notices);
    // Every column the card needs: `cause` picks the body, `created_at` breaks ties
    // in the sort, `params` fills the text.
    const [columns] = db.callsTo('account_notices', 'select')[0] as [string];
    for (const column of ['id', 'kind', 'cause', 'params', 'created_at']) {
      expect(columns.split(',').map((c) => c.trim())).toContain(column);
    }
    expect(db.callsTo('account_notices', 'eq')).toContainEqual(['recipient_id', 'u-1']);
    expect(db.callsTo('account_notices', 'is')).toContainEqual(['dismissed_at', null]);
    expect(db.callsTo('account_notices', 'order')).toContainEqual([
      'created_at',
      { ascending: true },
    ]);
    // Read with the SESSION client: RLS is exercised, the service role is not used.
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  test('a query error is a 500, never an empty list (degradation policy: core input)', async () => {
    const db = createSupabaseMock({
      user: { id: 'u-1' },
      tables: { account_notices: { data: null, error: { message: 'boom' } } },
    });
    (createClient as jest.Mock).mockResolvedValue(db.client);

    const res = (await GET()) as unknown as Res;

    expect(res.status).toBe(500);
    expect((await res.json()).data).toBeUndefined();
  });
});

describe('POST /api/notices/[id]/dismiss', () => {
  const call = (id: string) => POST({} as never, { params: Promise.resolve({ id }) });

  beforeEach(() => jest.clearAllMocks());

  test('401 without a session, and nothing is written', async () => {
    (createClient as jest.Mock).mockResolvedValue(createSupabaseMock({ user: null }).client);
    expect(((await call(NOTICE_ID)) as unknown as Res).status).toBe(401);
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  test('400 for an id that is not a uuid, and nothing is written', async () => {
    (createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({ user: { id: 'u-1' } }).client
    );
    expect(((await call('not-a-uuid')) as unknown as Res).status).toBe(400);
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  test('dismisses only THIS notice, only if the caller is its recipient and it is still open', async () => {
    (createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({ user: { id: 'u-1' } }).client
    );
    const admin = createSupabaseMock({
      tables: { account_notices: { data: [{ id: NOTICE_ID }], error: null } },
    });
    (createServiceRoleClient as jest.Mock).mockReturnValue(admin.client);

    const res = (await call(NOTICE_ID)) as unknown as Res;

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ dismissed: true });
    const update = admin.callsTo('account_notices', 'update');
    expect(update).toHaveLength(1);
    expect(Object.keys(update[0]![0] as object)).toEqual(['dismissed_at']);
    const eqs = admin.callsTo('account_notices', 'eq');
    expect(eqs).toContainEqual(['id', NOTICE_ID]);
    expect(eqs).toContainEqual(['recipient_id', 'u-1']);
    expect(admin.callsTo('account_notices', 'is')).toContainEqual(['dismissed_at', null]);
  });

  test("someone else's notice, or an already-dismissed one: the same answer, nothing changed", async () => {
    (createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({ user: { id: 'u-1' } }).client
    );
    (createServiceRoleClient as jest.Mock).mockReturnValue(
      createSupabaseMock({ tables: { account_notices: { data: [], error: null } } }).client
    );

    const res = (await call(NOTICE_ID)) as unknown as Res;

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ dismissed: false });
  });

  test('a write error is a 500', async () => {
    (createClient as jest.Mock).mockResolvedValue(
      createSupabaseMock({ user: { id: 'u-1' } }).client
    );
    (createServiceRoleClient as jest.Mock).mockReturnValue(
      createSupabaseMock({ tables: { account_notices: { data: null, error: { message: 'x' } } } })
        .client
    );
    expect(((await call(NOTICE_ID)) as unknown as Res).status).toBe(500);
  });
});
