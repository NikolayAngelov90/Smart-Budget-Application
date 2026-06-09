/**
 * /api/values route tests — Story 14.1
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

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/services/valuesService', () => ({
  getValuesPlan: jest.fn(),
  createValue: jest.fn(),
  updateValue: jest.fn(),
  deleteValue: jest.fn(),
  setValueCategories: jest.fn(),
  reorderValues: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import * as svc from '@/lib/services/valuesService';
import { GET, POST } from '../route';
import { PATCH as PATCH_ID, DELETE as DELETE_ID } from '../[id]/route';
import { PUT as PUT_CATEGORIES } from '../[id]/categories/route';
import { PATCH as PATCH_REORDER } from '../reorder/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function authClient(user: object | null) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no user' } }) },
  };
}
function req(body: unknown) {
  return { json: async () => body } as never;
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const UUID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => jest.clearAllMocks());

describe('GET /api/values', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await GET()).status).toBe(401);
  });

  it('returns the values plan', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const plan = [{ id: 'v1', name: 'Health', priority: 0, category_ids: [] }];
    (svc.getValuesPlan as jest.Mock).mockResolvedValue(plan);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(plan);
  });
});

describe('POST /api/values', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await POST(req({ name: 'Health' }))).status).toBe(401);
  });

  it('400 on an empty name', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const res = await POST(req({ name: '  ' }));
    expect(res.status).toBe(400);
    expect(svc.createValue).not.toHaveBeenCalled();
  });

  it('creates and returns 201', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const value = { id: 'v1', name: 'Health', priority: 0, category_ids: [UUID] };
    (svc.createValue as jest.Mock).mockResolvedValue(value);
    const res = await POST(req({ name: 'Health', categoryIds: [UUID] }));
    expect(res.status).toBe(201);
    expect((await res.json()).data).toEqual(value);
    expect(svc.createValue).toHaveBeenCalledWith('user-1', { name: 'Health', categoryIds: [UUID] });
  });

  it('409 on a duplicate name', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    (svc.createValue as jest.Mock).mockRejectedValue(new Error('A value with that name already exists'));
    expect((await POST(req({ name: 'Health' }))).status).toBe(409);
  });
});

describe('PATCH /api/values/[id]', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await PATCH_ID(req({ name: 'X' }), params('v1'))).status).toBe(401);
  });

  it('400 when nothing to update', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const res = await PATCH_ID(req({}), params('v1'));
    expect(res.status).toBe(400);
    expect(svc.updateValue).not.toHaveBeenCalled();
  });

  it('updates the value', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const res = await PATCH_ID(req({ name: 'Renamed' }), params('v1'));
    expect(res.status).toBe(200);
    expect(svc.updateValue).toHaveBeenCalledWith('user-1', 'v1', { name: 'Renamed' });
  });
});

describe('DELETE /api/values/[id]', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await DELETE_ID(req(null), params('v1'))).status).toBe(401);
  });

  it('deletes the value', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const res = await DELETE_ID(req(null), params('v1'));
    expect(res.status).toBe(200);
    expect(svc.deleteValue).toHaveBeenCalledWith('user-1', 'v1');
  });
});

describe('PUT /api/values/[id]/categories', () => {
  it('400 when categoryIds is missing', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const res = await PUT_CATEGORIES(req({}), params('v1'));
    expect(res.status).toBe(400);
  });

  it('404 when the value is not found', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    (svc.setValueCategories as jest.Mock).mockRejectedValue(new Error('Value not found'));
    const res = await PUT_CATEGORIES(req({ categoryIds: [UUID] }), params('v1'));
    expect(res.status).toBe(404);
  });

  it('replaces the categories', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    (svc.setValueCategories as jest.Mock).mockResolvedValue(undefined);
    const res = await PUT_CATEGORIES(req({ categoryIds: [UUID] }), params('v1'));
    expect(res.status).toBe(200);
    expect(svc.setValueCategories).toHaveBeenCalledWith('user-1', 'v1', [UUID]);
  });
});

describe('PATCH /api/values/reorder', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await PATCH_REORDER(req({ orderedIds: [UUID] }))).status).toBe(401);
  });

  it('reorders', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const res = await PATCH_REORDER(req({ orderedIds: [UUID] }));
    expect(res.status).toBe(200);
    expect(svc.reorderValues).toHaveBeenCalledWith('user-1', [UUID]);
  });
});
