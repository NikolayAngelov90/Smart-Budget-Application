/**
 * Transactions CRUD Integration Tests
 * Story 10.9: AC-10.9.2 — Transaction CRUD integration tests
 *
 * Tests POST /api/transactions (create) and
 *       PUT /api/transactions/[id] (update) and
 *       DELETE /api/transactions/[id] (delete)
 *
 * GET is covered by route.test.ts (all=true export) and all-param.test.ts.
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  // The route schedules insight generation with `after()`. Running the
  // callback here matches production: the work happens, just not before
  // the response. A no-op stub would silently skip the trigger entirely.
  after: (fn: () => unknown) => {
    void fn();
  },
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: new Headers(),
    })),
  },
}));

import { POST } from '@/app/api/transactions/route';
import { PUT, DELETE } from '@/app/api/transactions/[id]/route';
import { createClient } from '@/lib/supabase/server';
import {
  createSupabaseMock,
  type QueryResult,
  type SupabaseMock,
} from '@/test-utils/supabaseChain';

jest.mock('@/lib/supabase/server');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

jest.mock('@/lib/services/insightService', () => ({
  checkAndTriggerForTransactionCount: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequest(url: string, method = 'GET', body?: any): any {
  return {
    url,
    method,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => body,
  };
}

describe('Transaction CRUD Integration Tests (AC-10.9.2)', () => {
  let db: SupabaseMock;

  const userId = 'user-123';
  const txId = 'tx-abc-123';
  const categoryId = 'cat-xyz-456';

  const mockTransaction = {
    id: txId,
    user_id: userId,
    amount: 50.0,
    type: 'expense',
    date: '2026-01-15',
    notes: 'Coffee',
    currency: 'EUR',
    exchange_rate: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    category: { id: categoryId, name: 'Food', color: '#FF6B6B', type: 'expense' },
  };

  /*
   * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. The hand-rolled chain
   * answered EVERY .single() in a test with one value - POST's category check,
   * its insert, PUT's update, DELETE's pre-fetch - and every await with
   * another. Per table, in each handler's real call order:
   *
   *   categories    a valid category (POST/PUT category check)
   *   transactions  [single, awaited]: POST insert | PUT update | DELETE
   *                 pre-fetch, then the DELETE itself
   *
   * The old DELETE test also queued TWO ...Once values on `single` and the
   * route consumed one - the leak class that crosses clearAllMocks into the
   * next test. Gone with the shared chain.
   */
  const CATEGORY = {
    id: categoryId,
    name: 'Food',
    color: '#FF6B6B',
    type: 'expense',
    household_id: null,
  };
  function wire(
    single: QueryResult = { data: mockTransaction, error: null },
    awaited: QueryResult = { data: null, error: null }
  ) {
    db = createSupabaseMock({
      user: { id: userId },
      tables: {
        categories: { data: CATEGORY, error: null },
        transactions: [single, awaited],
      },
    });
    mockCreateClient.mockResolvedValue(db.client);
  }
  const tx = (method: string) => db.allCallsTo('transactions', method);

  beforeEach(() => {
    jest.clearAllMocks();

    wire();
  });

  // ─── POST /api/transactions ────────────────────────────────────────────────

  describe('POST /api/transactions — create transaction', () => {
    const validBody = {
      amount: 50.0,
      type: 'expense',
      category_id: categoryId,
      date: '2026-01-15',
      notes: 'Coffee',
    };

    test('creates transaction and returns 201 with transaction data', async () => {
      wire({ data: mockTransaction, error: null });

      const request = createMockRequest(
        'http://localhost:3000/api/transactions',
        'POST',
        validBody
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
      expect(tx('insert').length).toBeGreaterThan(0);
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const request = createMockRequest(
        'http://localhost:3000/api/transactions',
        'POST',
        validBody
      );
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    // THE 2-DECIMAL LIMIT, which this route's doc comment claimed and nothing
    // enforced. It lived only in the entry modal's zod refine, and that refine
    // split on '.' alone so it did not apply to comma input at all. It was
    // unreachable before the comma fix, because parseFloat("12,505") truncated to
    // 12 long before any decimal rule could matter — the broken parse was masking
    // its own downstream validation.
    //
    // `DECIMAL(12, 2)` does not catch it either: Postgres ROUNDS to two places
    // rather than rejecting, so the stored number differs from the one sent with
    // no error raised.
    test.each([1.005, 12.505, 0.0000001])(
      'returns 400 for %p (more than 2 decimals)',
      async (amount) => {
        const request = createMockRequest('http://localhost:3000/api/transactions', 'POST', {
          ...validBody,
          amount,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toMatch(/2 decimal places/);
      }
    );

    // THE FLOAT TRAP, and the first version of that guard fell into it. Written as
    // `amount * 100 === Math.round(amount * 100)` it rejected ordinary amounts:
    // 0.07 * 100 is 7.000000000000001 and 19.99 * 100 is 1998.9999999999998. An
    // absolute epsilon fails at magnitude instead — 1234567.89 * 100 is
    // 123456788.99999999. These are the values that catch a regression to either
    // form.
    test.each([12.5, 0.07, 0.29, 19.99, 8.11, 1234567.89, 1000, 12])(
      'accepts %p, which a naive *100 check rejects',
      async (amount) => {
        wire({ data: mockTransaction, error: null });

        const request = createMockRequest('http://localhost:3000/api/transactions', 'POST', {
          ...validBody,
          amount,
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      }
    );

    test('returns 400 for missing required amount field', async () => {
      const request = createMockRequest('http://localhost:3000/api/transactions', 'POST', {
        type: 'expense',
        category_id: categoryId,
        date: '2026-01-15',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('returns 400 for negative amount', async () => {
      const request = createMockRequest('http://localhost:3000/api/transactions', 'POST', {
        ...validBody,
        amount: -10,
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('stores currency and exchange_rate when provided', async () => {
      wire({
        data: { ...mockTransaction, currency: 'USD', exchange_rate: 1.08 },
        error: null,
      });

      const request = createMockRequest('http://localhost:3000/api/transactions', 'POST', {
        ...validBody,
        currency: 'USD',
        exchange_rate: 1.08,
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(tx('insert').length).toBeGreaterThan(0);
    });

    test('enforces user_id from session (not from body)', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/transactions',
        'POST',
        validBody
      );
      await POST(request);

      // The insert call should use the session user_id
      const insertCall = tx('insert')[0]![0] as Record<string, unknown>;
      expect(insertCall.user_id).toBe(userId);
    });
  });

  // ─── PUT /api/transactions/[id] ───────────────────────────────────────────

  describe('PUT /api/transactions/[id] — update transaction', () => {
    const params = Promise.resolve({ id: txId });

    test('updates transaction fields and returns 200', async () => {
      wire({
        data: { ...mockTransaction, amount: 75.0 },
        error: null,
      });

      const request = createMockRequest(`http://localhost:3000/api/transactions/${txId}`, 'PUT', {
        amount: 75.0,
      });
      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(tx('update').length).toBeGreaterThan(0);
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const request = createMockRequest(`http://localhost:3000/api/transactions/${txId}`, 'PUT', {
        amount: 75.0,
      });
      const response = await PUT(request, { params });

      expect(response.status).toBe(401);
    });

    test('returns 400 when no fields provided for update', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/transactions/${txId}`,
        'PUT',
        {}
      );
      const response = await PUT(request, { params });

      expect(response.status).toBe(400);
    });

    test('returns 400 for negative amount update', async () => {
      const request = createMockRequest(`http://localhost:3000/api/transactions/${txId}`, 'PUT', {
        amount: -5,
      });
      const response = await PUT(request, { params });

      expect(response.status).toBe(400);
    });

    test('enforces user_id ownership (eq user_id clause)', async () => {
      wire({
        data: { ...mockTransaction, notes: 'Updated' },
        error: null,
      });

      const request = createMockRequest(`http://localhost:3000/api/transactions/${txId}`, 'PUT', {
        notes: 'Updated',
      });
      await PUT(request, { params });

      // Should call eq with user_id to enforce ownership
      // PER CHAIN: the UPDATE itself is scoped to this user.
      expect(db.callsTo('transactions', 'eq', 0)).toContainEqual(['user_id', userId]);
    });
  });

  // ─── DELETE /api/transactions/[id] ────────────────────────────────────────

  describe('DELETE /api/transactions/[id] — delete transaction', () => {
    const params = Promise.resolve({ id: txId });

    test('deletes transaction and returns 200 with deleted data', async () => {
      // The pre-fetch returns the row, then the delete succeeds.
      wire({ data: mockTransaction, error: null }, { data: null, error: null });

      const request = createMockRequest(`http://localhost:3000/api/transactions/${txId}`, 'DELETE');
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.message).toBe('Transaction deleted successfully');
      expect(tx('delete').length).toBeGreaterThan(0);
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const request = createMockRequest(`http://localhost:3000/api/transactions/${txId}`, 'DELETE');
      const response = await DELETE(request, { params });

      expect(response.status).toBe(401);
    });

    test('returns 404 when transaction not found or belongs to another user', async () => {
      wire({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const request = createMockRequest(`http://localhost:3000/api/transactions/${txId}`, 'DELETE');
      const response = await DELETE(request, { params });

      expect(response.status).toBe(404);
    });

    test('enforces user_id ownership when fetching before delete', async () => {
      wire({ data: mockTransaction, error: null }, { data: null, error: null });

      const request = createMockRequest(`http://localhost:3000/api/transactions/${txId}`, 'DELETE');
      await DELETE(request, { params });

      // PER CHAIN, not aggregated. The name claims the FETCH is scoped, and an
      // aggregate across both transactions chains stayed green with the
      // fetch's user_id filter deleted, because the delete still carried one
      // (mutation-tested 2026-11-18). Both are now pinned separately.
      expect(db.callsTo('transactions', 'eq', 0)).toContainEqual(['user_id', userId]); // the pre-fetch
      expect(db.callsTo('transactions', 'eq', 1)).toContainEqual(['user_id', userId]); // the delete
    });
  });
});
