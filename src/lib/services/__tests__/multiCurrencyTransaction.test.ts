/**
 * Multi-Currency Transaction Tests
 * Story 10-6: Transaction Multi-Currency Support
 *
 * Tests for:
 * - CSV export with currency columns (AC-10.6.9)
 * - Currency field defaults and handling
 */

import Papa from 'papaparse';
import { exportTransactionsToCSV } from '@/lib/services/exportService';

// Mock papaparse
jest.mock('papaparse');
const mockUnparse = Papa.unparse as jest.MockedFunction<typeof Papa.unparse>;

// Mock analytics service
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

describe('Multi-Currency CSV Export (Story 10-6)', () => {
  let mockLink: Partial<HTMLAnchorElement>;

  beforeEach(() => {
    jest.clearAllMocks();

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

    mockUnparse.mockReturnValue('mocked-csv');
  });

  // AC-10.6.9: CSV includes Currency column
  test('includes Currency column in CSV export', async () => {
    const transactions = [
      {
        id: '1',
        amount: 50.0,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        currency: 'USD',
        exchange_rate: 0.93,
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-1',
          name: 'Groceries',
          color: '#FF0000',
          type: 'expense' as const,
        },
      },
    ];

    await exportTransactionsToCSV(transactions, undefined, 'EUR');

    const csvData = mockUnparse.mock.calls[0]![0] as CSVRowData[];
    expect(csvData[0]!.Currency).toBe('USD');
  });

  // AC-10.6.9: CSV includes Exchange Rate column
  test('includes Exchange Rate for foreign currency transactions', async () => {
    const transactions = [
      {
        id: '1',
        amount: 100.0,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        currency: 'USD',
        exchange_rate: 0.9259,
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-1',
          name: 'Shopping',
          color: '#FF0000',
          type: 'expense' as const,
        },
      },
    ];

    await exportTransactionsToCSV(transactions, undefined, 'EUR');

    const csvData = mockUnparse.mock.calls[0]![0] as CSVRowData[];
    expect(csvData[0]!['Exchange Rate']).toBe('0.9259');
  });

  // AC-10.6.9: CSV includes Converted Amount column
  test('includes Converted Amount for foreign currency transactions', async () => {
    const transactions = [
      {
        id: '1',
        amount: 100.0,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        currency: 'USD',
        exchange_rate: 0.93,
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-1',
          name: 'Shopping',
          color: '#FF0000',
          type: 'expense' as const,
        },
      },
    ];

    await exportTransactionsToCSV(transactions, undefined, 'EUR');

    const csvData = mockUnparse.mock.calls[0]![0] as CSVRowData[];
    // 100 USD * 0.93 = 93 EUR
    expect(csvData[0]!['Converted Amount']).toContain('93');
  });

  // Same currency: Exchange Rate and Converted Amount are empty
  test('leaves Exchange Rate and Converted Amount empty for same currency', async () => {
    const transactions = [
      {
        id: '1',
        amount: 50.0,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        currency: 'EUR',
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-1',
          name: 'Groceries',
          color: '#FF0000',
          type: 'expense' as const,
        },
      },
    ];

    await exportTransactionsToCSV(transactions, undefined, 'EUR');

    const csvData = mockUnparse.mock.calls[0]![0] as CSVRowData[];
    expect(csvData[0]!['Exchange Rate']).toBe('');
    expect(csvData[0]!['Converted Amount']).toBe('');
  });

  // Default currency when no currency field is set
  test('defaults currency to preferred currency when not specified', async () => {
    const transactions = [
      {
        id: '1',
        amount: 50.0,
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

    await exportTransactionsToCSV(transactions, undefined, 'EUR');

    const csvData = mockUnparse.mock.calls[0]![0] as CSVRowData[];
    expect(csvData[0]!.Currency).toBe('EUR');
    expect(csvData[0]!['Exchange Rate']).toBe('');
    expect(csvData[0]!['Converted Amount']).toBe('');
  });

  // Mixed currencies in export
  test('handles mixed currency transactions in export', async () => {
    const transactions = [
      {
        id: '1',
        amount: 100.0,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        currency: 'EUR',
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-1',
          name: 'Groceries',
          color: '#FF0000',
          type: 'expense' as const,
        },
      },
      {
        id: '2',
        amount: 50.0,
        type: 'expense' as const,
        date: '2025-12-14',
        notes: null,
        currency: 'USD',
        exchange_rate: 0.93,
        created_at: '2025-12-14T10:30:00Z',
        category: {
          id: 'cat-2',
          name: 'Shopping',
          color: '#0000FF',
          type: 'expense' as const,
        },
      },
    ];

    await exportTransactionsToCSV(transactions, undefined, 'EUR');

    const csvData = mockUnparse.mock.calls[0]![0] as CSVRowData[];
    expect(csvData).toHaveLength(2);

    // First: EUR transaction - no conversion
    expect(csvData[0]!.Currency).toBe('EUR');
    expect(csvData[0]!['Exchange Rate']).toBe('');

    // Second: USD transaction - has conversion
    expect(csvData[1]!.Currency).toBe('USD');
    expect(csvData[1]!['Exchange Rate']).toBe('0.9300');
  });
});
