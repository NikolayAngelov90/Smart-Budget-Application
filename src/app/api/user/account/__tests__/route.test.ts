/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for /api/user/account route (DELETE - Account Deletion)
 */

import { DELETE } from '../route';
import { createClient } from '@/lib/supabase/server';
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
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
        signInWithPassword: jest.fn(),
        admin: {
          deleteUser: jest.fn(),
        },
      },
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

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
      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: mockTransactions,
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ order: mockOrder });

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
      expect(data.data.message).toContain('Account deleted successfully');

      // Verify password was checked
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: mockUser.email,
        password: 'correct-password',
      });

      // Verify CSV export was triggered
      expect(mockExportTransactionsToCSV).toHaveBeenCalledWith(mockTransactions);

      // Verify profile deletion
      expect(mockDeleteUserAccount).toHaveBeenCalledWith(mockUser.id);

      // Verify auth user deletion
      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith(mockUser.id);
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
      expect(data.error).toEqual({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });

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
      expect(data.error).toEqual({
        code: 'INVALID_PASSWORD',
        message: 'Incorrect password. Account deletion cancelled.',
      });

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
      expect(data.error).toEqual({
        code: 'INVALID_REQUEST',
        message: 'Password confirmation required',
      });

      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
      expect(mockDeleteUserAccount).not.toHaveBeenCalled();
    });

    test('returns 400 when request body is invalid JSON', async () => {
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

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_REQUEST');
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

      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: mockTransactions,
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ order: mockOrder });

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

      // Verify transactions were fetched
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
      expect(mockSelect).toHaveBeenCalledWith(`
        id,
        amount,
        type,
        date,
        notes,
        created_at,
        category:categories(id, name, color, type)
      `);

      // Verify CSV export was called before deletion
      expect(mockExportTransactionsToCSV).toHaveBeenCalledWith(mockTransactions);

      // Verify order of operations: export happens before delete
      const exportCallOrder = mockExportTransactionsToCSV.mock.invocationCallOrder[0];
      const deleteCallOrder = mockDeleteUserAccount.mock.invocationCallOrder[0];
      expect(exportCallOrder).toBeLessThan(deleteCallOrder);
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

      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ order: mockOrder });

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
      expect(mockExportTransactionsToCSV).toHaveBeenCalledWith([]);
      expect(mockDeleteUserAccount).toHaveBeenCalled();
    });
  });

  describe('AC-8.3.8: Cascade deletion', () => {
    test('deletes user_profiles and cascades to auth.users', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ order: mockOrder });

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

      // Verify both deletions occurred
      expect(mockDeleteUserAccount).toHaveBeenCalledWith(mockUser.id);
      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith(mockUser.id);
    });

    test('returns 500 when profile deletion fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ order: mockOrder });

      mockExportTransactionsToCSV.mockResolvedValue();
      mockDeleteUserAccount.mockRejectedValue(new Error('Profile deletion failed'));

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
      expect(data.error).toEqual({
        code: 'DELETION_FAILED',
        message: 'Failed to delete user account',
      });

      // Verify auth deletion was NOT called since profile deletion failed
      expect(mockSupabase.auth.admin.deleteUser).not.toHaveBeenCalled();
    });

    test('returns 500 when auth user deletion fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ order: mockOrder });

      mockExportTransactionsToCSV.mockResolvedValue();
      mockDeleteUserAccount.mockResolvedValue(true);
      mockSupabase.auth.admin.deleteUser.mockResolvedValue({
        error: { message: 'Auth deletion failed' },
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
      expect(data.error).toEqual({
        code: 'DELETION_FAILED',
        message: 'Failed to delete user account',
      });
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

      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ order: mockOrder });

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
      expect(data.error.code).toBe('DELETION_FAILED');
      expect(mockDeleteUserAccount).not.toHaveBeenCalled();
    });
  });
});
