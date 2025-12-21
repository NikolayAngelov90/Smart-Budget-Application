/**
 * Story 8.2: Export Financial Report to PDF
 * Integration Tests for Settings Page PDF Export
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import SettingsPage from '../page';
import * as exportService from '@/lib/services/exportService';
import * as settingsService from '@/lib/services/settingsService';

// Mock the export service
jest.mock('@/lib/services/exportService', () => ({
  exportMonthlyReportToPDF: jest.fn(),
  exportTransactionsToCSV: jest.fn(),
}));

// Mock the settings service
jest.mock('@/lib/services/settingsService', () => ({
  getUserSettings: jest.fn(),
  updateUserSettings: jest.fn(),
  deleteUserAccount: jest.fn(),
}));

const mockExportMonthlyReportToPDF = exportService.exportMonthlyReportToPDF as jest.MockedFunction<
  typeof exportService.exportMonthlyReportToPDF
>;
const mockGetUserSettings = settingsService.getUserSettings as jest.MockedFunction<
  typeof settingsService.getUserSettings
>;
const mockUpdateUserSettings = settingsService.updateUserSettings as jest.MockedFunction<
  typeof settingsService.updateUserSettings
>;

// Mock fetch
global.fetch = jest.fn();

// Mock useRouter and usePathname
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: jest.fn(),
  }),
  usePathname: () => '/settings',
}));

// Mock Supabase auth
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: {
            user: {
              id: 'user-123',
              email: 'test@example.com',
              user_metadata: { display_name: 'Test User' },
            },
          },
          error: null,
        })
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  })),
}));

// Wrapper component for Chakra UI
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <ChakraProvider>{children}</ChakraProvider>;
};

const customRender = (ui: React.ReactElement) => {
  return render(ui, { wrapper: AllTheProviders });
};

describe('Settings Page - PDF Export Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserSettings.mockResolvedValue({
      id: 'settings-1',
      user_id: 'user-123',
      currency: 'USD',
      budget_alerts_enabled: true,
      monthly_budget_limit: null,
      inactivity_timeout_minutes: 30,
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    });
    mockExportMonthlyReportToPDF.mockResolvedValue();
  });

  // AC-8.2.1: Test Export button labeled "Export Monthly Report (PDF)" exists
  test('renders Export Monthly Report (PDF) button', async () => {
    customRender(<SettingsPage />);

    await waitFor(() => {
      const exportButton = screen.getByRole('button', { name: /export monthly report \(pdf\)/i });
      expect(exportButton).toBeInTheDocument();
    });
  });

  // AC-8.2.2: Test month selector dropdown shows last 12 months
  test('renders month selector with 12 month options', async () => {
    customRender(<SettingsPage />);

    await waitFor(() => {
      const monthSelector = screen.getByLabelText(/select month for pdf report/i);
      expect(monthSelector).toBeInTheDocument();

      // Check that there are 12 options (one for each of the last 12 months)
      const options = (monthSelector as HTMLSelectElement).options;
      expect(options.length).toBe(12);
    });
  });

  // Test full PDF export flow
  test('completes full PDF export flow successfully', async () => {
    const mockTransactions = [
      {
        id: '1',
        amount: 1000.0,
        type: 'income',
        date: '2025-01-15',
        notes: 'Salary',
        created_at: '2025-01-15T10:00:00Z',
        category: { id: 'cat-1', name: 'Salary', color: '#00FF00', type: 'income' },
      },
      {
        id: '2',
        amount: 300.0,
        type: 'expense',
        date: '2025-01-10',
        notes: 'Groceries',
        created_at: '2025-01-10T14:00:00Z',
        category: { id: 'cat-2', name: 'Food', color: '#FF0000', type: 'expense' },
      },
      {
        id: '3',
        amount: 200.0,
        type: 'expense',
        date: '2025-01-12',
        notes: 'Gas',
        created_at: '2025-01-12T09:00:00Z',
        category: { id: 'cat-3', name: 'Transport', color: '#0000FF', type: 'expense' },
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockTransactions }),
    });

    customRender(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export monthly report \(pdf\)/i })).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByRole('button', { name: /export monthly report \(pdf\)/i });
    fireEvent.click(exportButton);

    // Verify loading state
    await waitFor(() => {
      expect(screen.getByText(/generating pdf\.\.\./i)).toBeInTheDocument();
    });

    // Verify API was called with correct date range
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/transactions?startDate=')
      );
    });

    // Verify exportMonthlyReportToPDF was called with correct data
    await waitFor(() => {
      expect(mockExportMonthlyReportToPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalIncome: 1000.0,
            totalExpenses: 500.0,
            netBalance: 500.0,
          }),
          categories: expect.arrayContaining([
            expect.objectContaining({
              name: 'Food',
              amount: 300.0,
            }),
            expect.objectContaining({
              name: 'Transport',
              amount: 200.0,
            }),
          ]),
          topTransactions: expect.arrayContaining([
            expect.objectContaining({
              category: 'Food',
              amount: 300.0,
              notes: 'Groceries',
            }),
          ]),
        })
      );
    });

    // AC-8.2.12: Verify success toast displays
    await waitFor(() => {
      expect(screen.getByText('PDF report downloaded!')).toBeInTheDocument();
    });
  });

  // Test month selection change
  test('allows changing selected month', async () => {
    customRender(<SettingsPage />);

    await waitFor(() => {
      const monthSelector = screen.getByLabelText(/select month for pdf report/i);
      expect(monthSelector).toBeInTheDocument();

      // Change month selection
      fireEvent.change(monthSelector, { target: { value: '2024-12' } });

      // Verify the value changed
      expect((monthSelector as HTMLSelectElement).value).toBe('2024-12');
    });
  });

  // Test loading state disables controls
  test('disables month selector during PDF generation', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ data: [] }),
              }),
            100
          )
        )
    );

    customRender(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export monthly report \(pdf\)/i })).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export monthly report \(pdf\)/i });
    const monthSelector = screen.getByLabelText(/select month for pdf report/i);

    fireEvent.click(exportButton);

    // Verify month selector is disabled during export
    await waitFor(() => {
      expect(monthSelector).toBeDisabled();
    });
  });

  // Test error handling - API failure
  test('handles API failure gracefully with error toast', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    customRender(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export monthly report \(pdf\)/i })).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export monthly report \(pdf\)/i });
    fireEvent.click(exportButton);

    // Verify error toast displays
    await waitFor(() => {
      expect(screen.getByText('Export failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to generate PDF report. Please try again.')).toBeInTheDocument();
    });

    // Verify exportMonthlyReportToPDF was NOT called
    expect(mockExportMonthlyReportToPDF).not.toHaveBeenCalled();
  });

  // Test error handling - PDF generation failure
  test('handles PDF generation failure with error toast', async () => {
    const mockTransactions = [
      {
        id: '1',
        amount: 100.0,
        type: 'expense',
        date: '2025-01-10',
        notes: 'Test',
        created_at: '2025-01-10T10:00:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' },
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockTransactions }),
    });

    // Mock PDF generation to fail
    mockExportMonthlyReportToPDF.mockRejectedValueOnce(new Error('PDF generation failed'));

    customRender(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export monthly report \(pdf\)/i })).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export monthly report \(pdf\)/i });
    fireEvent.click(exportButton);

    // Verify error toast displays
    await waitFor(() => {
      expect(screen.getByText('Export failed')).toBeInTheDocument();
    });
  });

  // Test with empty month data
  test('handles month with no transactions', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    customRender(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export monthly report \(pdf\)/i })).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export monthly report \(pdf\)/i });
    fireEvent.click(exportButton);

    // Verify PDF export is called with zero values
    await waitFor(() => {
      expect(mockExportMonthlyReportToPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: {
            totalIncome: 0,
            totalExpenses: 0,
            netBalance: 0,
          },
          categories: [],
          topTransactions: [],
        })
      );
    });

    // Verify success toast
    await waitFor(() => {
      expect(screen.getByText('PDF report downloaded!')).toBeInTheDocument();
    });
  });

  // Test category breakdown calculation accuracy
  test('calculates category breakdown with correct percentages', async () => {
    const mockTransactions = [
      {
        id: '1',
        amount: 600.0,
        type: 'expense',
        date: '2025-01-10',
        notes: 'Groceries',
        created_at: '2025-01-10T10:00:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' },
      },
      {
        id: '2',
        amount: 300.0,
        type: 'expense',
        date: '2025-01-11',
        notes: 'Gas',
        created_at: '2025-01-11T10:00:00Z',
        category: { id: 'cat-2', name: 'Transport', color: '#00FF00', type: 'expense' },
      },
      {
        id: '3',
        amount: 100.0,
        type: 'expense',
        date: '2025-01-12',
        notes: 'Movies',
        created_at: '2025-01-12T10:00:00Z',
        category: { id: 'cat-3', name: 'Entertainment', color: '#0000FF', type: 'expense' },
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockTransactions }),
    });

    customRender(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export monthly report \(pdf\)/i })).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export monthly report \(pdf\)/i });
    fireEvent.click(exportButton);

    // Verify category percentages are calculated correctly (600/1000=60%, 300/1000=30%, 100/1000=10%)
    await waitFor(() => {
      expect(mockExportMonthlyReportToPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: expect.arrayContaining([
            expect.objectContaining({
              name: 'Food',
              amount: 600.0,
              percentage: 60.0,
            }),
            expect.objectContaining({
              name: 'Transport',
              amount: 300.0,
              percentage: 30.0,
            }),
            expect.objectContaining({
              name: 'Entertainment',
              amount: 100.0,
              percentage: 10.0,
            }),
          ]),
        })
      );
    });
  });

  // Test top 5 transactions sorting
  test('includes top 5 highest expense transactions in correct order', async () => {
    const mockTransactions = [
      {
        id: '1',
        amount: 100.0,
        type: 'expense',
        date: '2025-01-01',
        notes: 'Small',
        created_at: '2025-01-01T10:00:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' },
      },
      {
        id: '2',
        amount: 500.0,
        type: 'expense',
        date: '2025-01-02',
        notes: 'Large',
        created_at: '2025-01-02T10:00:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' },
      },
      {
        id: '3',
        amount: 300.0,
        type: 'expense',
        date: '2025-01-03',
        notes: 'Medium',
        created_at: '2025-01-03T10:00:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' },
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockTransactions }),
    });

    customRender(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export monthly report \(pdf\)/i })).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export monthly report \(pdf\)/i });
    fireEvent.click(exportButton);

    // Verify transactions are sorted by amount descending
    await waitFor(() => {
      expect(mockExportMonthlyReportToPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          topTransactions: [
            expect.objectContaining({ amount: 500.0, notes: 'Large' }),
            expect.objectContaining({ amount: 300.0, notes: 'Medium' }),
            expect.objectContaining({ amount: 100.0, notes: 'Small' }),
          ],
        })
      );
    });
  });
});
