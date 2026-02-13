/**
 * Export Service
 * Story 8.1: Export Transactions to CSV
 * Story 8.2: Export Financial Report to PDF
 * Story 9.5: Export Analytics Integration
 *
 * Client-side export functionality for transactions and reports.
 * Privacy-first design: All processing happens in the browser.
 */

import Papa from 'papaparse';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PDFReportData } from '@/types/export.types';
import { trackCSVExported, trackPDFExported } from './analyticsService';
import { formatCurrency } from '@/lib/utils/currency';

/**
 * Transaction type with category information
 * Matches the structure returned by GET /api/transactions
 */
interface TransactionWithCategory {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  notes: string | null;
  created_at: string;
  category: {
    id: string;
    name: string;
    color: string;
    type: 'income' | 'expense';
  } | null;
}

/**
 * CSV row structure for transaction export
 * AC-8.1.4: Columns - Date, Type, Category, Amount, Notes, Created At
 */
interface CSVRow {
  Date: string;
  Type: string;
  Category: string;
  Amount: string;
  Notes: string;
  'Created At': string;
}

/**
 * Export transactions to CSV file
 *
 * AC-8.1.1: Export button triggers CSV download
 * AC-8.1.2: Browser save dialog triggered
 * AC-8.1.3: Filename format transactions-YYYY-MM-DD.csv
 * AC-8.1.4: CSV columns - Date, Type, Category, Amount, Notes, Created At
 * AC-8.1.5: All transactions included, sorted by date (newest first)
 * AC-8.1.6: Special characters properly escaped
 * AC-8.1.7: Amount formatted as $123.45
 * AC-8.1.8: Date format YYYY-MM-DD (ISO 8601)
 * AC-8.1.9: Progress indicator for large datasets (>5,000 transactions)
 * AC-8.1.10: Client-side processing with papaparse
 *
 * @param transactions - Array of transactions with category information
 * @param onProgress - Optional callback for progress updates (0-100)
 * @param currencyCode - Optional currency code (defaults to user's preference or EUR)
 * @returns Promise that resolves when download is triggered
 */
