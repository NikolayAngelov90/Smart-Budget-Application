/**
 * Application Constants
 * Story 4.1: Seed Default Categories on User Signup
 *
 * Contains shared constants used throughout the application.
 */

/**
 * Default categories seeded for new users on signup
 *
 * Provides 11 predefined categories:
 * - 7 expense categories (Dining, Transport, Entertainment, Utilities, Shopping, Healthcare, Rent)
 * - 4 income categories (Salary, Freelance, Investment, Gift)
 *
 * Each category has:
 * - name: Display name for the category
 * - color: Hex color code (#RRGGBB) for visual identification
 * - type: 'income' or 'expense' transaction type
 *
 * These categories are seeded with is_predefined=true flag to protect them from user edits/deletes.
 *
 * Referenced by: SeedCategoriesService for bulk insert on user signup
 * Related: Epic 4 Tech Spec lines 151-167, PRD FR11-FR12
 */
export const DEFAULT_CATEGORIES = [
  // Expense categories (7)
  { name: 'Dining', color: '#f56565', type: 'expense' as const },
  { name: 'Transport', color: '#4299e1', type: 'expense' as const },
  { name: 'Entertainment', color: '#9f7aea', type: 'expense' as const },
  { name: 'Utilities', color: '#48bb78', type: 'expense' as const },
  { name: 'Shopping', color: '#ed8936', type: 'expense' as const },
  { name: 'Healthcare', color: '#38b2ac', type: 'expense' as const },
  { name: 'Rent', color: '#e53e3e', type: 'expense' as const },

  // Income categories (4)
  { name: 'Salary', color: '#38a169', type: 'income' as const },
  { name: 'Freelance', color: '#4299e1', type: 'income' as const },
  { name: 'Investment', color: '#9f7aea', type: 'income' as const },
  { name: 'Gift', color: '#f56565', type: 'income' as const },
] as const;

/**
 * Supported currencies for multi-currency transactions
 * Story 10-6: Transaction Multi-Currency Support
 * Story 11.3: Extracted from hardcoded values for consistency
 *
 * ISO 4217 currency codes supported by the application.
 * Used for validation in API routes and display in UI components.
 */
export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

/**
 * Default currency used when no currency is specified
 */
export const DEFAULT_CURRENCY: SupportedCurrency = 'EUR';
