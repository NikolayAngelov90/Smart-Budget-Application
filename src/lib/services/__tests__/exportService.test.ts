/**
 * Export Service Unit Tests
 * Story 8.1: Export Transactions to CSV
 * Story 8.2: Export Financial Report to PDF
 *
 * Tests for client-side export functionality (CSV and PDF)
 */

import Papa from 'papaparse';
import { exportTransactionsToCSV } from '../exportService';

// Mock papaparse
jest.mock('papaparse');
const mockUnparse = Papa.unparse as jest.MockedFunction<typeof Papa.unparse>;

// Mock analytics service to prevent actual tracking during tests
jest.mock('../analyticsService', () => ({
  trackCSVExported: jest.fn().mockResolvedValue({ success: true }),
  trackPDFExported: jest.fn().mockResolvedValue({ success: true }),
}));

// Type for CSV row data in tests
type CSVRowData = Record<string, string | number>;

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date | string, formatStr: string) => {
    if (formatStr === 'yyyy-MM-dd') {
      return '2025-12-14';
    }
    if (formatStr === 'yyyy-MM-dd HH:mm:ss') {
      return '2025-12-14 10:30:00';
    }
    return 'mocked-date';
  }),
}));

// Mock DOM APIs
const mockCreateElement = jest.fn();
const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = jest.fn();
const mockClick = jest.fn();

