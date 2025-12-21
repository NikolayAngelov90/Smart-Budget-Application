import { NextRequest } from 'next/server';
/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for /api/user/profile route
 */

import { GET, PUT } from '../route';
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
      expect(data.error).toEqual({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
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
      expect(data.error).toEqual({
        code: 'PROFILE_NOT_FOUND',
        message: 'User profile not found',
      });
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
      expect(data.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user profile',
      });
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
      const data = await response.json();

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
      const data = await response.json();

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
      expect(data.error).toEqual({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });

    test('returns 400 when request body is invalid JSON', async () => {
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

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_REQUEST');
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
      expect(data.error).toEqual({
        code: 'INVALID_REQUEST',
        message: 'Either display_name or preferences must be provided',
      });
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
      expect(data.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user profile',
      });
    });
  });
});
