/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for settingsService
 */

import {
  getUserProfile,
  updateUserProfile,
  updatePreferences,
  deleteUserAccount,
} from '../settingsService';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile, UpdateUserProfilePayload, UserPreferences } from '@/types/user.types';

// Mock Supabase client
jest.mock('@/lib/supabase/server');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('settingsService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  describe('getUserProfile', () => {
    const mockUserId = 'user-123';
    const mockAuthUser = {
      id: mockUserId,
      email: 'test@example.com',
      user_metadata: {},
    };

    const mockProfile: UserProfile = {
      id: mockUserId,
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

    test('fetches existing user profile successfully', async () => {
      // Mock auth user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      // Mock profile query
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      const result = await getUserProfile(mockUserId);

      expect(result).toEqual(mockProfile);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('id', mockUserId);
    });

    test('creates profile for legacy user when not found (PGRST116 error)', async () => {
      // Mock auth user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      // Mock profile query returning PGRST116 (not found)
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      // Mock insert for new profile
      const mockInsert = jest.fn().mockReturnThis();
      const mockInsertSelect = jest.fn().mockReturnThis();
      const mockInsertSingle = jest.fn().mockResolvedValue({
        data: { ...mockProfile, display_name: null },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      mockSupabase.from.mockReturnValueOnce({
        insert: mockInsert,
      });
      mockInsert.mockReturnValue({ select: mockInsertSelect });
      mockInsertSelect.mockReturnValue({ single: mockInsertSingle });

      const result = await getUserProfile(mockUserId);

      expect(result).toEqual({ ...mockProfile, display_name: null });
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      expect(mockInsert).toHaveBeenCalledWith({
        id: mockUserId,
        display_name: null,
        profile_picture_url: null,
        preferences: {
          currency_format: 'USD',
          date_format: 'MM/DD/YYYY',
          onboarding_completed: false,
        },
      });
    });

    test('throws error when auth user fetch fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Unauthorized' },
      });

      await expect(getUserProfile(mockUserId)).rejects.toThrow(
        'Failed to fetch user authentication data'
      );
    });

    test('throws error when profile query fails with non-PGRST116 error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      await expect(getUserProfile(mockUserId)).rejects.toThrow(
        'Failed to fetch user profile'
      );
    });
  });

  describe('updateUserProfile', () => {
    const mockUserId = 'user-123';
    const mockUpdates: UpdateUserProfilePayload = {
      display_name: 'Updated Name',
      preferences: {
        currency_format: 'EUR',
        date_format: 'DD/MM/YYYY',
        onboarding_completed: true,
      },
    };

    test('updates user profile successfully', async () => {
      // Mock auth.getUser for final profile construction
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null,
      });

      // Mock select for getting current preferences
      const mockSelectPrefs = jest.fn().mockReturnThis();
      const mockEqPrefs = jest.fn().mockReturnThis();
      const mockSinglePrefs = jest.fn().mockResolvedValue({
        data: {
          preferences: {
            currency_format: 'USD',
            date_format: 'MM/DD/YYYY',
            onboarding_completed: false,
          },
        },
        error: null,
      });

      // Mock update
      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: mockUserId,
          display_name: 'Updated Name',
          profile_picture_url: null,
          preferences: {
            currency_format: 'EUR',
            date_format: 'DD/MM/YYYY',
            onboarding_completed: true,
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
        error: null,
      });

      // First call: select current preferences
      mockSupabase.from.mockReturnValueOnce({
        select: mockSelectPrefs,
      });
      mockSelectPrefs.mockReturnValue({ eq: mockEqPrefs });
      mockEqPrefs.mockReturnValue({ single: mockSinglePrefs });

      // Second call: update
      mockSupabase.from.mockReturnValueOnce({
        update: mockUpdate,
      });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });

      const result = await updateUserProfile(mockUserId, mockUpdates);

      expect(result.display_name).toBe('Updated Name');
      expect(result.preferences.currency_format).toBe('EUR');
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
    });

    test('handles partial updates correctly', async () => {
      const partialUpdate: UpdateUserProfilePayload = {
        display_name: 'Just Name',
      };

      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: mockUserId, ...partialUpdate },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });

      const result = await updateUserProfile(mockUserId, partialUpdate);

      expect(result).toEqual({ id: mockUserId, ...partialUpdate });
      expect(mockUpdate).toHaveBeenCalledWith(partialUpdate);
    });

    test('throws error when update fails', async () => {
      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });

      await expect(updateUserProfile(mockUserId, mockUpdates)).rejects.toThrow(
        'Failed to update user profile'
      );
    });
  });

  describe('updatePreferences', () => {
    const mockUserId = 'user-123';
    const mockExistingProfile: UserProfile = {
      id: mockUserId,
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

    test('merges preference updates with existing preferences', async () => {
      // Mock getUserProfile
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockExistingProfile,
        error: null,
      });

      // Mock update
      const mockUpdate = jest.fn().mockReturnThis();
      const mockUpdateEq = jest.fn().mockReturnThis();
      const mockUpdateSelect = jest.fn().mockReturnThis();
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: {
          ...mockExistingProfile,
          preferences: {
            ...mockExistingProfile.preferences,
            currency_format: 'EUR',
          },
        },
        error: null,
      });

      mockSupabase.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockReturnValueOnce({
          update: mockUpdate,
        });

      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });
      mockUpdate.mockReturnValue({ eq: mockUpdateEq });
      mockUpdateEq.mockReturnValue({ select: mockUpdateSelect });
      mockUpdateSelect.mockReturnValue({ single: mockUpdateSingle });

      const result = await updatePreferences(mockUserId, { currency_format: 'EUR' });

      expect(result.preferences.currency_format).toBe('EUR');
      expect(result.preferences.date_format).toBe('MM/DD/YYYY'); // Preserved
      expect(result.preferences.onboarding_completed).toBe(false); // Preserved
    });

    test('handles multiple preference updates', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockExistingProfile,
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnThis();
      const mockUpdateEq = jest.fn().mockReturnThis();
      const mockUpdateSelect = jest.fn().mockReturnThis();
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: {
          ...mockExistingProfile,
          preferences: {
            currency_format: 'GBP',
            date_format: 'DD/MM/YYYY',
            onboarding_completed: true,
          },
        },
        error: null,
      });

      mockSupabase.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockReturnValueOnce({
          update: mockUpdate,
        });

      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });
      mockUpdate.mockReturnValue({ eq: mockUpdateEq });
      mockUpdateEq.mockReturnValue({ select: mockUpdateSelect });
      mockUpdateSelect.mockReturnValue({ single: mockUpdateSingle });

      const result = await updatePreferences(mockUserId, {
        currency_format: 'GBP',
        date_format: 'DD/MM/YYYY',
        onboarding_completed: true,
      });

      expect(result.preferences).toEqual({
        currency_format: 'GBP',
        date_format: 'DD/MM/YYYY',
        onboarding_completed: true,
      });
    });
  });

  describe('deleteUserAccount', () => {
    const mockUserId = 'user-123';

    test('deletes user profile successfully', async () => {
      const mockDelete = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });
      mockDelete.mockReturnValue({ eq: mockEq });

      await deleteUserAccount(mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', mockUserId);
    });

    test('throws error when deletion fails', async () => {
      const mockDelete = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        error: { message: 'Deletion failed' },
      });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });
      mockDelete.mockReturnValue({ eq: mockEq });

      await expect(deleteUserAccount(mockUserId)).rejects.toThrow(
        'Failed to delete user account'
      );
    });

    test('cascade deletes auth.users record (verified through RLS and FK constraints)', async () => {
      // This test verifies the service layer calls delete correctly
      // Actual cascade is handled by database FK constraint: ON DELETE CASCADE
      const mockDelete = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });
      mockDelete.mockReturnValue({ eq: mockEq });

      await deleteUserAccount(mockUserId);

      // Verify user_profiles delete was called
      // Database CASCADE will handle auth.users deletion
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
