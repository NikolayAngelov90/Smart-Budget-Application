/**
 * Transactions API Route Integration Tests
 * Story 8.1: Export Transactions to CSV - API Support
 *
 * Tests for ?all=true parameter to bypass pagination for CSV export
 */

/**
 * @jest-environment node
 */

// Mock Next.js server before importing route
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: new Headers(),
    })),
  },
}));

import { GET } from '../route';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase
jest.mock('@/lib/supabase/server');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// Mock insight service
jest.mock('@/lib/services/insightService', () => ({
  checkAndTriggerForTransactionCount: jest.fn(),
}));

// Helper to create mock NextRequest
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequest(url: string): any {
  return {
    url,
    method: 'GET',
    headers: new Headers(),
  };
}

describe('GET /api/transactions - Story 8.1: ?all=true support', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQuery: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mutable resolved value that tests can update
    let resolvedValue = {
      data: [],
      error: null,
      count: 0,
    };

    // Create a promise-like query object that chains and resolves
    mockQuery = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      // Make it thenable so it can be awaited
      then: jest.fn((resolve) => Promise.resolve(resolvedValue).then(resolve)),
      // Helper to set resolved value
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockResolvedValue: (value: any) => {
        resolvedValue = value;
        return mockQuery;
      },
    };

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: jest.fn(() => mockQuery),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  // AC-8.1.5: Test ?all=true bypasses pagination and returns all user transactions
  test('returns all transactions without pagination when all=true', async () => {
    // Mock 150 transactions (more than default limit of 100)
    const mockTransactions = Array.from({ length: 150 }, (_, i) => ({
      id: `tx-${i}`,
      amount: 10.00 + i,
      type: i % 2 === 0 ? 'income' : 'expense',
      date: '2025-12-14',
      notes: `Transaction ${i}`,
      created_at: '2025-12-14T10:30:00Z',
      user_id: 'user-123',
      category_id: 'cat-1',
      category: {
        id: 'cat-1',
        name: 'Test Category',
        color: '#FF0000',
        type: 'expense',
      },
    }));

    // Mock query to return all transactions
    mockQuery.mockResolvedValue({
      data: mockTransactions,
      error: null,
      count: 150,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=true');
    const response = await GET(request);
    const data = await response.json();

    // Verify range was NOT called (pagination bypassed)
    expect(mockQuery.range).not.toHaveBeenCalled();

    // Verify all transactions returned
    expect(data.data).toHaveLength(150);
    expect(data.count).toBe(150);
  });

  // Test default behavior without ?all=true (pagination should work)
  test('applies pagination when all=true is not provided', async () => {
    const mockTransactions = Array.from({ length: 100 }, (_, i) => ({
      id: `tx-${i}`,
      amount: 10.00 + i,
      type: 'expense',
      date: '2025-12-14',
      notes: null,
      created_at: '2025-12-14T10:30:00Z',
      user_id: 'user-123',
      category_id: 'cat-1',
      category: {
        id: 'cat-1',
        name: 'Test Category',
        color: '#FF0000',
        type: 'expense',
      },
    }));

    mockQuery.mockResolvedValue({
      data: mockTransactions,
      error: null,
      count: 150,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions');
    await GET(request);

    // Verify range WAS called (pagination applied)
    expect(mockQuery.range).toHaveBeenCalledWith(0, 99); // offset 0, limit 100
  });

  // Test with explicit all=false (pagination should work)
  test('applies pagination when all=false', async () => {
    const mockTransactions = Array.from({ length: 100 }, (_, i) => ({
      id: `tx-${i}`,
      amount: 10.00,
      type: 'expense',
      date: '2025-12-14',
      notes: null,
      created_at: '2025-12-14T10:30:00Z',
      user_id: 'user-123',
      category_id: 'cat-1',
      category: {
        id: 'cat-1',
        name: 'Test Category',
        color: '#FF0000',
        type: 'expense',
      },
    }));

    mockQuery.mockResolvedValue({
      data: mockTransactions,
      error: null,
      count: 150,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=false');
    await GET(request);

    // Verify range WAS called (pagination applied)
    expect(mockQuery.range).toHaveBeenCalled();
  });

  // AC-8.1.5: Test RLS enforcement (user A cannot export user B's transactions via all=true)
  test('enforces RLS when all=true (user can only export own transactions)', async () => {
    mockQuery.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=true');
    await GET(request);

    // Verify eq('user_id', user.id) was called (RLS enforcement)
    expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  // Test maintaining sort order with ?all=true
  test('maintains date descending sort order when all=true', async () => {
    mockQuery.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=true');
    await GET(request);

    // Verify order was called with correct parameters
    expect(mockQuery.order).toHaveBeenCalledWith('date', { ascending: false });
    expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  // Test combining ?all=true with other filters
  test('combines all=true with date filters', async () => {
    mockQuery.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=true&startDate=2025-01-01&endDate=2025-12-31');
    await GET(request);

    // Verify filters were applied
    expect(mockQuery.gte).toHaveBeenCalledWith('date', '2025-01-01');
    expect(mockQuery.lte).toHaveBeenCalledWith('date', '2025-12-31');

    // Verify pagination was NOT applied
    expect(mockQuery.range).not.toHaveBeenCalled();
  });

  // Test combining ?all=true with category filter
  test('combines all=true with category filter', async () => {
    mockQuery.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=true&category=cat-123');
    await GET(request);

    // Verify category filter was applied
    expect(mockQuery.eq).toHaveBeenCalledWith('category_id', 'cat-123');

    // Verify pagination was NOT applied
    expect(mockQuery.range).not.toHaveBeenCalled();
  });

  // Test combining ?all=true with type filter
  test('combines all=true with type filter', async () => {
    mockQuery.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=true&type=expense');
    await GET(request);

    // Verify type filter was applied
    expect(mockQuery.eq).toHaveBeenCalledWith('type', 'expense');

    // Verify pagination was NOT applied
    expect(mockQuery.range).not.toHaveBeenCalled();
  });

  // Test unauthorized access with ?all=true
  test('returns 401 for unauthorized user with all=true', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized'),
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=true');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  // Test error handling with ?all=true
  test('handles database error when all=true', async () => {
    mockQuery.mockResolvedValue({
      data: null,
      error: new Error('Database error'),
      count: null,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=true');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to fetch transactions');
  });

  // Test empty result set with ?all=true
  test('returns empty array when no transactions exist with all=true', async () => {
    mockQuery.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    const request = createMockRequest('http://localhost:3001/api/transactions?all=true');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
    expect(data.count).toBe(0);
  });
});
