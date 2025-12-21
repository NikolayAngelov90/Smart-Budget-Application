/**
 * Story 8.2: Export Financial Report to PDF
 * Unit Tests for PDF Export Functionality
 */

import { exportMonthlyReportToPDF } from '../exportService';
import type { PDFReportData } from '@/types/export.types';
import jsPDF from 'jspdf';

// Mock jsPDF
const mockSave = jest.fn();
const mockAddPage = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetTextColor = jest.fn();
const mockSetFont = jest.fn();
const mockText = jest.fn();

jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    setFontSize: mockSetFontSize,
    setTextColor: mockSetTextColor,
    setFont: mockSetFont,
    text: mockText,
    addPage: mockAddPage,
    save: mockSave,
    lastAutoTable: { finalY: 100 },
  }));
});

// Mock jspdf-autotable
const mockAutoTable = jest.fn();
jest.mock('jspdf-autotable', () => {
  return jest.fn((doc, options) => mockAutoTable(doc, options));
});

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date | string, formatStr: string) => {
    if (formatStr === 'MMMM yyyy') {
      return 'January 2025';
    }
    if (formatStr === 'MMM dd, yyyy') {
      return 'Jan 15, 2025';
    }
    return 'mocked-date';
  }),
}));

describe('exportMonthlyReportToPDF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations that may have been overridden in tests
    mockSave.mockReset();
  });

  const createSampleReportData = (): PDFReportData => ({
    month: '2025-01',
    summary: {
      totalIncome: 5000.0,
      totalExpenses: 3000.0,
      netBalance: 2000.0,
    },
    categories: [
      { name: 'Food', amount: 1000.0, percentage: 33.3, color: '#FF0000' },
      { name: 'Transport', amount: 800.0, percentage: 26.7, color: '#00FF00' },
      { name: 'Entertainment', amount: 500.0, percentage: 16.7, color: '#0000FF' },
    ],
    topTransactions: [
      { date: '2025-01-15', category: 'Food', amount: 250.0, notes: 'Groceries' },
      { date: '2025-01-10', category: 'Transport', amount: 200.0, notes: 'Gas' },
      { date: '2025-01-20', category: 'Food', amount: 150.0, notes: 'Restaurant' },
      { date: '2025-01-05', category: 'Entertainment', amount: 100.0, notes: 'Movies' },
      { date: '2025-01-12', category: 'Food', amount: 80.0, notes: 'Coffee' },
    ],
  });

  // AC-8.2.11: Test A4 format and portrait orientation
  test('creates PDF with A4 format and portrait orientation', async () => {
    const reportData = createSampleReportData();

    await exportMonthlyReportToPDF(reportData);

    expect(jsPDF).toHaveBeenCalledWith({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
  });

  // AC-8.2.3: Test filename format
  test('generates filename in format budget-report-YYYY-MM.pdf', async () => {
    const reportData = createSampleReportData();

    await exportMonthlyReportToPDF(reportData);

    expect(mockSave).toHaveBeenCalledWith('budget-report-2025-01.pdf');
  });

  // AC-8.2.4: Test PDF header
  test('adds header with app title and month/year', async () => {
    const reportData = createSampleReportData();

    await exportMonthlyReportToPDF(reportData);

    expect(mockText).toHaveBeenCalledWith(
      'Smart Budget Application',
      105,
      20,
      expect.objectContaining({ align: 'center' })
    );

    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining('Monthly Financial Report'),
      105,
      expect.any(Number),
      expect.objectContaining({ align: 'center' })
    );
  });

  // AC-8.2.5: Test summary section
  test('includes summary section with income, expenses, and net balance', async () => {
    const reportData = createSampleReportData();

    await exportMonthlyReportToPDF(reportData);

    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        head: [['Metric', 'Amount']],
        body: expect.arrayContaining([
          ['Total Income', '$5000.00'],
          ['Total Expenses', '$3000.00'],
          ['Net Balance', '$2000.00'],
        ]),
      })
    );
  });

  // AC-8.2.6: Test category breakdown
  test('includes category breakdown table with amounts and percentages', async () => {
    const reportData = createSampleReportData();

    await exportMonthlyReportToPDF(reportData);

    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        head: [['Category', 'Amount', 'Percentage']],
        body: expect.arrayContaining([
          ['Food', '$1000.00', '33.3%'],
          ['Transport', '$800.00', '26.7%'],
          ['Entertainment', '$500.00', '16.7%'],
        ]),
      })
    );
  });

  // AC-8.2.7: Test top 5 transactions
  test('includes top 5 highest expense transactions', async () => {
    const reportData = createSampleReportData();

    await exportMonthlyReportToPDF(reportData);

    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        head: [['Date', 'Category', 'Amount', 'Notes']],
        body: expect.arrayContaining([
          [expect.any(String), 'Food', '$250.00', 'Groceries'],
          [expect.any(String), 'Transport', '$200.00', 'Gas'],
        ]),
      })
    );
  });

  // AC-8.2.8: Test professional styling
  test('applies professional styling with colors and fonts', async () => {
    const reportData = createSampleReportData();

    await exportMonthlyReportToPDF(reportData);

    // Verify font configuration
    expect(mockSetFont).toHaveBeenCalledWith('helvetica', 'bold');
    expect(mockSetFont).toHaveBeenCalledWith('helvetica', 'normal');

    // Verify colors are set
    expect(mockSetTextColor).toHaveBeenCalled();

    // Verify autoTable styling configuration
    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        theme: 'grid',
        headStyles: expect.objectContaining({
          fillColor: expect.any(Array),
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        }),
      })
    );
  });

  // AC-8.2.10: Test client-side processing
  test('processes PDF generation client-side and triggers download', async () => {
    const reportData = createSampleReportData();

    await exportMonthlyReportToPDF(reportData);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(expect.stringContaining('.pdf'));
  });

  // Edge case: Empty categories
  test('handles empty categories array gracefully', async () => {
    const reportData: PDFReportData = {
      month: '2025-01',
      summary: { totalIncome: 1000.0, totalExpenses: 0.0, netBalance: 1000.0 },
      categories: [],
      topTransactions: [],
    };

    await exportMonthlyReportToPDF(reportData);

    // Should still generate PDF without category section
    expect(mockSave).toHaveBeenCalledWith('budget-report-2025-01.pdf');
  });

  // Edge case: No transactions
  test('handles empty top transactions array', async () => {
    const reportData: PDFReportData = {
      month: '2025-01',
      summary: { totalIncome: 0.0, totalExpenses: 0.0, netBalance: 0.0 },
      categories: [],
      topTransactions: [],
    };

    await exportMonthlyReportToPDF(reportData);

    // Should still generate PDF with zero values
    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.arrayContaining([
          ['Total Income', '$0.00'],
          ['Total Expenses', '$0.00'],
          ['Net Balance', '$0.00'],
        ]),
      })
    );
  });

  // Edge case: Transaction with empty notes
  test('handles transactions with empty notes', async () => {
    const reportData: PDFReportData = {
      month: '2025-01',
      summary: { totalIncome: 100.0, totalExpenses: 50.0, netBalance: 50.0 },
      categories: [{ name: 'Food', amount: 50.0, percentage: 100.0, color: '#FF0000' }],
      topTransactions: [
        { date: '2025-01-15', category: 'Food', amount: 50.0, notes: '' },
      ],
    };

    await exportMonthlyReportToPDF(reportData);

    // Should display '-' for empty notes
    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.arrayContaining([
          [expect.any(String), 'Food', '$50.00', '-'],
        ]),
      })
    );
  });

  // Error handling
  test('throws error when PDF generation fails', async () => {
    mockSave.mockImplementation(() => {
      throw new Error('PDF generation failed');
    });

    const reportData = createSampleReportData();

    await expect(exportMonthlyReportToPDF(reportData)).rejects.toThrow(
      'Failed to generate PDF report'
    );
  });

  // AC-8.2.9: Performance test (mock timer)
  test('completes PDF generation efficiently', async () => {
    const startTime = Date.now();
    const reportData = createSampleReportData();

    await exportMonthlyReportToPDF(reportData);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (mocked, so should be <100ms)
    expect(duration).toBeLessThan(5000);
  });

  // Test calculation accuracy
  test('correctly formats monetary amounts with 2 decimal places', async () => {
    const reportData: PDFReportData = {
      month: '2025-01',
      summary: { totalIncome: 1234.567, totalExpenses: 987.654, netBalance: 246.913 },
      categories: [
        { name: 'Food', amount: 123.456, percentage: 50.5, color: '#FF0000' },
      ],
      topTransactions: [
        { date: '2025-01-15', category: 'Food', amount: 67.89, notes: 'Test' },
      ],
    };

    await exportMonthlyReportToPDF(reportData);

    // Check summary formatting
    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.arrayContaining([
          ['Total Income', '$1234.57'],
          ['Total Expenses', '$987.65'],
          ['Net Balance', '$246.91'],
        ]),
      })
    );

    // Check category formatting
    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.arrayContaining([
          ['Food', '$123.46', '50.5%'],
        ]),
      })
    );

    // Check transaction formatting
    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.arrayContaining([
          [expect.any(String), 'Food', '$67.89', 'Test'],
        ]),
      })
    );
  });

  // Test percentage formatting
  test('formats percentages with 1 decimal place', async () => {
    const reportData: PDFReportData = {
      month: '2025-01',
      summary: { totalIncome: 1000.0, totalExpenses: 300.0, netBalance: 700.0 },
      categories: [
        { name: 'Food', amount: 100.0, percentage: 33.333, color: '#FF0000' },
        { name: 'Transport', amount: 200.0, percentage: 66.666, color: '#00FF00' },
      ],
      topTransactions: [],
    };

    await exportMonthlyReportToPDF(reportData);

    expect(mockAutoTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.arrayContaining([
          ['Food', '$100.00', '33.3%'],
          ['Transport', '$200.00', '66.7%'],
        ]),
      })
    );
  });
});
