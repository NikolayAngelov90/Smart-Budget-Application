/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for /api/user/profile route
 */

import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/user/profile/route';
import { createClient } from '@/lib/supabase/server';
import * as settingsService from '@/lib/services/settingsService';
import type { UserProfile } from '@/types/user.types';

// Mock Supabase client
jest.mock('@/lib/supabase/server');
// Mock settings service
jest.mock('@/lib/services/settingsService');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetUserProfile = settingsService.getUserProfile as jest.MockedFunction<
  typeof settingsService.getUserProfile
>;
const mockUpdateUserProfile = settingsService.updateUserProfile as jest.MockedFunction<
  typeof settingsService.updateUserProfile
>;

describe('/api/user/profile', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  describe('GET /api/user/profile', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    const mockProfile: UserProfile = {
      id: 'user-123',
      display_name: 'Test User',
      email: 'test@example.com',
      profile_picture_url: null,
      preferences: {
        currency_format: 'USD',
        date_format: 'MM/DD/YYYY',
        onboarding_completed: false,
        language: 'en',
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    test('returns user profile for authenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockGetUserProfile.mockResolvedValue(mockProfile);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual(mockProfile);
      expect(mockGetUserProfile).toHaveBeenCalledWith(mockUser.id);
    });

    test('returns 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Unauthorized' },
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.message).toBe('Unauthorized');
      expect(mockGetUserProfile).not.toHaveBeenCalled();
    });

    test('returns 404 when profile not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockGetUserProfile.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toBe('Profile not found');
    });

    test('returns 500 on database error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockGetUserProfile.mockRejectedValue(new Error('Database connection failed'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Failed to fetch user profile');
    });
  });

  describe('PUT /api/user/profile', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    const mockUpdatedProfile: UserProfile = {
      id: 'user-123',
      display_name: 'Updated Name',
      email: 'test@example.com',
      profile_picture_url: null,
      preferences: {
        currency_format: 'EUR',
        date_format: 'DD/MM/YYYY',
        onboarding_completed: true,
        language: 'en',
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    };

    test('updates profile with valid data', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockUpdateUserProfile.mockResolvedValue(mockUpdatedProfile);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: 'Updated Name',
          preferences: {
            currency_format: 'EUR',
            date_format: 'DD/MM/YYYY',
            onboarding_completed: true,
          },
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual(mockUpdatedProfile);
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(mockUser.id, {
        display_name: 'Updated Name',
        preferences: {
          currency_format: 'EUR',
          date_format: 'DD/MM/YYYY',
          onboarding_completed: true,
        },
      });
    });

    test('updates only display_name when preferences not provided', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockUpdateUserProfile.mockResolvedValue({
        ...mockUpdatedProfile,
        display_name: 'Just Name',
      });

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: 'Just Name',
        }),
      });

      const response = await PUT(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(mockUser.id, {
        display_name: 'Just Name',
      });
    });

    test('updates only preferences when display_name not provided', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockUpdateUserProfile.mockResolvedValue(mockUpdatedProfile);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            currency_format: 'EUR',
            date_format: 'DD/MM/YYYY',
          },
        }),
      });

      const response = await PUT(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(mockUser.id, {
        preferences: {
          currency_format: 'EUR',
          date_format: 'DD/MM/YYYY',
        },
      });
    });

    test('returns 401 when user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Unauthorized' },
      });

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: 'New Name',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.message).toBe('Unauthorized');
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });

    test('returns 500 when request body is invalid JSON', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Failed to update user profile');
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });

    test('returns 400 when neither display_name nor preferences provided', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Invalid request');
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });

    test('returns 500 when update fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockUpdateUserProfile.mockRejectedValue(new Error('Update failed'));

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: 'New Name',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Failed to update user profile');
    });
  });

  // spec-cyrillic-names: the display name follows the shared rule.
  describe('PUT display_name - names in any script', () => {
    const put = (body: unknown) =>
      PUT(
        new NextRequest('http://localhost:3000/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });
      mockUpdateUserProfile.mockResolvedValue({ id: 'user-123' } as never);
    });

    test('stores a Bulgarian name normalised', async () => {
      const res = await put({ display_name: '  Иван   Петров ' });
      expect(res.status).toBe(200);
      expect(mockUpdateUserProfile).toHaveBeenCalledWith('user-123', {
        display_name: 'Иван Петров',
      });
    });

    test.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['null', null],
    ])('%s CLEARS the name (stored as NULL, never as an empty string)', async (_label, value) => {
      const res = await put({ display_name: value });
      expect(res.status).toBe(200);
      expect(mockUpdateUserProfile).toHaveBeenCalledWith('user-123', { display_name: null });
    });

    test.each(['Ива\u200Bн', 'Ива\tн', 'Иван 🙂'])(
      'refuses %j with 400, before any write',
      async (name) => {
        const res = await put({ display_name: name });
        expect(res.status).toBe(400);
        expect((await res.json()).error.problem).toBe('invalidCharacters');
        expect(mockUpdateUserProfile).not.toHaveBeenCalled();
      }
    );

    test.each([
      ['ж'.repeat(101), 'tooLong'],
      ['- -', 'needsLetter'],
    ])('refuses %j with 400 and problem %s', async (name, problem) => {
      const res = await put({ display_name: name });
      expect(res.status).toBe(400);
      expect((await res.json()).error.problem).toBe(problem);
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });

    test.each([
      ['a number', 42],
      ['an object', { name: 'Иван' }],
      ['an array', ['Иван']],
    ])(
      'a display_name that is %s is a malformed request (400), not a cleared name',
      async (_l, value) => {
        const res = await put({ display_name: value });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toEqual({
          message: 'Invalid request',
          details: 'display_name must be a string or null',
        });
        expect(mockUpdateUserProfile).not.toHaveBeenCalled();
      }
    );
  });
});