describe('exportTransactionsToCSV', () => {
  let mockLink: Partial<HTMLAnchorElement>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock DOM methods
    mockLink = {
      href: '',
      download: '',
      click: mockClick,
    };

    mockCreateElement.mockReturnValue(mockLink);
    global.document.createElement = mockCreateElement;
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Blob = jest.fn() as any;

    // Mock Papa.unparse to return CSV string
    mockUnparse.mockReturnValue('Date,Type,Category,Amount,Notes,Created At\n2025-12-14,expense,Groceries,$50.00,,2025-12-14 10:30:00');
  });

  // AC-8.1.4, 8.1.7, 8.1.8: Test CSV structure with correct columns, amount formatting, date formatting
  test('generates CSV with correct structure and formatting', async () => {
    const transactions = [
      {
        id: '1',
        amount: 50.00,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-1',
          name: 'Groceries',
          color: '#FF0000',
          type: 'expense' as const,
        },
      },
    ];

    await exportTransactionsToCSV(transactions);

    // Verify Papa.unparse was called with correct data
    expect(mockUnparse).toHaveBeenCalledWith([
      {
        Date: '2025-12-14',
        Type: 'expense',
        Category: 'Groceries',
        Amount: '$50.00',
        Notes: '',
        'Created At': '2025-12-14 10:30:00',
      },
    ]);
  });

  // AC-8.1.6: Test special character escaping (papaparse handles this automatically)
  test('handles special characters in notes', async () => {
    const transactions = [
      {
        id: '1',
        amount: 25.50,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: 'Bought groceries, milk, and bread\n"Special quote"',
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-1',
          name: 'Groceries',
          color: '#FF0000',
          type: 'expense' as const,
        },
      },
    ];

    await exportTransactionsToCSV(transactions);

    const csvData = mockUnparse.mock.calls[0][0] as CSVRowData[];
    expect(csvData[0].Notes).toBe('Bought groceries, milk, and bread\n"Special quote"');
  });

  // AC-8.1.4: Test empty notes display as empty string, not "null"
  test('handles null notes as empty string', async () => {
    const transactions = [
      {
        id: '1',
        amount: 100.00,
        type: 'income' as const,
        date: '2025-12-14',
        notes: null,
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-1',
          name: 'Salary',
          color: '#00FF00',
          type: 'income' as const,
        },
      },
    ];

    await exportTransactionsToCSV(transactions);

    const csvData = mockUnparse.mock.calls[0][0] as CSVRowData[];
    expect(csvData[0].Notes).toBe('');
    expect(csvData[0].Notes).not.toBe('null');
  });

  // AC-8.1.7: Test amount formatting as $123.45
  test('formats amounts with dollar sign and two decimals', async () => {
    const transactions = [
      {
        id: '1',
        amount: 123.456, // Should round to 2 decimals
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-1',
          name: 'Shopping',
          color: '#FF0000',
          type: 'expense' as const,
        },
      },
    ];

    await exportTransactionsToCSV(transactions);

    const csvData = mockUnparse.mock.calls[0][0] as CSVRowData[];
    expect(csvData[0].Amount).toBe('$123.46'); // toFixed rounds
  });

  // Test missing category handling (category.name fallback to "Unknown")
  test('handles missing category gracefully', async () => {
    const transactions = [
      {
        id: '1',
        amount: 50.00,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: 'Test transaction',
        created_at: '2025-12-14T10:30:00Z',
        category: null,
      },
    ];

    await exportTransactionsToCSV(transactions);

    const csvData = mockUnparse.mock.calls[0][0] as CSVRowData[];
    expect(csvData[0].Category).toBe('Unknown');
  });

  // AC-8.1.5: Test transactions sorted by date (newest first) - this is handled by API, but verify we preserve order
  test('preserves transaction order from API', async () => {
    const transactions = [
      {
        id: '3',
        amount: 30.00,
        type: 'expense' as const,
        date: '2025-12-15', // Newest
        notes: null,
        created_at: '2025-12-15T10:30:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' as const },
      },
      {
        id: '2',
        amount: 20.00,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        created_at: '2025-12-14T10:30:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' as const },
      },
      {
        id: '1',
        amount: 10.00,
        type: 'expense' as const,
        date: '2025-12-13', // Oldest
        notes: null,
        created_at: '2025-12-13T10:30:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' as const },
      },
    ];

    await exportTransactionsToCSV(transactions);

    const csvData = mockUnparse.mock.calls[0][0] as CSVRowData[];
    expect(csvData).toHaveLength(3);
    // Order should be preserved as provided (API handles sorting)
    expect(csvData[0].Amount).toBe('$30.00');
    expect(csvData[1].Amount).toBe('$20.00');
    expect(csvData[2].Amount).toBe('$10.00');
  });

  // AC-8.1.2: Test CSV file download is triggered
  test('triggers browser download with correct blob and filename', async () => {
    const transactions = [
      {
        id: '1',
        amount: 50.00,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        created_at: '2025-12-14T10:30:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' as const },
      },
    ];

    await exportTransactionsToCSV(transactions);

    // Verify Blob was created with correct content type
    expect(global.Blob).toHaveBeenCalledWith(
      [expect.any(String)],
      { type: 'text/csv;charset=utf-8;' }
    );

    // Verify createObjectURL was called
    expect(mockCreateObjectURL).toHaveBeenCalled();

    // Verify link element was created and configured
    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockLink.href).toBe('blob:mock-url');
    expect(mockLink.download).toBe('transactions-2025-12-14.csv'); // AC-8.1.3: Filename format

    // Verify click was triggered
    expect(mockClick).toHaveBeenCalled();

    // Verify cleanup
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  // AC-8.1.3: Test CSV filename format (transactions-YYYY-MM-DD.csv)
  test('uses correct filename format', async () => {
    const transactions = [
      {
        id: '1',
        amount: 50.00,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        created_at: '2025-12-14T10:30:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' as const },
      },
    ];

    await exportTransactionsToCSV(transactions);

    expect(mockLink.download).toMatch(/^transactions-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  // Test error handling
  test('throws error when export fails', async () => {
    mockUnparse.mockImplementation(() => {
      throw new Error('Papa parse failed');
    });

    const transactions = [
      {
        id: '1',
        amount: 50.00,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        created_at: '2025-12-14T10:30:00Z',
        category: { id: 'cat-1', name: 'Food', color: '#FF0000', type: 'expense' as const },
      },
    ];

    await expect(exportTransactionsToCSV(transactions)).rejects.toThrow(
      'Failed to export transactions. Please try again.'
    );
  });

  // Test empty transaction list
  test('handles empty transaction list', async () => {
    const transactions: never[] = [];

    await exportTransactionsToCSV(transactions);

    const csvData = mockUnparse.mock.calls[0][0] as CSVRowData[];
    expect(csvData).toEqual([]);
  });

  // Test both income and expense types
  test('handles both income and expense transaction types', async () => {
    const transactions = [
      {
        id: '1',
        amount: 1000.00,
        type: 'income' as const,
        date: '2025-12-14',
        notes: 'Salary',
        created_at: '2025-12-14T10:30:00Z',
        category: { id: 'cat-1', name: 'Salary', color: '#00FF00', type: 'income' as const },
      },
      {
        id: '2',
        amount: 50.00,
        type: 'expense' as const,
        date: '2025-12-13',
        notes: 'Lunch',
        created_at: '2025-12-13T12:00:00Z',
        category: { id: 'cat-2', name: 'Food', color: '#FF0000', type: 'expense' as const },
      },
    ];

    await exportTransactionsToCSV(transactions);

    const csvData = mockUnparse.mock.calls[0][0] as CSVRowData[];
    expect(csvData[0].Type).toBe('income');
    expect(csvData[1].Type).toBe('expense');
  });
});
