/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for settingsService
 */

import {
  getUserProfile,
  updateUserProfile,
  updatePreferences,
  deleteUserAccount,
  REFUSED_NOTICE_TIMEOUT_MS,
} from '@/lib/services/settingsService';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { AccountDeletionRefusedError } from '@/lib/services/accountDeletionRefusal';
import { createSupabaseMock } from '@/test-utils/supabaseChain';
import type { UserProfile, UpdateUserProfilePayload } from '@/types/user.types';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  // A chain-factory client per deleteUserAccount test (see its beforeEach): its
  // recording `from` makes "no table write through the service-role client" an
  // assertion, not an inference from a TypeError on a missing method.
  createServiceRoleClient: jest.fn(),
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
    /*
     * REWRITTEN 2026-11-19 (spec-household-creator-account-deletion). The order
     * changed: the preparatory RPC first, admin.deleteUser LAST, and no explicit
     * user_profiles delete at all - it used to run FIRST, so a refused auth delete
     * left the profile gone and the account in place. That the auth.users cascade
     * removes the profile is proven against Postgres in account-deletion.rls.test.ts,
     * not here: a mocked test can only check the order and the error handling.
     */
    const mockUserId = 'user-123';
    let svcDb: ReturnType<typeof createSupabaseMock>;
    let mockServiceRpc: jest.Mock;
    let mockAdminDeleteUser: jest.Mock;

    beforeEach(() => {
      svcDb = createSupabaseMock({});
      mockServiceRpc = svcDb.client.rpc;
      mockAdminDeleteUser = svcDb.client.auth.admin.deleteUser;
      (createServiceRoleClient as jest.Mock).mockReturnValue(svcDb.client);
    });

    test('prepares the deletion, then deletes the auth user - in that order', async () => {
      mockServiceRpc.mockResolvedValue({ data: {}, error: null });
      mockAdminDeleteUser.mockResolvedValue({ error: null });

      await expect(deleteUserAccount(mockUserId)).resolves.toBe(true);

      expect(mockServiceRpc).toHaveBeenCalledWith('prepare_account_deletion', {
        p_user: mockUserId,
      });
      expect(mockAdminDeleteUser).toHaveBeenCalledWith(mockUserId);
      // The destructive step is LAST.
      expect(mockServiceRpc.mock.invocationCallOrder[0]!).toBeLessThan(
        mockAdminDeleteUser.mock.invocationCallOrder[0]!
      );
      // And no table write happens at all, through either client: the profile is
      // not deleted by hand.
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(svcDb.from).not.toHaveBeenCalled();
    });

    test('never deletes the auth user when the preparation fails', async () => {
      mockServiceRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

      await expect(deleteUserAccount(mockUserId)).rejects.toThrow(
        'Failed to prepare account deletion'
      );
      // PAIRED: the preparation was attempted, so "no deleteUser" is the guard
      // working, not a path that never started.
      expect(mockServiceRpc).toHaveBeenCalledTimes(1);
      expect(mockAdminDeleteUser).not.toHaveBeenCalled();
    });

    test('never deletes the auth user when the preparation call itself rejects', async () => {
      // A network failure rejects the promise instead of returning { error }.
      mockServiceRpc.mockRejectedValue(new Error('fetch failed'));

      await expect(deleteUserAccount(mockUserId)).rejects.toThrow('fetch failed');
      expect(mockServiceRpc).toHaveBeenCalledTimes(1);
      expect(mockAdminDeleteUser).not.toHaveBeenCalled();
    });

    test('surfaces a refused auth delete, having destroyed nothing itself', async () => {
      mockServiceRpc.mockResolvedValue({ data: {}, error: null });
      mockAdminDeleteUser.mockResolvedValue({ error: { message: 'refused' } });

      await expect(deleteUserAccount(mockUserId)).rejects.toThrow('Failed to delete user account');
      // The refusal came at the right step: after the preparation, for this user.
      expect(mockServiceRpc).toHaveBeenCalledWith('prepare_account_deletion', {
        p_user: mockUserId,
      });
      expect(mockAdminDeleteUser).toHaveBeenCalledWith(mockUserId);
      expect(mockServiceRpc.mock.invocationCallOrder[0]!).toBeLessThan(
        mockAdminDeleteUser.mock.invocationCallOrder[0]!
      );
      // The service made no table write of its own, through either client. What a
      // refusal leaves in the DATABASE is asserted against Postgres in
      // account-deletion.rls.test.ts (test 2).
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(svcDb.from).not.toHaveBeenCalled();
    });
    /*
     * A REFUSED auth delete, checked by effect (spec-account-deletion-refused-message).
     * Only a refusal CONFIRMED by getUserById may say "your account was not deleted",
     * and what it says changed comes from prepare_account_deletion's own result.
     */
    describe('a refused auth delete', () => {
      const prepared = (transferred: boolean, moved: number) => ({
        data: {
          ownership_transferred: transferred,
          shared_objects_moved: moved,
          categories_copied: 0,
          rows_repointed: 0,
        },
        error: null,
      });
      let mockGetUserById: jest.Mock;

      beforeEach(() => {
        mockGetUserById = svcDb.client.auth.admin.getUserById;
        mockAdminDeleteUser.mockResolvedValue({
          data: null,
          error: { message: 'Database error deleting user', status: 500 },
        });
      });

      test.each([
        [true, 3, { ownershipTransferred: true, sharedObjectsMoved: true }],
        [true, 0, { ownershipTransferred: true, sharedObjectsMoved: false }],
        [false, 1, { ownershipTransferred: false, sharedObjectsMoved: true }],
        [false, 0, { ownershipTransferred: false, sharedObjectsMoved: false }],
      ])(
        'confirmed (the user still exists): transferred=%s moved=%s -> AccountDeletionRefusedError with what prepare reported',
        async (transferred, moved, expected) => {
          mockServiceRpc.mockResolvedValue(prepared(transferred, moved));
          mockGetUserById.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });

          const thrown = await deleteUserAccount(mockUserId).catch((e: unknown) => e);

          expect(thrown).toBeInstanceOf(AccountDeletionRefusedError);
          expect(thrown).toMatchObject(expected);
          // The confirmation asked about THIS user, after the refusal.
          expect(mockGetUserById).toHaveBeenCalledWith(mockUserId);
          expect(mockAdminDeleteUser.mock.invocationCallOrder[0]!).toBeLessThan(
            mockGetUserById.mock.invocationCallOrder[0]!
          );
        }
      );

      test('the user is gone after all: the deletion happened, so it succeeds', async () => {
        mockServiceRpc.mockResolvedValue(prepared(true, 2));
        mockGetUserById.mockResolvedValue({
          data: { user: null },
          error: { message: 'User not found', status: 404, code: 'user_not_found' },
        });

        await expect(deleteUserAccount(mockUserId)).resolves.toBe(true);
        expect(mockGetUserById).toHaveBeenCalledWith(mockUserId);
      });

      test('a bare 404 (no user_not_found code) is NOT read as "deleted": a generic error', async () => {
        mockServiceRpc.mockResolvedValue(prepared(true, 2));
        mockGetUserById.mockResolvedValue({
          data: { user: null },
          error: { message: 'Not Found', status: 404 },
        });

        const thrown = await deleteUserAccount(mockUserId).catch((e: unknown) => e);
        expect(thrown).not.toBe(true);
        expect(thrown).not.toBeInstanceOf(AccountDeletionRefusedError);
        expect((thrown as Error).message).toMatch(/^Failed to delete user account/);
      });

      test.each([
        [
          'no response (status 0)',
          { message: 'fetch failed', status: 0, name: 'AuthRetryableFetchError' },
        ],
        ['a gateway timeout (504)', { message: 'Gateway Timeout', status: 504 }],
        ['a bad gateway (502)', { message: 'Bad Gateway', status: 502 }],
        ['no status at all', { message: 'weird' }],
      ])(
        'an auth error with an UNKNOWN outcome (%s) is never "not deleted", and is not checked now',
        async (_label, authError) => {
          mockServiceRpc.mockResolvedValue(prepared(true, 2));
          mockAdminDeleteUser.mockResolvedValue({ data: null, error: authError });

          const thrown = await deleteUserAccount(mockUserId).catch((e: unknown) => e);
          expect(thrown).not.toBeInstanceOf(AccountDeletionRefusedError);
          expect((thrown as Error).message).toMatch(/outcome unknown/);
          // A check made now cannot rule out a delete that commits later.
          expect(mockGetUserById).not.toHaveBeenCalled();
        }
      );

      test('the confirmation itself fails: no claim, a generic error', async () => {
        mockServiceRpc.mockResolvedValue(prepared(true, 2));
        mockGetUserById.mockResolvedValue({
          data: { user: null },
          error: { message: 'upstream timeout', status: 504 },
        });

        const thrown = await deleteUserAccount(mockUserId).catch((e: unknown) => e);
        expect(thrown).not.toBeInstanceOf(AccountDeletionRefusedError);
        expect((thrown as Error).message).toMatch(/^Failed to delete user account/);
      });

      test('the confirmation returns a different user: no claim, a generic error', async () => {
        mockServiceRpc.mockResolvedValue(prepared(false, 0));
        mockGetUserById.mockResolvedValue({ data: { user: { id: 'someone-else' } }, error: null });

        const thrown = await deleteUserAccount(mockUserId).catch((e: unknown) => e);
        expect(thrown).not.toBeInstanceOf(AccountDeletionRefusedError);
        expect((thrown as Error).message).toMatch(/^Failed to delete user account/);
      });

      test("prepare's result is unrecognisable: a refusal gets a generic error, never a guess", async () => {
        mockServiceRpc.mockResolvedValue({ data: { ownership_transferred: 'yes' }, error: null });
        mockGetUserById.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });

        const thrown = await deleteUserAccount(mockUserId).catch((e: unknown) => e);
        expect(thrown).not.toBeInstanceOf(AccountDeletionRefusedError);
        expect((thrown as Error).message).toMatch(/^Failed to delete user account/);
      });

      /*
       * The NEUTRAL notices of what a refused deletion changed
       * (spec-refused-deletion-notice, spec-refused-deletion-neutral-variants):
       * published only on a CONFIRMED refusal, best-effort, never on an
       * ambiguous outcome - through the function that tells EVERY change.
       */
      describe('the neutral notices of a refused deletion', () => {
        const PUBLISH = 'publish_refused_deletion_changes';
        /** #109's household-only function: kept for older deployments, never called now. */
        const HOUSEHOLD_ONLY = 'publish_refused_deletion_notices';
        const publishCalls = () => mockServiceRpc.mock.calls.filter(([fn]) => fn === PUBLISH);

        test("one call tells every change: #109's household-only function is never called", async () => {
          mockServiceRpc.mockResolvedValue(prepared(true, 2));
          mockGetUserById.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });

          await deleteUserAccount(mockUserId).catch(() => undefined);

          expect(publishCalls()).toHaveLength(1);
          expect(mockServiceRpc.mock.calls.filter(([fn]) => fn === HOUSEHOLD_ONLY)).toEqual([]);
        });

        test('a CONFIRMED refusal publishes it - for THIS user, after the confirmation, before the error is thrown', async () => {
          mockServiceRpc.mockResolvedValue(prepared(true, 0));
          mockGetUserById.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });

          const thrown = await deleteUserAccount(mockUserId).catch((e: unknown) => e);

          expect(thrown).toBeInstanceOf(AccountDeletionRefusedError);
          expect(publishCalls()).toEqual([[PUBLISH, { p_user: mockUserId }]]);
          const publishAt = mockServiceRpc.mock.calls.findIndex(([fn]) => fn === PUBLISH);
          expect(mockGetUserById.mock.invocationCallOrder[0]!).toBeLessThan(
            mockServiceRpc.mock.invocationCallOrder[publishAt]!
          );
        });

        test("confirmed even when prepare's result was unrecognisable: the transfer is read from what was STAGED, not from that result", async () => {
          mockServiceRpc.mockResolvedValue({ data: { ownership_transferred: 'yes' }, error: null });
          mockGetUserById.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });

          await deleteUserAccount(mockUserId).catch((e: unknown) => e);
          expect(publishCalls()).toEqual([[PUBLISH, { p_user: mockUserId }]]);
        });

        test('the refusal answer WAITS for the publish (so the push after the response finds the notice) - but never longer than the cap', async () => {
          // 1. It waits: until the publish answers, the refusal is not reported.
          let answer!: (v: { data: number; error: null }) => void;
          mockServiceRpc.mockImplementation((fn: string) =>
            fn === PUBLISH
              ? new Promise((resolve) => {
                  answer = resolve;
                })
              : Promise.resolve(prepared(true, 0))
          );
          mockGetUserById.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
          let settled = false;
          const pending = deleteUserAccount(mockUserId).catch((e: unknown) => {
            settled = true;
            return e;
          });
          for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
          expect(publishCalls()).toHaveLength(1); // CONTROL: the publish was called...
          expect(settled).toBe(false); // ...and the answer is waiting for it
          answer({ data: 1, error: null });
          expect(await pending).toBeInstanceOf(AccountDeletionRefusedError);

          // 2. The cap: a publish that never answers does not hold the refusal.
          jest.useFakeTimers();
          try {
            mockServiceRpc.mockImplementation((fn: string) =>
              fn === PUBLISH ? new Promise(() => undefined) : Promise.resolve(prepared(true, 0))
            );
            const capped = deleteUserAccount(mockUserId).catch((e: unknown) => e);
            await jest.advanceTimersByTimeAsync(REFUSED_NOTICE_TIMEOUT_MS);
            expect(await capped).toBeInstanceOf(AccountDeletionRefusedError);
          } finally {
            jest.useRealTimers();
          }
        });

        test.each([
          ['returns an error', () => ({ data: null, error: { message: 'boom' } })],
          [
            'rejects',
            () => {
              throw new Error('fetch failed');
            },
          ],
        ])(
          'BEST-EFFORT: when publishing %s, the refusal is still reported exactly as before',
          async (_label, publishResult) => {
            mockServiceRpc.mockImplementation(async (fn: string) =>
              fn === PUBLISH ? publishResult() : prepared(true, 2)
            );
            mockGetUserById.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });

            const thrown = await deleteUserAccount(mockUserId).catch((e: unknown) => e);

            expect(publishCalls()).toHaveLength(1); // CONTROL: it was attempted
            expect(thrown).toBeInstanceOf(AccountDeletionRefusedError);
            expect(thrown).toMatchObject({ ownershipTransferred: true, sharedObjectsMoved: true });
          }
        );

        test.each([
          [
            'an UNKNOWN outcome (no response)',
            { message: 'fetch failed', status: 0, name: 'AuthRetryableFetchError' },
            null,
          ],
          [
            'an UNKNOWN outcome (gateway timeout)',
            { message: 'Gateway Timeout', status: 504 },
            null,
          ],
          [
            'the user is GONE (the deletion happened)',
            { message: 'Database error deleting user', status: 500 },
            { data: { user: null }, error: { message: 'x', status: 404, code: 'user_not_found' } },
          ],
          [
            'an INCONCLUSIVE lookup',
            { message: 'Database error deleting user', status: 500 },
            { data: { user: null }, error: { message: 'upstream timeout', status: 504 } },
          ],
          [
            'a DIFFERENT user returned',
            { message: 'Database error deleting user', status: 500 },
            { data: { user: { id: 'someone-else' } }, error: null },
          ],
          [
            'the SAME user returned together WITH an error',
            { message: 'Database error deleting user', status: 500 },
            { data: { user: { id: mockUserId } }, error: { message: 'partial', status: 500 } },
          ],
        ])('never published on %s', async (_label, authError, lookup) => {
          mockServiceRpc.mockResolvedValue(prepared(true, 2));
          mockAdminDeleteUser.mockResolvedValue({ data: null, error: authError });
          if (lookup) mockGetUserById.mockResolvedValue(lookup);

          await deleteUserAccount(mockUserId).catch((e: unknown) => e);

          // CONTROL: the preparation ran, so "not published" is the guard working.
          expect(mockServiceRpc).toHaveBeenCalledWith('prepare_account_deletion', {
            p_user: mockUserId,
          });
          expect(publishCalls()).toEqual([]);
        });
      });
    });

    test('an unrecognisable prepare result never blocks a deletion that succeeds', async () => {
      mockServiceRpc.mockResolvedValue({ data: 'unexpected', error: null });
      mockAdminDeleteUser.mockResolvedValue({ data: null, error: null });

      await expect(deleteUserAccount(mockUserId)).resolves.toBe(true);
      expect(mockAdminDeleteUser).toHaveBeenCalledWith(mockUserId);
    });
  });
});
