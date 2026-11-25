/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for /api/user/account route (DELETE - Account Deletion)
 */

import { DELETE } from '@/app/api/user/account/route';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock, type QueryResult } from '@/test-utils/supabaseChain';
import * as settingsService from '@/lib/services/settingsService';
import * as exportService from '@/lib/services/exportService';
import {
  AccountDeletionRefusedError,
  resolveRefusalNames,
} from '@/lib/services/accountDeletionRefusal';
import { NextRequest, after } from 'next/server';
import { deliverAccountNoticePushes } from '@/lib/services/accountNoticeService';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/services/settingsService');
jest.mock('@/lib/services/exportService');
// `after()` RECORDS its callback (spec-account-deletion-notifications): the real
// one needs a request scope. The tests assert the notice push is scheduled.
jest.mock('next/server', () => ({
  ...jest.requireActual('next/server'),
  after: jest.fn(),
}));
jest.mock('@/lib/services/accountNoticeService', () => ({
  deliverAccountNoticePushes: jest.fn().mockResolvedValue({}),
  NOTICE_CLOCK_SKEW_MS: 60_000,
}));
// The real error class and outcome mapping; only the name lookup is stubbed (it
// has its own tests in accountDeletionRefusal.test.ts).
jest.mock('@/lib/services/accountDeletionRefusal', () => ({
  ...jest.requireActual('@/lib/services/accountDeletionRefusal'),
  resolveRefusalNames: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockDeleteUserAccount = settingsService.deleteUserAccount as jest.MockedFunction<
  typeof settingsService.deleteUserAccount
>;
const mockResolveRefusalNames = resolveRefusalNames as jest.MockedFunction<
  typeof resolveRefusalNames
>;
const mockExportTransactionsToCSV = exportService.exportTransactionsToCSV as jest.MockedFunction<
  typeof exportService.exportTransactionsToCSV
>;

describe('/api/user/account DELETE', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. The route's one
    // query is the transactions export; `setTransactions` sets its result. The
    // auth functions stay bare jest.fns the tests configure, exactly as before,
    // and are carried across when a test swaps the transactions result.
    mockSupabase = createSupabaseMock({
      tables: { transactions: { data: [], error: null } },
    }).client;
    mockSupabase.auth = {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      admin: { deleteUser: jest.fn() },
    };
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  /** A fresh client whose transactions export returns `result`; the configured auth carries over. */
  function setTransactions(result: QueryResult) {
    const auth = mockSupabase.auth;
    mockSupabase = createSupabaseMock({ tables: { transactions: result } }).client;
    mockSupabase.auth = auth;
    mockCreateClient.mockResolvedValue(mockSupabase);
  }

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockTransactions = [
    {
      id: 'tx-1',
      amount: 100,
      type: 'expense' as const,
      date: '2025-01-15',
      notes: 'Test transaction',
      created_at: '2025-01-15T10:00:00Z',
      category: {
        id: 'cat-1',
        name: 'Food',
        color: '#FF0000',
        type: 'expense' as const,
      },
    },
  ];

  describe('AC-8.3.8: Account deletion with password verification', () => {
    test('successfully deletes account with correct password', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock password verification
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock transactions fetch for export
      setTransactions({
        data: mockTransactions,
        error: null,
      });

      // Mock CSV export
      mockExportTransactionsToCSV.mockResolvedValue();

      // Mock user account deletion
      mockDeleteUserAccount.mockResolvedValue(true);

      // Mock auth.users deletion
      mockSupabase.auth.admin.deleteUser.mockResolvedValue({
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_password: 'correct-password',
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.success).toBe(true);

      // Verify password was checked
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: mockUser.email,
        password: 'correct-password',
      });

      // Verify profile deletion
      expect(mockDeleteUserAccount).toHaveBeenCalledWith(mockUser.id);
    });

    test('returns 401 when user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Unauthorized' },
      });

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_password: 'password',
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.message).toBe('Unauthorized');

      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
      expect(mockDeleteUserAccount).not.toHaveBeenCalled();
    });

    test('returns 401 when password verification fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock password verification failure
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_password: 'wrong-password',
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.message).toBe('Invalid password');

      expect(mockDeleteUserAccount).not.toHaveBeenCalled();
    });

    test('returns 400 when confirmation_password not provided', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Validation error');

      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
      expect(mockDeleteUserAccount).not.toHaveBeenCalled();
    });

    test('returns 500 when request body is invalid JSON', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Failed to delete account');
      expect(mockDeleteUserAccount).not.toHaveBeenCalled();
    });
  });

  describe('AC-8.3.8: Data export before deletion', () => {
    test('exports all transactions to CSV before deleting account', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      setTransactions({
        data: mockTransactions,
        error: null,
      });

      mockExportTransactionsToCSV.mockResolvedValue();
      mockDeleteUserAccount.mockResolvedValue(true);
      mockSupabase.auth.admin.deleteUser.mockResolvedValue({ error: null });

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_password: 'password',
        }),
      });

      const response = await DELETE(request);

      expect(response.status).toBe(200);

      // Verify transactions were fetched
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');

      // Verify deletion occurred
      expect(mockDeleteUserAccount).toHaveBeenCalledWith(mockUser.id);
    });

    test('continues deletion even when no transactions exist', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      setTransactions({
        data: [],
        error: null,
      });

      mockExportTransactionsToCSV.mockResolvedValue();
      mockDeleteUserAccount.mockResolvedValue(true);
      mockSupabase.auth.admin.deleteUser.mockResolvedValue({ error: null });

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_password: 'password',
        }),
      });

      const response = await DELETE(request);

      expect(response.status).toBe(200);
      expect(mockDeleteUserAccount).toHaveBeenCalled();
    });
  });

  describe('AC-8.3.8: Cascade deletion', () => {
    // RENAMED 2026-11-18. Was "deletes user_profiles and cascades to
    // auth.users" - the SAME backwards claim as the settingsService test renamed
    // in cf90b2c: the FK cascades FROM auth.users TO the profile, never the other
    // way. And deleteUserAccount is MOCKED here, so this checks only that the
    // route delegates to it. What the deletion does to the data - ownership
    // transfer, copies, the cascade, no id left behind - is asserted against
    // Postgres in src/lib/test-utils/__tests__/account-deletion.rls.test.ts.
    test('delegates the deletion to deleteUserAccount for the authenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      setTransactions({
        data: [],
        error: null,
      });

      mockExportTransactionsToCSV.mockResolvedValue();
      mockDeleteUserAccount.mockResolvedValue(true);
      mockSupabase.auth.admin.deleteUser.mockResolvedValue({ error: null });

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_password: 'password',
        }),
      });

      await DELETE(request);

      // Verify deletion occurred
      expect(mockDeleteUserAccount).toHaveBeenCalledWith(mockUser.id);
    });

    // RENAMED 2026-11-19: there is no profile deletion any more (the auth.users
    // cascade removes the profile). deleteUserAccount throws when the preparation
    // fails or the auth delete is refused; both must answer 500.
    test('returns 500 when deleteUserAccount throws (preparation failed or auth delete refused)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      setTransactions({
        data: [],
        error: null,
      });

      mockExportTransactionsToCSV.mockResolvedValue();
      mockDeleteUserAccount.mockRejectedValue(
        new Error('Failed to delete user account: Database error deleting user')
      );

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_password: 'password',
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Failed to delete account');
    });

    test('successfully deletes account when deletion succeeds', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      setTransactions({
        data: [],
        error: null,
      });

      mockDeleteUserAccount.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_password: 'password',
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('handles transaction fetch failure gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      setTransactions({
        data: null,
        error: { message: 'Database error' },
      });

      const request = new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation_password: 'password',
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Failed to fetch transactions for export');
      expect(mockDeleteUserAccount).not.toHaveBeenCalled();
    });
  });
  /*
   * spec-account-deletion-refused-message: a CONFIRMED refusal answers with a code
   * plus live names, which the dialog renders in the reader's language. Every
   * other 500 carries no server text the dialog could show.
   */
  describe('a refused deletion', () => {
    const RAW = 'Failed to delete user account: Database error deleting user';

    function authenticated() {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      setTransactions({ data: [], error: null });
    }

    async function callDelete() {
      const response = await DELETE(
        new NextRequest('http://localhost:3000/api/user/account', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation_password: 'password' }),
        })
      );
      return { status: response.status, body: await response.json() };
    }

    const refused = (ownershipTransferred: boolean, sharedObjectsMoved: boolean) =>
      new AccountDeletionRefusedError({ ownershipTransferred, sharedObjectsMoved }, 'refused');

    test.each([
      [true, false, 'transferred'],
      [true, true, 'transferredShared'],
      [false, true, 'shared'],
    ] as const)(
      'transferred=%s, shared moved=%s -> code + outcome %s + the names, resolved on the person’s own session',
      async (transferred, moved, outcome) => {
        authenticated();
        mockDeleteUserAccount.mockRejectedValue(refused(transferred, moved));
        mockResolveRefusalNames.mockResolvedValue({
          household: 'Вкъщи',
          owner: 'owner@example.test',
        });

        const { status, body } = await callDelete();

        expect(status).toBe(500);
        expect(body.error).toEqual({
          message: 'Account not deleted',
          code: 'ACCOUNT_NOT_DELETED',
          outcome,
          household: 'Вкъщи',
          owner: 'owner@example.test',
        });
        expect(mockResolveRefusalNames).toHaveBeenCalledWith(mockSupabase, mockUser.id);
      }
    );

    test('nothing moved -> code + outcome unchanged, and no names are looked up', async () => {
      authenticated();
      mockDeleteUserAccount.mockRejectedValue(refused(false, false));

      const { status, body } = await callDelete();

      expect(status).toBe(500);
      expect(body.error).toEqual({
        message: 'Account not deleted',
        code: 'ACCOUNT_NOT_DELETED',
        outcome: 'unchanged',
      });
      expect(mockResolveRefusalNames).not.toHaveBeenCalled();
    });

    test('names unresolvable -> the generic failure, with no code (never a sentence with holes)', async () => {
      authenticated();
      mockDeleteUserAccount.mockRejectedValue(refused(true, true));
      mockResolveRefusalNames.mockResolvedValue(null);

      const { status, body } = await callDelete();

      expect(status).toBe(500);
      expect(body.error.code).toBeUndefined();
      expect(body.error.message).toBe('Failed to delete account');
      expect(mockResolveRefusalNames).toHaveBeenCalledWith(mockSupabase, mockUser.id);
    });

    test('any other failure -> 500 whose details are not the raw error', async () => {
      authenticated();
      mockDeleteUserAccount.mockRejectedValue(new Error(RAW));

      const { status, body } = await callDelete();

      expect(status).toBe(500);
      expect(body.error.code).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('Database error deleting user');
      expect(mockResolveRefusalNames).not.toHaveBeenCalled();
    });

    test('a failed export read -> 500 whose details are not the raw database message', async () => {
      authenticated();
      setTransactions({ data: null, error: { message: 'relation "x" does not exist' } });

      const { status, body } = await callDelete();

      expect(status).toBe(500);
      expect(JSON.stringify(body)).not.toContain('relation "x"');
    });
  });
  describe('account notices: the pushes go out AFTER the response', () => {
    const mockAfter = after as unknown as jest.Mock;
    const mockDeliver = deliverAccountNoticePushes as jest.Mock;

    function authenticated() {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      setTransactions({ data: [], error: null });
    }
    const request = () =>
      new NextRequest('http://localhost:3000/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_password: 'password' }),
      });

    beforeEach(() => {
      mockAfter.mockClear();
      mockDeliver.mockClear();
    });

    it.each([
      ['the deletion succeeds', () => mockDeleteUserAccount.mockResolvedValue(true), 200],
      // prepare's writes (and its notices) stand even when the auth delete is refused
      [
        'the auth delete is refused',
        () => mockDeleteUserAccount.mockRejectedValue(new Error('refused')),
        500,
      ],
    ])(
      'schedules delivery when %s, scoped to notices since the request began',
      async (_l, arrange, status) => {
        authenticated();
        arrange();
        const before = Date.now();

        const response = await DELETE(request());

        expect(response.status).toBe(status);
        expect(mockAfter).toHaveBeenCalledTimes(1);
        // Scheduled BEFORE the deletion ran, so no outcome can skip it...
        expect(mockAfter.mock.invocationCallOrder[0]!).toBeLessThan(
          mockDeleteUserAccount.mock.invocationCallOrder[0]!
        );
        // ...and nothing was delivered inside the request.
        expect(mockDeliver).not.toHaveBeenCalled();

        await (mockAfter.mock.calls[0]![0] as () => Promise<unknown>)();
        expect(mockDeliver).toHaveBeenCalledTimes(1);
        const since = (mockDeliver.mock.calls[0]![0] as { since: Date }).since.getTime();
        expect(since).toBeLessThanOrEqual(before - 60_000 + 50);
        expect(since).toBeGreaterThanOrEqual(before - 60_000 - 5_000);
      }
    );

    it('schedules nothing when the password is wrong (nothing was prepared)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      const response = await DELETE(request());

      expect(response.status).toBe(401);
      expect(mockAfter).not.toHaveBeenCalled();
      expect(mockDeleteUserAccount).not.toHaveBeenCalled();
    });
  });
});
