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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQuery: any;

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

    let resolvedValue: { data: unknown; error: null; count?: number } = {
      data: [],
      error: null,
      count: 0,
    };

    mockQuery = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
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

  // ─── GET /api/categories ──────────────────────────────────────────────────

  describe('GET /api/categories — list with usage stats', () => {
    test('returns categories with usage stats and recent subset', async () => {
      // First query: categories list
      // Second query: transaction usage stats
      mockQuery.then
        .mockImplementationOnce((resolve: (v: unknown) => void) =>
          Promise.resolve({ data: mockCategories, error: null }).then(resolve)
        )
        .mockImplementationOnce((resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(resolve)
        );

      const request = createMockRequest('http://localhost:3000/api/categories');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.recent).toBeDefined();
      expect(data.count).toBeDefined();
    });

    test('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const request = createMockRequest('http://localhost:3000/api/categories');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    test('filters categories by type when type param provided', async () => {
      mockQuery.then
        .mockImplementationOnce((resolve: (v: unknown) => void) =>
          Promise.resolve({
            data: [mockCategories[0]],
            error: null,
          }).then(resolve)
        )
        .mockImplementationOnce((resolve: (v: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(resolve)
        );

      const request = createMockRequest(
        'http://localhost:3000/api/categories?type=expense'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockQuery.eq).toHaveBeenCalledWith('type', 'expense');
    });

    test('returns 500 on database error', async () => {
      mockQuery.then.mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({
          data: null,
          error: new Error('DB error'),
        }).then(resolve)
      );

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
      // maybeSingle for duplicate check: not found
      mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
      // single for insert result
      mockQuery.single.mockResolvedValue({
        data: {
          id: catId,
          ...validBody,
          is_predefined: false,
          user_id: userId,
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/categories',
        'POST',
        validBody
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
      expect(mockQuery.insert).toHaveBeenCalled();
    });

    test('returns 409 when category name already exists for same type', async () => {
      // Duplicate found
      mockQuery.maybeSingle.mockResolvedValue({
        data: { id: 'existing-cat', name: 'My Category' },
        error: null,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/categories',
        'POST',
        validBody
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });

    test('returns 400 for invalid color format', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/categories',
        'POST',
        { ...validBody, color: 'not-a-color' }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('returns 400 for missing name', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/categories',
        'POST',
        { color: '#FF0000', type: 'expense' }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('returns 400 for invalid type', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/categories',
        'POST',
        { ...validBody, type: 'invalid' }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    test('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/categories',
        'POST',
        validBody
      );
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  // ─── PUT /api/categories/[id] ─────────────────────────────────────────────

  describe('PUT /api/categories/[id] — edit category', () => {
    const params = Promise.resolve({ id: catId });

    test('updates name and color of custom category', async () => {
      // Fetch existing (not predefined)
      mockQuery.single
        .mockResolvedValueOnce({
          data: { id: catId, name: 'Old Name', is_predefined: false, type: 'expense' },
          error: null,
        })
        // No duplicate found
        .mockResolvedValueOnce({ data: null, error: null })
        // Update result
        .mockResolvedValueOnce({
          data: { id: catId, name: 'New Name', color: '#AABBCC', is_predefined: false },
          error: null,
        });

      const request = createMockRequest(
        `http://localhost:3000/api/categories/${catId}`,
        'PUT',
        { name: 'New Name', color: '#AABBCC' }
      );
      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(mockQuery.update).toHaveBeenCalled();
    });

    test('returns 403 when trying to modify a predefined category', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'cat-001', name: 'Food', is_predefined: true, type: 'expense' },
        error: null,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/categories/cat-001',
        'PUT',
        { name: 'New Name' }
      );
      const response = await PUT(request, { params: Promise.resolve({ id: 'cat-001' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('predefined');
    });

    test('returns 404 when category does not exist or does not belong to user', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const request = createMockRequest(
        `http://localhost:3000/api/categories/${catId}`,
        'PUT',
        { name: 'Updated' }
      );
      const response = await PUT(request, { params });

      expect(response.status).toBe(404);
    });

    test('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest(
        `http://localhost:3000/api/categories/${catId}`,
        'PUT',
        { name: 'Updated' }
      );
      const response = await PUT(request, { params });

      expect(response.status).toBe(401);
    });
  });

  // ─── DELETE /api/categories/[id] ──────────────────────────────────────────

  describe('DELETE /api/categories/[id] — delete category', () => {
    const params = Promise.resolve({ id: catId });

    test('deletes category after orphaning linked transactions', async () => {
      // Fetch category
      mockQuery.single.mockResolvedValueOnce({
        data: { id: catId, name: 'My Category', is_predefined: false },
        error: null,
      });

      // Count transactions (3 exist)
      mockQuery.then.mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ count: 3, error: null }).then(resolve)
      );

      // Orphan transactions (update)
      mockQuery.then.mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      );

      // Delete category
      mockQuery.then.mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      );

      const request = createMockRequest(
        `http://localhost:3000/api/categories/${catId}`,
        'DELETE'
      );
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockQuery.delete).toHaveBeenCalled();
    });

    test('returns 403 when trying to delete a predefined category', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'cat-001', name: 'Food', is_predefined: true },
        error: null,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/categories/cat-001',
        'DELETE'
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cat-001' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('predefined');
    });

    test('returns 404 when category not found', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const request = createMockRequest(
        `http://localhost:3000/api/categories/${catId}`,
        'DELETE'
      );
      const response = await DELETE(request, { params });

      expect(response.status).toBe(404);
    });

    test('returns 401 when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest(
        `http://localhost:3000/api/categories/${catId}`,
        'DELETE'
      );
      const response = await DELETE(request, { params });

      expect(response.status).toBe(401);
    });
  });
});
