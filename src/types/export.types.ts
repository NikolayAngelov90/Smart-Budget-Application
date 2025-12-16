/**
 * Export Types
 * Story 8.2: Export Financial Report to PDF
 *
 * Type definitions for export functionality
 */

/**
 * PDF Monthly Report Data Structure
 * AC-8.2.4-8.2.7: Report includes month, summary, categories, and top transactions
 */
export interface PDFReportData {
  /** Month in YYYY-MM format */
  month: string;

  /** Financial summary for the month */
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
  };

  /** Category breakdown with amounts and percentages */
  categories: Array<{
    name: string;
    amount: number;
    percentage: number;
    color: string;
  }>;

  /** Top 5 highest expense transactions */
  topTransactions: Array<{
    date: string;
    category: string;
    amount: number;
    notes: string;
  }>;
}