export async function exportTransactionsToCSV(
  transactions: TransactionWithCategory[],
  onProgress?: (progress: number) => void,
  currencyCode?: string
): Promise<void> {
  try {
    // AC-8.1.9: For large datasets, process in chunks to avoid freezing
    const CHUNK_SIZE = 1000;
    const totalTransactions = transactions.length;
    const csvData: CSVRow[] = [];

    // Report initial progress
    onProgress?.(0);

    // Process transactions in chunks
    for (let i = 0; i < totalTransactions; i += CHUNK_SIZE) {
      const chunk = transactions.slice(i, i + CHUNK_SIZE);

      // AC-8.1.4, 8.1.7, 8.1.8: Map chunk to CSV structure
      const chunkData = chunk.map((tx) => ({
        // AC-8.1.8: Date in YYYY-MM-DD format (ISO 8601)
        Date: format(new Date(tx.date), 'yyyy-MM-dd'),

        // Type: income or expense
        Type: tx.type,

        // Category name or "Unknown" if missing
        Category: tx.category?.name || 'Unknown',

        // AC-8.1.7: Amount formatted with user's preferred currency
        Amount: formatCurrency(tx.amount, undefined, currencyCode),

        // Notes: empty string if null (not "null")
        Notes: tx.notes || '',

        // Created At: Full timestamp
        'Created At': format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss'),
      }));

      csvData.push(...chunkData);

      // Report progress after each chunk
      const progress = Math.floor(((i + chunk.length) / totalTransactions) * 90); // Reserve 10% for CSV generation
      onProgress?.(progress);

      // Yield to browser to prevent freezing
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // AC-8.1.10: Use papaparse for CSV generation
    // AC-8.1.6: papaparse automatically handles special character escaping
    onProgress?.(95);
    const csv = Papa.unparse(csvData);

    // Create blob for download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // AC-8.1.3: Filename format transactions-YYYY-MM-DD.csv
    const filename = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    // AC-8.1.2: Trigger browser download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    // Clean up
    URL.revokeObjectURL(url);

    // Report completion
    onProgress?.(100);

    // AC-9.5.1, AC-9.5.5: Track CSV export (fire-and-forget, don't break export)
    trackCSVExported(totalTransactions).catch(() => {
      // Analytics failure should not break export
    });
  } catch (error) {
    console.error('Error exporting transactions to CSV:', error);
    throw new Error('Failed to export transactions. Please try again.');
  }
}

/**
 * Export monthly financial report to PDF
 * Story 8.2: Export Financial Report to PDF
 *
 * AC-8.2.1: Export button labeled "Export Monthly Report (PDF)"
 * AC-8.2.2: Month selector shows last 12 months
 * AC-8.2.3: Filename format: budget-report-YYYY-MM.pdf
 * AC-8.2.4: PDF includes header with app title and month/year
 * AC-8.2.5: PDF includes summary (income, expenses, net balance)
 * AC-8.2.6: PDF includes category breakdown table with amounts and percentages
 * AC-8.2.7: PDF includes top 5 highest expense transactions
 * AC-8.2.8: Professional styling with consistent fonts, spacing, colors
 * AC-8.2.9: Generation completes in <5 seconds
 * AC-8.2.10: Client-side processing with jsPDF
 * AC-8.2.11: A4 paper size, readable on all devices
 * AC-8.2.12: Success toast displays "PDF report downloaded!"
 *
 * @param reportData - Monthly report data with summary, categories, and transactions
 * @param currencyCode - Optional currency code (defaults to user's preference or EUR)
 * @returns Promise that resolves when PDF download is triggered
 */
export async function exportMonthlyReportToPDF(
  reportData: PDFReportData,
  currencyCode?: string
): Promise<void> {
  try {
    // AC-8.2.11: Create PDF with A4 format (210x297mm)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // AC-8.2.8: Professional styling - colors and fonts
    const primaryColor: [number, number, number] = [36, 76, 125]; // Trust Blue
    const textColor: [number, number, number] = [45, 55, 72]; // Gray 800
    const lightGray: [number, number, number] = [247, 250, 252]; // Gray 50

    let yPosition = 20;

    // AC-8.2.4: Header with app title and month/year
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Smart Budget Application', 105, yPosition, { align: 'center' });

    yPosition += 10;
    doc.setFontSize(16);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    const monthYear = format(new Date(reportData.month + '-01'), 'MMMM yyyy');
    doc.text(`Monthly Financial Report - ${monthYear}`, 105, yPosition, { align: 'center' });

    yPosition += 15;

    // AC-8.2.5: Summary section (income, expenses, net balance)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Financial Summary', 20, yPosition);

    yPosition += 10;

    // Summary table
    autoTable(doc, {
      startY: yPosition,
      head: [['Metric', 'Amount']],
      body: [
        ['Total Income', formatCurrency(reportData.summary.totalIncome, undefined, currencyCode)],
        ['Total Expenses', formatCurrency(reportData.summary.totalExpenses, undefined, currencyCode)],
        ['Net Balance', formatCurrency(reportData.summary.netBalance, undefined, currencyCode)],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 11,
      },
      bodyStyles: {
        fontSize: 10,
        textColor: textColor,
      },
      alternateRowStyles: {
        fillColor: lightGray,
      },
      margin: { left: 20, right: 20 },
      styles: {
        cellPadding: 5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
    });

    // @ts-expect-error - autoTable modifies doc but TypeScript doesn't know
    yPosition = doc.lastAutoTable.finalY + 15;

    // AC-8.2.6: Category breakdown with amounts and percentages
    if (reportData.categories.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('Spending by Category', 20, yPosition);

      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        head: [['Category', 'Amount', 'Percentage']],
        body: reportData.categories.map((cat) => [
          cat.name,
          formatCurrency(cat.amount, undefined, currencyCode),
          `${cat.percentage.toFixed(1)}%`,
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 11,
        },
        bodyStyles: {
          fontSize: 10,
          textColor: textColor,
        },
        alternateRowStyles: {
          fillColor: lightGray,
        },
        margin: { left: 20, right: 20 },
        styles: {
          cellPadding: 5,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
      });

      // @ts-expect-error - autoTable modifies doc but TypeScript doesn't know
      yPosition = doc.lastAutoTable.finalY + 15;
    }

    // AC-8.2.7: Top 5 highest expense transactions
    if (reportData.topTransactions.length > 0) {
      // Check if we need a new page
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('Top 5 Expenses', 20, yPosition);

      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        head: [['Date', 'Category', 'Amount', 'Notes']],
        body: reportData.topTransactions.map((tx) => [
          format(new Date(tx.date), 'MMM dd, yyyy'),
          tx.category,
          formatCurrency(tx.amount, undefined, currencyCode),
          tx.notes || '-',
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 11,
        },
        bodyStyles: {
          fontSize: 10,
          textColor: textColor,
        },
        alternateRowStyles: {
          fillColor: lightGray,
        },
        margin: { left: 20, right: 20 },
        styles: {
          cellPadding: 5,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        columnStyles: {
          3: { cellWidth: 60 }, // Notes column wider
        },
      });
    }

    // AC-8.2.3: Filename format budget-report-YYYY-MM.pdf
    const filename = `budget-report-${reportData.month}.pdf`;

    // Get page count before saving
    const pageCount = doc.getNumberOfPages();

    // AC-8.2.10: Trigger browser download (client-side)
    doc.save(filename);

    // AC-9.5.2, AC-9.5.5: Track PDF export (fire-and-forget, don't break export)
    trackPDFExported(reportData.month, pageCount).catch(() => {
      // Analytics failure should not break export
    });
  } catch (error) {
    console.error('Error generating PDF report:', error);
    throw new Error('Failed to generate PDF report. Please try again.');
  }
}
