/**
 * Export Service
 * Story 8.1: Export Transactions to CSV
 *
 * Client-side export functionality for transactions and reports.
 * Privacy-first design: All processing happens in the browser.
 */

import Papa from 'papaparse';
import { format } from 'date-fns';

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
 * @returns Promise that resolves when download is triggered
 */
export async function exportTransactionsToCSV(
  transactions: TransactionWithCategory[],
  onProgress?: (progress: number) => void
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

        // AC-8.1.7: Amount formatted as $123.45
        Amount: `$${tx.amount.toFixed(2)}`,

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
  } catch (error) {
    console.error('Error exporting transactions to CSV:', error);
    throw new Error('Failed to export transactions. Please try again.');
  }
}
