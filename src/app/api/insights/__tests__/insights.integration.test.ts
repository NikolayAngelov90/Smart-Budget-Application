/**
 * Insights API Integration Tests
 * Story 10.9: AC-10.9.5 — AI insights integration tests
 *
 * Tests:
 * - GET /api/insights (filter by type, dismissed, search, orderBy, pagination)
 * - PUT /api/insights/[id]/dismiss (dismiss an insight)
 * - PUT /api/insights/[id]/undismiss (restore a dismissed insight)
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

import { GET } from '@/app/api/insights/route';
import { PUT as dismissPUT } from '@/app/api/insights/[id]/dismiss/route';
import { PUT as undismissPUT } from '@/app/api/insights/[id]/undismiss/route';
import { createClient } from '@/lib/supabase/server';
import {
  createSupabaseMock,
  type QueryResult,
  type SupabaseMock,
} from '@/test-utils/supabaseChain';

jest.mock('@/lib/supabase/server');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequest(url: string, method = 'GET'): any {
  const parsedUrl = new URL(url);
  return {
    url,
    method,
    headers: new Headers(),
    nextUrl: {
      searchParams: parsedUrl.searchParams,
    },
  };
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001';

const mockInsights = [
  {
    id: VALID_UUID,
    user_id: 'user-123',
    type: 'spending_increase',
    title: 'Food spending increased 30%',
    description: 'Your food spending increased.',
    priority: 4,
    is_dismissed: false,
    dismissed_at: null,
    created_at: '2026-01-15T10:00:00Z',
    metadata: {
      category_name: 'Food',
      current_amount: 520,
      previous_amount: 400,
      percent_change: 30,
    },
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    user_id: 'user-123',
    type: 'budget_recommendation',
    title: 'Consider a budget for Transport',
    description: 'Based on your 3-month average.',
    priority: 3,
    is_dismissed: false,
    dismissed_at: null,
    created_at: '2026-01-14T10:00:00Z',
    metadata: {
      category_name: 'Transport',
      three_month_average: 250,
      recommended_budget: 275,
    },
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    user_id: 'user-123',
    type: 'positive_reinforcement',
    title: 'Great job on Groceries!',
    description: 'You are under budget.',
    priority: 2,
    is_dismissed: true,
    dismissed_at: '2026-01-10T00:00:00Z',
    created_at: '2026-01-10T10:00:00Z',
    metadata: {
      category_name: 'Groceries',
      savings_amount: 80,
      percent_under_budget: 15,
    },
  },
];

describe('Insights API Integration Tests (AC-10.9.5)', () => {
  /*
   * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. One hand-rolled object
   * served as client AND chain for every test, with a home-made
   * `mockResolvedValue` hook to swap its result. Every route here makes exactly
   * ONE `insights` query, so "swap the result" is "rebuild the client with this
   * `insights` result", and the filter assertions read that query's calls.
   */
  let db: SupabaseMock;
  const userId = 'user-123';

  /** The client for this test, whose single `insights` query returns `result`. */
  function insightsReturn(result: QueryResult) {
    db = createSupabaseMock({ tables: { insights: result }, user: { id: userId } });
    mockCreateClient.mockResolvedValue(db.client);
  }

  const calls = (method: string) => db.allCallsTo('insights', method);

  beforeEach(() => {
    jest.clearAllMocks();
    insightsReturn({ data: mockInsights, error: null, count: mockInsights.length });
  });

  // ─── GET /api/insights ────────────────────────────────────────────────────

  describe('GET /api/insights — fetch with filters', () => {
    test('returns all insights with total count', async () => {
      const request = createMockRequest('http://localhost:3000/api/insights');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.insights).toHaveLength(mockInsights.length);
      expect(data.total).toBe(mockInsights.length);
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const request = createMockRequest('http://localhost:3000/api/insights');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    test('filters by type=spending_increase', async () => {
      const filteredInsights = mockInsights.filter((i) => i.type === 'spending_increase');
      insightsReturn({
        data: filteredInsights,
        error: null,
        count: filteredInsights.length,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/insights?type=spending_increase'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(calls('eq')).toContainEqual(['type', 'spending_increase']);
    });

    test('filters by dismissed=false (only active insights)', async () => {
      const activeInsights = mockInsights.filter((i) => !i.is_dismissed);
      insightsReturn({
        data: activeInsights,
        error: null,
        count: activeInsights.length,
      });

      const request = createMockRequest('http://localhost:3000/api/insights?dismissed=false');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(calls('eq')).toContainEqual(['is_dismissed', false]);
    });

    test('filters by dismissed=true (only dismissed insights)', async () => {
      const dismissedInsights = mockInsights.filter((i) => i.is_dismissed);
      insightsReturn({
        data: dismissedInsights,
        error: null,
        count: dismissedInsights.length,
      });

      const request = createMockRequest('http://localhost:3000/api/insights?dismissed=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(calls('eq')).toContainEqual(['is_dismissed', true]);
    });

    test('applies search filter to title and description', async () => {
      insightsReturn({ data: [mockInsights[0]], error: null, count: 1 });

      const request = createMockRequest('http://localhost:3000/api/insights?search=Food');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(calls('or')).toContainEqual([expect.stringContaining('title.ilike.%Food%')]);
    });

    test('applies pagination via limit and offset', async () => {
      const request = createMockRequest('http://localhost:3000/api/insights?limit=10&offset=5');
      await GET(request);

      // range(offset, offset+limit-1) → range(5, 14)
      expect(calls('range')).toContainEqual([5, 14]);
    });

    test('clamps limit to max 100', async () => {
      const request = createMockRequest('http://localhost:3000/api/insights?limit=500');
      await GET(request);

      // Should use clamped limit of 100: range(0, 99)
      expect(calls('range')).toContainEqual([0, 99]);
    });

    test('orders by custom field when orderBy param provided', async () => {
      const request = createMockRequest('http://localhost:3000/api/insights?orderBy=priority');
      await GET(request);

      expect(calls('order')).toContainEqual(['priority', { ascending: true }]);
    });

    test('ignores invalid insight type in type filter', async () => {
      const request = createMockRequest('http://localhost:3000/api/insights?type=invalid_type');
      await GET(request);

      // Should NOT call eq with an invalid type. PAIRED with the presence of
      // eq calls at all, or "no type filter" would also hold for a query that
      // never ran.
      const eqCalls = calls('eq');
      expect(eqCalls.length).toBeGreaterThan(0);
      expect(eqCalls.some((call) => call[0] === 'type')).toBe(false);
    });

    test('returns empty array when no insights match', async () => {
      insightsReturn({ data: [], error: null, count: 0 });

      const request = createMockRequest('http://localhost:3000/api/insights');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.insights).toEqual([]);
      expect(data.total).toBe(0);
    });

    test('returns 500 on database error', async () => {
      insightsReturn({
        data: null,
        error: new Error('DB error'),
        count: null,
      });

      const request = createMockRequest('http://localhost:3000/api/insights');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  // ─── PUT /api/insights/[id]/dismiss ───────────────────────────────────────

  describe('PUT /api/insights/[id]/dismiss — dismiss an insight', () => {
    const params = Promise.resolve({ id: VALID_UUID });

    test('dismisses insight and returns updated record', async () => {
      insightsReturn({
        data: { ...mockInsights[0], is_dismissed: true, dismissed_at: new Date().toISOString() },
        error: null,
      });

      const request = createMockRequest(
        `http://localhost:3000/api/insights/${VALID_UUID}/dismiss`,
        'PUT'
      );
      const response = await dismissPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.insight).toBeDefined();
      expect(calls('update')).toContainEqual([expect.objectContaining({ is_dismissed: true })]);
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest(
        `http://localhost:3000/api/insights/${VALID_UUID}/dismiss`,
        'PUT'
      );
      const response = await dismissPUT(request, { params });

      expect(response.status).toBe(401);
    });

    test('returns 400 for invalid UUID format', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/insights/not-a-uuid/dismiss',
        'PUT'
      );
      const response = await dismissPUT(request, {
        params: Promise.resolve({ id: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });

    test('returns 404 when insight not found (PGRST116)', async () => {
      insightsReturn({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const request = createMockRequest(
        `http://localhost:3000/api/insights/${VALID_UUID}/dismiss`,
        'PUT'
      );
      const response = await dismissPUT(request, { params });

      expect(response.status).toBe(404);
    });
  });

  // ─── PUT /api/insights/[id]/undismiss ─────────────────────────────────────

  describe('PUT /api/insights/[id]/undismiss — restore dismissed insight', () => {
    const params = Promise.resolve({ id: VALID_UUID });

    test('restores dismissed insight (sets is_dismissed=false)', async () => {
      insightsReturn({
        data: { ...mockInsights[2], is_dismissed: false, dismissed_at: null },
        error: null,
      });

      const request = createMockRequest(
        `http://localhost:3000/api/insights/${VALID_UUID}/undismiss`,
        'PUT'
      );
      const response = await undismissPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(calls('update')).toContainEqual([expect.objectContaining({ is_dismissed: false })]);
    });

    test('returns 401 when unauthenticated', async () => {
      db.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest(
        `http://localhost:3000/api/insights/${VALID_UUID}/undismiss`,
        'PUT'
      );
      const response = await undismissPUT(request, { params });

      expect(response.status).toBe(401);
    });

    test('returns 400 for invalid UUID format', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/insights/bad-id/undismiss',
        'PUT'
      );
      const response = await undismissPUT(request, {
        params: Promise.resolve({ id: 'bad-id' }),
      });

      expect(response.status).toBe(400);
    });
  });
});
