/**
 * Categories API Integration Tests
 * Story 10.9: AC-10.9.3 — Category management integration tests
 *
 * Tests:
 * - GET /api/categories (list with usage stats + recent subset)
 * - POST /api/categories (create, duplicate prevention)
 * - PUT /api/categories/[id] (edit, predefined guard)
 * - DELETE /api/categories/[id] (delete with transaction orphaning, predefined guard)
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: new Headers(),
    })),
  },
}));

import { GET, POST } from '@/app/api/categories/route';
import { PUT, DELETE } from '@/app/api/categories/[id]/route';
import { createClient } from '@/lib/supabase/server';
import {
  createSupabaseMock,
  type QueryResult,
  type SupabaseMock,
} from '@/test-utils/supabaseChain';

jest.mock('@/lib/supabase/server');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequest(url: string, method = 'GET', body?: any): any {
  return {
    url,
    method,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => body,
    nextUrl: { searchParams: new URLSearchParams(new URL(url).search) },
  };
}

describe('Categories API Integration Tests (AC-10.9.3)', () => {
  /*
   * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. The hand-rolled chain
   * queued results PER TERMINAL (`single.mockResolvedValueOnce`,
   * `then.mockImplementationOnce`), consumed in whatever order the handler hit
   * each terminal across tables. Per table, in each handler's real call order:
   *
   *   GET     categories [list]           transactions [usage]
   *   POST    categories [dup check, insert]
   *   PUT     categories [fetch, dup check, update]
   *   DELETE  categories [fetch, reassign target, delete]
   *           transactions [usage count, reassign update]
   *
   * That translation exposed one test modelled on a call that does not happen:
   * see "updates name and color of custom category".
   */
  let db: SupabaseMock;
  function wire(tables: Record<string, QueryResult | QueryResult[]> = {}) {
    db = createSupabaseMock({ user: { id: userId }, tables });
    mockCreateClient.mockResolvedValue(db.client);
  }
  const calls = (table: string, method: string) => db.allCallsTo(table, method);

  const userId = 'user-123';
  const catId = 'cat-custom-001';

  const mockCategories = [
    {
      id: 'cat-001',
      name: 'Food',
      color: '#FF6B6B',
      type: 'expense',
      is_predefined: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: catId,
      name: 'My Category',
      color: '#4ECDC4',
      type: 'expense',
      is_predefined: false,
      created_at: '2026-01-10T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    wire();
  });

  // ─── GET /api/categories ──────────────────────────────────────────────────

  describe('GET /api/categories — list with usage stats', () => {
    test('returns categories with usage stats and recent subset', async () => {
      wire({
        categories: { data: mockCategories, error: null },
        transactions: { data: [], error: null }, // usage stats
      });

      const request = createMockRequest('http://localhost:3000/api/categories');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.recent).toBeDefined();
      expect(data.count).toBeDefined();
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const request = createMockRequest('http://localhost:3000/api/categories');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    test('filters categories by type when type param provided', async () => {
      wire({
        categories: { data: [mockCategories[0]], error: null },
        transactions: { data: [], error: null },
      });

      const request = createMockRequest('http://localhost:3000/api/categories?type=expense');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(calls('categories', 'eq')).toContainEqual(['type', 'expense']);
    });

    test('returns 500 on database error', async () => {
      wire({ categories: { data: null, error: new Error('DB error') } });

      const request = createMockRequest('http://localhost:3000/api/categories');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  // ─── POST /api/categories ─────────────────────────────────────────────────

  describe('POST /api/categories — create custom category', () => {
    const validBody = {
      name: 'My Category',
      color: '#4ECDC4',
      type: 'expense',
    };

    test('creates custom category and returns 201', async () => {
      wire({
        categories: [
          { data: null, error: null }, // duplicate check: not found
          {
            data: {
              id: catId,
              ...validBody,
              is_predefined: false,
              user_id: userId,
              created_at: new Date().toISOString(),
            },
            error: null,
          }, // the insert
        ],
      });

      const request = createMockRequest('http://localhost:3000/api/categories', 'POST', validBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
      expect(calls('categories', 'insert').length).toBeGreaterThan(0);
    });

    test('returns 409 when category name already exists for same type', async () => {
      // Duplicate found
      wire({ categories: { data: { id: 'existing-cat', name: 'My Category' }, error: null } });

      const request = createMockRequest('http://localhost:3000/api/categories', 'POST', validBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });

    test('returns 400 for invalid color format', async () => {
      const request = createMockRequest('http://localhost:3000/api/categories', 'POST', {
        ...validBody,
        color: 'not-a-color',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('returns 400 for missing name', async () => {
      const request = createMockRequest('http://localhost:3000/api/categories', 'POST', {
        color: '#FF0000',
        type: 'expense',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('returns 400 for invalid type', async () => {
      const request = createMockRequest('http://localhost:3000/api/categories', 'POST', {
        ...validBody,
        type: 'invalid',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('http://localhost:3000/api/categories', 'POST', validBody);
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  // ─── PUT /api/categories/[id] ─────────────────────────────────────────────

  describe('PUT /api/categories/[id] — edit category', () => {
    const params = Promise.resolve({ id: catId });

    test('updates name and color of custom category', async () => {
      // MODELLED ON A CALL THAT DOES NOT HAPPEN, until 2026-11-18. This queued
      // three single() results - fetch, "no duplicate", update - but the
      // duplicate check uses maybeSingle(). So the "no duplicate" { data: null }
      // was what the UPDATE received, the intended update row was never
      // consumed, and the test passed because `toBeDefined()` accepts null.
      // In real call order, the update now returns the updated row, and the
      // assertion below checks it.
      wire({
        categories: [
          {
            data: { id: catId, name: 'Old Name', is_predefined: false, type: 'expense' },
            error: null,
          }, // fetch existing (not predefined)
          { data: null, error: null }, // duplicate check: none
          {
            data: { id: catId, name: 'New Name', color: '#AABBCC', is_predefined: false },
            error: null,
          }, // the update
        ],
      });

      const request = createMockRequest(`http://localhost:3000/api/categories/${catId}`, 'PUT', {
        name: 'New Name',
        color: '#AABBCC',
      });
      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toMatchObject({ name: 'New Name', color: '#AABBCC' });
      expect(calls('categories', 'update').length).toBeGreaterThan(0);
    });

    test('returns 403 when trying to modify a predefined category', async () => {
      wire({
        categories: {
          data: { id: 'cat-001', name: 'Food', is_predefined: true, type: 'expense' },
          error: null,
        },
      });

      const request = createMockRequest('http://localhost:3000/api/categories/cat-001', 'PUT', {
        name: 'New Name',
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'cat-001' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('predefined');
    });

    test('returns 404 when category does not exist or does not belong to user', async () => {
      wire({ categories: { data: null, error: { code: 'PGRST116', message: 'No rows found' } } });

      const request = createMockRequest(`http://localhost:3000/api/categories/${catId}`, 'PUT', {
        name: 'Updated',
      });
      const response = await PUT(request, { params });

      expect(response.status).toBe(404);
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest(`http://localhost:3000/api/categories/${catId}`, 'PUT', {
        name: 'Updated',
      });
      const response = await PUT(request, { params });

      expect(response.status).toBe(401);
    });
  });

  // ─── DELETE /api/categories/[id] ──────────────────────────────────────────

  describe('DELETE /api/categories/[id] — delete category', () => {
    const params = Promise.resolve({ id: catId });

    test('deletes an unused category directly (no reassignment)', async () => {
      wire({
        categories: [
          {
            data: { id: catId, name: 'My Category', is_predefined: false, type: 'expense' },
            error: null,
          },
          { data: null, error: null },
        ], // fetch, delete
        transactions: { data: null, count: 0, error: null }, // usage count = 0
      });

      const request = createMockRequest(`http://localhost:3000/api/categories/${catId}`, 'DELETE');
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(calls('transactions', 'update')).toEqual([]); // no reassignment
      expect(calls('categories', 'delete').length).toBeGreaterThan(0);
    });

    test('asks for reassignment (409) when the category is in use and no target is given', async () => {
      wire({
        categories: {
          data: { id: catId, name: 'My Category', is_predefined: false, type: 'expense' },
          error: null,
        },
        transactions: { data: null, count: 3, error: null }, // 3 transactions reference it
      });

      const request = createMockRequest(`http://localhost:3000/api/categories/${catId}`, 'DELETE');
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.requiresReassign).toBe(true);
      expect(data.transactionCount).toBe(3);
      expect(calls('categories', 'delete')).toEqual([]);
    });

    test('reassigns transactions to a same-type target, then deletes', async () => {
      wire({
        categories: [
          {
            data: { id: catId, name: 'My Category', is_predefined: false, type: 'expense' },
            error: null,
          }, // fetch
          { data: { id: 'target-cat', type: 'expense' }, error: null }, // target: same type
          { data: null, error: null }, // delete
        ],
        transactions: [
          { data: null, count: 3, error: null }, // 3 transactions
          { data: null, error: null }, // the reassign update
        ],
      });

      const request = createMockRequest(`http://localhost:3000/api/categories/${catId}`, 'DELETE', {
        reassignTo: 'target-cat',
      });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(calls('transactions', 'update')).toContainEqual([{ category_id: 'target-cat' }]);
      expect(calls('categories', 'delete').length).toBeGreaterThan(0);
    });

    test('rejects reassignment to a different-type category (400)', async () => {
      wire({
        categories: [
          {
            data: { id: catId, name: 'My Category', is_predefined: false, type: 'expense' },
            error: null,
          }, // fetch
          { data: { id: 'income-cat', type: 'income' }, error: null }, // target: a type mismatch
        ],
        transactions: { data: null, count: 3, error: null },
      });

      const request = createMockRequest(`http://localhost:3000/api/categories/${catId}`, 'DELETE', {
        reassignTo: 'income-cat',
      });
      const response = await DELETE(request, { params });

      expect(response.status).toBe(400);
      expect(calls('transactions', 'update')).toEqual([]);
      expect(calls('categories', 'delete')).toEqual([]);
    });

    test('returns 403 when trying to delete a predefined category', async () => {
      wire({
        categories: { data: { id: 'cat-001', name: 'Food', is_predefined: true }, error: null },
      });

      const request = createMockRequest('http://localhost:3000/api/categories/cat-001', 'DELETE');
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cat-001' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('predefined');
    });

    test('returns 404 when category not found', async () => {
      wire({ categories: { data: null, error: { code: 'PGRST116', message: 'No rows found' } } });

      const request = createMockRequest(`http://localhost:3000/api/categories/${catId}`, 'DELETE');
      const response = await DELETE(request, { params });

      expect(response.status).toBe(404);
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest(`http://localhost:3000/api/categories/${catId}`, 'DELETE');
      const response = await DELETE(request, { params });

      expect(response.status).toBe(401);
    });
  });
});
