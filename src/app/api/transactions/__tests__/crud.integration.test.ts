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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQuery: any;

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

  beforeEach(() => {
    jest.clearAllMocks();

    let resolvedValue = { data: null, error: null };

    mockQuery = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockTransaction, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: jest.fn((resolve: any) => Promise.resolve(resolvedValue).then(resolve)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockResolvedValue: (value: any) => {
        resolvedValue = value;
        return mockQuery;
      },
    };

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: userId } },
          error: null,
        }),
      },
      from: jest.fn(() => mockQuery),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
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
      mockQuery.single.mockResolvedValue({ data: mockTransaction, error: null });

      const request = createMockRequest(
        'http://localhost:3000/api/transactions',
        'POST',
        validBody
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
      expect(mockQuery.insert).toHaveBeenCalled();
    });

    test('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
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

    test('returns 400 for missing required amount field', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/transactions',
        'POST',
        { type: 'expense', category_id: categoryId, date: '2026-01-15' }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('returns 400 for negative amount', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/transactions',
        'POST',
        { ...validBody, amount: -10 }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('stores currency and exchange_rate when provided', async () => {
      mockQuery.single.mockResolvedValue({
        data: { ...mockTransaction, currency: 'USD', exchange_rate: 1.08 },
        error: null,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/transactions',
        'POST',
        { ...validBody, currency: 'USD', exchange_rate: 1.08 }
      );
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockQuery.insert).toHaveBeenCalled();
    });

    test('enforces user_id from session (not from body)', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/transactions',
        'POST',
        validBody
      );
      await POST(request);

      // The insert call should use the session user_id
      const insertCall = mockQuery.insert.mock.calls[0][0];
      expect(insertCall.user_id).toBe(userId);
    });
  });

  // ─── PUT /api/transactions/[id] ───────────────────────────────────────────

  describe('PUT /api/transactions/[id] — update transaction', () => {
    const params = Promise.resolve({ id: txId });

    test('updates transaction fields and returns 200', async () => {
      mockQuery.single.mockResolvedValue({
        data: { ...mockTransaction, amount: 75.0 },
        error: null,
      });

      const request = createMockRequest(
        `http://localhost:3000/api/transactions/${txId}`,
        'PUT',
        { amount: 75.0 }
      );
      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(mockQuery.update).toHaveBeenCalled();
    });

    test('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const request = createMockRequest(
        `http://localhost:3000/api/transactions/${txId}`,
        'PUT',
        { amount: 75.0 }
      );
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
      const request = createMockRequest(
        `http://localhost:3000/api/transactions/${txId}`,
        'PUT',
        { amount: -5 }
      );
      const response = await PUT(request, { params });

      expect(response.status).toBe(400);
    });

    test('enforces user_id ownership (eq user_id clause)', async () => {
      mockQuery.single.mockResolvedValue({
        data: { ...mockTransaction, notes: 'Updated' },
        error: null,
      });

      const request = createMockRequest(
        `http://localhost:3000/api/transactions/${txId}`,
        'PUT',
        { notes: 'Updated' }
      );
      await PUT(request, { params });

      // Should call eq with user_id to enforce ownership
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', userId);
    });
  });

  // ─── DELETE /api/transactions/[id] ────────────────────────────────────────

  describe('DELETE /api/transactions/[id] — delete transaction', () => {
    const params = Promise.resolve({ id: txId });

    test('deletes transaction and returns 200 with deleted data', async () => {
      // First single() call fetches the transaction before delete
      mockQuery.single
        .mockResolvedValueOnce({ data: mockTransaction, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // The delete then() call
      mockQuery.mockResolvedValue({ data: null, error: null });

      const request = createMockRequest(
        `http://localhost:3000/api/transactions/${txId}`,
        'DELETE'
      );
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.message).toBe('Transaction deleted successfully');
      expect(mockQuery.delete).toHaveBeenCalled();
    });

    test('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const request = createMockRequest(
        `http://localhost:3000/api/transactions/${txId}`,
        'DELETE'
      );
      const response = await DELETE(request, { params });

      expect(response.status).toBe(401);
    });

    test('returns 404 when transaction not found or belongs to another user', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const request = createMockRequest(
        `http://localhost:3000/api/transactions/${txId}`,
        'DELETE'
      );
      const response = await DELETE(request, { params });

      expect(response.status).toBe(404);
    });

    test('enforces user_id ownership when fetching before delete', async () => {
      mockQuery.single.mockResolvedValue({ data: mockTransaction, error: null });
      mockQuery.mockResolvedValue({ data: null, error: null });

      const request = createMockRequest(
        `http://localhost:3000/api/transactions/${txId}`,
        'DELETE'
      );
      await DELETE(request, { params });

      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', userId);
    });
  });
});
