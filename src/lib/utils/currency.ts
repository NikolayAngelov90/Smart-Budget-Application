/**
 * Currency formatting utility
 * Story 5.2: Financial Summary Cards
 * Story 10-1: i18n Framework Setup & Language Switcher
 * Story 10-3: Multi-Currency User Settings & Configuration
 *
 * Provides consistent currency formatting across the application
 * Supports locale-aware number formatting with multiple currencies
 */

import { DEFAULT_CURRENCY } from '@/lib/config/currencies';

/**
 * Map language codes to Intl locale identifiers for number formatting
 */
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  bg: 'bg-BG',
};

/**
 * Formats a number as currency with locale-aware formatting
 * AC-10.3.5: Currency symbol displayed correctly
 * AC-10.3.6: Currency formatting respects locale
 *
 * @param amount - The numeric amount to format
 * @param language - Optional language code for locale-aware formatting
 * @param currencyCode - Optional ISO 4217 currency code (default: DEFAULT_CURRENCY)
 * @returns Formatted currency string (e.g., "€1,234.56" or "$1,234.56")
 */
export function formatCurrency(
  amount: number,
  language?: string,
  currencyCode?: string
): string {
  const locale = language ? LOCALE_MAP[language] || 'en-US' : 'en-US';
  const currency = currencyCode || DEFAULT_CURRENCY;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a number as currency with + or - prefix
 * AC-10.3.5: Multi-currency support for signed amounts
 *
 * @param amount - The numeric amount to format
 * @param showSign - Whether to show + for positive numbers (default: true)
 * @param language - Optional language code for locale-aware formatting
 * @param currencyCode - Optional ISO 4217 currency code (default: DEFAULT_CURRENCY)
 * @returns Formatted currency string with sign (e.g., "+€1,234.56" or "-€1,234.56")
 */
export function formatCurrencyWithSign(
  amount: number,
  showSign = true,
  language?: string,
  currencyCode?: string
): string {
  const formatted = formatCurrency(Math.abs(amount), language, currencyCode);

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
/**
 * Format exchange rate display string
 * AC-10.5.7: Rate display "1 EUR = X.XX USD"
 *
 * @param fromCurrency - Base currency
 * @param toCurrency - Target currency
 * @param rate - Exchange rate
 * @returns Formatted rate string
 */
export function formatExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  rate: number
): string {
  return `1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}`;
}

export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}
