/**
 * Onboarding API Integration Tests
 * Story 10.9: AC-10.9.1 — Authentication flow integration tests
 *
 * Tests POST /api/auth/onboarding which seeds default categories for new users.
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

import { POST } from '@/app/api/auth/onboarding/route';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

jest.mock('@/lib/services/seedCategoriesService', () => ({
  seedDefaultCategories: jest.fn(),
}));

import { seedDefaultCategories } from '@/lib/services/seedCategoriesService';
const mockSeedDefaultCategories = seedDefaultCategories as jest.MockedFunction<
  typeof seedDefaultCategories
>;

describe('POST /api/auth/onboarding — Integration Tests (AC-10.9.1)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: mockUserId, email: 'test@example.com' } },
          error: null,
        }),
      },
    };

    mockCreateClient.mockResolvedValue(mockSupabase);

    mockSeedDefaultCategories.mockResolvedValue({
      success: true,
      count: 12,
      categories: Array.from({ length: 12 }, (_, i) => ({
        id: `cat-${i}`,
        name: `Category ${i}`,
        color: '#FF0000',
        type: i % 2 === 0 ? 'expense' : 'income',
        is_predefined: true,
        user_id: mockUserId,
        created_at: new Date().toISOString(),
      })),
    });
  });

  test('seeds default categories for authenticated user and returns count', async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(12);
    expect(data.categories).toHaveLength(12);
    expect(mockSeedDefaultCategories).toHaveBeenCalledWith(mockUserId);
  });

  test('returns 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockSeedDefaultCategories).not.toHaveBeenCalled();
  });

  test('returns 401 when auth returns null user without error', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST();

    expect(response.status).toBe(401);
  });

  test('returns 400 for invalid UUID user id format', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'not-a-uuid', email: 'test@example.com' } },
      error: null,
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid user ID format');
  });

  test('returns 500 when category seeding fails', async () => {
    mockSeedDefaultCategories.mockRejectedValue(new Error('DB connection failed'));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to seed categories');
  });

  test('calls seedDefaultCategories with the authenticated user id', async () => {
    await POST();

    expect(mockSeedDefaultCategories).toHaveBeenCalledTimes(1);
    expect(mockSeedDefaultCategories).toHaveBeenCalledWith(mockUserId);
  });
});
