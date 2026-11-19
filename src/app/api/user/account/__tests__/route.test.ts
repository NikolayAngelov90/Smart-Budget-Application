/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for /api/user/account route (DELETE - Account Deletion)
 */

import { DELETE } from '@/app/api/user/account/route';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock, type QueryResult } from '@/test-utils/supabaseChain';
import * as settingsService from '@/lib/services/settingsService';
import * as exportService from '@/lib/services/exportService';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/services/settingsService');
jest.mock('@/lib/services/exportService');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockDeleteUserAccount = settingsService.deleteUserAccount as jest.MockedFunction<
  typeof settingsService.deleteUserAccount
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
});
