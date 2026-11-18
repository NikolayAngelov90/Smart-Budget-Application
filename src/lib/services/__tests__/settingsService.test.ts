/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for settingsService
 */

import {
  getUserProfile,
  updateUserProfile,
  updatePreferences,
  deleteUserAccount,
} from '@/lib/services/settingsService';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '@/test-utils/supabaseChain';
import type { UserProfile, UpdateUserProfilePayload } from '@/types/user.types';

// Mock Supabase client
const mockAdminDeleteUser = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(() => ({
    auth: { admin: { deleteUser: mockAdminDeleteUser } },
  })),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('settingsService', () => {
  /*
   * MIGRATED to `@/test-utils/supabaseChain`.
   *
   * Every test used to hand-build a ladder of separate jest.fns - mockSelect,
   * mockEq, mockSingle, then mockReturnValue to wire each to the next - and
   * queue them on a shared `from` with mockReturnValueOnce. The factory answers
   * the whole chain, records every call, and queues per table in from() order;
   * the assertions are the same, re-pointed at `db.chainFor('user_profiles', n)`.
   *
   * CONTROL-ARM FILE: settingsService rethrows (three catches, each `throw`).
   */
  const RPC_MISSING = {
    data: null,
    error: { code: '42883', message: 'function does not exist' },
  };

  type Result = { data: unknown; error: unknown };

  /**
   * One client per test. `rpc` defaults to "function does not exist" exactly as
   * before, so preference writes take DW-2's migration-041 FALLBACK path - see
   * the note on updatePreferences below about what that means for these tests.
   */
  function settingsDb(
    userProfiles: Result | Result[],
    auth: { user: unknown; error?: unknown } = {
      user: { id: 'user-123', email: 'test@example.com' },
    }
  ) {
    const db = createSupabaseMock({ tables: { user_profiles: userProfiles as never } });
    (db.client.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: auth.user },
      error: auth.error ?? null,
    });
    (db.client.rpc as jest.Mock).mockResolvedValue(RPC_MISSING);
    mockCreateClient.mockResolvedValue(db.client as never);
    return db;
  }

  beforeEach(() => {
    jest.clearAllMocks();
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
        language: 'en',
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    test('fetches existing user profile successfully', async () => {
      const db = settingsDb({ data: mockProfile, error: null }, { user: mockAuthUser });

      const result = await getUserProfile(mockUserId);

      expect(result).toEqual(mockProfile);
      expect(db.from).toHaveBeenCalledWith('user_profiles');
      expect(db.chainFor('user_profiles').select).toHaveBeenCalledWith('*');
      expect(db.chainFor('user_profiles').eq).toHaveBeenCalledWith('id', mockUserId);
    });

    test('creates profile for legacy user when not found (PGRST116 error)', async () => {
      const db = settingsDb(
        [
          { data: null, error: { code: 'PGRST116', message: 'Not found' } },
          { data: { ...mockProfile, display_name: null }, error: null },
        ],
        { user: mockAuthUser }
      );

      const result = await getUserProfile(mockUserId);

      expect(result).toEqual({ ...mockProfile, display_name: null });
      expect(db.from).toHaveBeenCalledWith('user_profiles');
      // The insert is the SECOND user_profiles query: index 1.
      expect(db.chainFor('user_profiles', 1).insert).toHaveBeenCalledWith({
        id: mockUserId,
        preferences: {
          currency_format: 'EUR',
          date_format: 'MM/DD/YYYY',
          language: 'en',
          onboarding_completed: false,
        },
      });
    });

    test('throws error when auth user fetch fails', async () => {
      settingsDb({ data: null, error: null }, { user: null, error: { message: 'Unauthorized' } });

      await expect(getUserProfile(mockUserId)).rejects.toThrow(
        'Failed to fetch user authentication data'
      );
    });

    test('throws error when profile query fails with non-PGRST116 error', async () => {
      settingsDb(
        { data: null, error: { code: 'PGRST500', message: 'Database error' } },
        { user: mockAuthUser }
      );

      await expect(getUserProfile(mockUserId)).rejects.toThrow('Failed to fetch user profile');
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
      const db = settingsDb([
        // First query: the migration-041 fallback reads current preferences
        {
          data: {
            preferences: {
              currency_format: 'USD',
              date_format: 'MM/DD/YYYY',
              onboarding_completed: false,
            },
          },
          error: null,
        },
        // Second query: the update
        {
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
        },
      ]);

      const result = await updateUserProfile(mockUserId, mockUpdates);

      expect(result.display_name).toBe('Updated Name');
      expect(result.preferences.currency_format).toBe('EUR');
      expect(db.from).toHaveBeenCalledWith('user_profiles');
    });

    test('handles partial updates correctly', async () => {
      const partialUpdate: UpdateUserProfilePayload = {
        display_name: 'Just Name',
      };

      // No preferences, so no fallback read: the update is the only query.
      const db = settingsDb({
        data: {
          id: mockUserId,
          display_name: 'Just Name',
          profile_picture_url: null,
          preferences: {
            currency_format: 'USD',
            date_format: 'MM/DD/YYYY',
            onboarding_completed: false,
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
        error: null,
      });

      const result = await updateUserProfile(mockUserId, partialUpdate);

      expect(result.display_name).toBe('Just Name');
      expect(result.id).toBe(mockUserId);
      expect(db.chainFor('user_profiles').update).toHaveBeenCalledWith(partialUpdate);
    });

    test('throws error when update fails', async () => {
      settingsDb([
        // The fallback read of current preferences
        {
          data: {
            preferences: {
              currency_format: 'USD',
              date_format: 'MM/DD/YYYY',
              onboarding_completed: false,
            },
          },
          error: null,
        },
        // The update, failing
        { data: null, error: { message: 'Update failed' } },
      ]);

      await expect(updateUserProfile(mockUserId, mockUpdates)).rejects.toThrow(
        'Failed to update user profile'
      );
    });
  });

  describe('updatePreferences', () => {
    /*
     * A STALE MODEL, CORRECTED IN THE COMMENTS ONLY. Both tests here used to
     * label their first queued result "Mock getUserProfile". But
     * updatePreferences is one line - `return updateUserProfile(userId,
     * { preferences })` - and never calls getUserProfile. With rpc defaulting
     * to "function does not exist", the first query is DW-2's migration-041
     * FALLBACK read, `select('preferences')`.
     *
     * The tests passed because the full profile row they queued happens to
     * carry a `preferences` field, so it served as that read by coincidence.
     * The data is unchanged here - this is a mock swap, not a rewrite - but the
     * label now says what the query actually is. And worth knowing: these two
     * tests exercise the read-modify-write fallback, which DW-2 kept only until
     * migration 041 landed. The atomic Postgres-merge path is covered by
     * preference-patch-atomicity.test.ts.
     */
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
        language: 'en',
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    test('merges preference updates with existing preferences', async () => {
      settingsDb([
        // The migration-041 fallback read (previously mislabelled "getUserProfile")
        { data: mockExistingProfile, error: null },
        // The update
        {
          data: {
            ...mockExistingProfile,
            preferences: {
              ...mockExistingProfile.preferences,
              currency_format: 'EUR',
            },
          },
          error: null,
        },
      ]);

      const result = await updatePreferences(mockUserId, { currency_format: 'EUR' });

      expect(result.preferences.currency_format).toBe('EUR');
      expect(result.preferences.date_format).toBe('MM/DD/YYYY'); // Preserved
      expect(result.preferences.onboarding_completed).toBe(false); // Preserved
    });

    test('handles multiple preference updates', async () => {
      settingsDb([
        // The migration-041 fallback read (previously mislabelled "getUserProfile")
        { data: mockExistingProfile, error: null },
        // The update
        {
          data: {
            ...mockExistingProfile,
            preferences: {
              currency_format: 'GBP',
              date_format: 'DD/MM/YYYY',
              onboarding_completed: true,
            },
          },
          error: null,
        },
      ]);

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
      const db = settingsDb({ data: null, error: null });
      mockAdminDeleteUser.mockResolvedValue({ error: null });

      const result = await deleteUserAccount(mockUserId);

      expect(result).toBe(true);
      expect(db.from).toHaveBeenCalledWith('user_profiles');
      expect(db.chainFor('user_profiles').delete).toHaveBeenCalled();
      expect(db.chainFor('user_profiles').eq).toHaveBeenCalledWith('id', mockUserId);
      expect(mockAdminDeleteUser).toHaveBeenCalledWith(mockUserId);
    });

    test('throws error when deletion fails', async () => {
      settingsDb({ data: null, error: { message: 'Deletion failed' } });

      await expect(deleteUserAccount(mockUserId)).rejects.toThrow('Failed to delete user profile');
    });

    test('cascade deletes auth.users record (verified through RLS and FK constraints)', async () => {
      // NAME-CLAIM GAP, recorded for the assertion pass: a mocked unit test can
      // verify nothing about RLS or FK constraints, and the comment below admits
      // as much. This is a near-duplicate of the first test in this block.
      //
      // This test verifies the service layer calls delete correctly
      // Actual cascade is handled by database FK constraint: ON DELETE CASCADE
      const db = settingsDb({ data: null, error: null });
      mockAdminDeleteUser.mockResolvedValue({ error: null });

      await deleteUserAccount(mockUserId);

      // Verify user_profiles delete was called
      // Database CASCADE will handle auth.users deletion
      expect(db.chainFor('user_profiles').delete).toHaveBeenCalled();
      expect(mockAdminDeleteUser).toHaveBeenCalledWith(mockUserId);
    });
  });
});
