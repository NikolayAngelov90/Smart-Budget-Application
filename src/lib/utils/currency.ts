/**
 * Currency formatting utility
 * Story 5.2: Financial Summary Cards
 *
 * Provides consistent currency formatting across the application
 */

/**
 * Formats a number as USD currency with $ symbol and 2 decimal places
 * @param amount - The numeric amount to format
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a number as USD currency with + or - prefix
 * @param amount - The numeric amount to format
 * @param showSign - Whether to show + for positive numbers (default: true)
 * @returns Formatted currency string with sign (e.g., "+$1,234.56" or "-$1,234.56")
 */
export function formatCurrencyWithSign(amount: number, showSign = true): string {
  const formatted = formatCurrency(Math.abs(amount));

  if (amount > 0 && showSign) {
    return `+${formatted}`;
  } else if (amount < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

/**
 * Calculates trend percentage between two values
 * Formula: ((current - previous) / previous) * 100
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Trend percentage, or 0 if previous is 0
 */
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}
