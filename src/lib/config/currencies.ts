/**
 * Currency Configuration
 * Story 10-3: Multi-Currency User Settings & Configuration
 *
 * Centralized currency definitions for the application.
 * AC-10.3.2: Supported currencies array with code, symbol, name, locale
 * AC-10.3.3: Initial supported currencies: EUR (default), USD
 */

/**
 * Currency configuration type
 */
export interface CurrencyConfig {
  /** ISO 4217 currency code */
  code: 'EUR' | 'USD' | 'GBP';
  /** Currency symbol */
  symbol: string;
  /** Full currency name (English) */
  name: string;
  /** Default Intl locale for formatting this currency */
  defaultLocale: string;
  /** Whether this currency is currently enabled */
  enabled: boolean;
}

/**
 * All supported currencies with configuration
 * AC-10.3.3: EUR is default, USD is secondary
 */
export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    defaultLocale: 'de-DE',
    enabled: true,
  },
  {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    defaultLocale: 'en-US',
    enabled: true,
  },
  {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    defaultLocale: 'en-GB',
    enabled: false,
  },
];

/**
 * Default currency code for new users
 */
export const DEFAULT_CURRENCY: CurrencyConfig['code'] = 'EUR';

/**
 * Get currency configuration by code
 * @param code - ISO 4217 currency code
 * @returns CurrencyConfig or undefined if not found
 */
export function getCurrencyConfig(code: string): CurrencyConfig | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code);
}

/**
 * Get all enabled currencies
 * @returns Array of enabled CurrencyConfig objects
 */
export function getEnabledCurrencies(): CurrencyConfig[] {
  return SUPPORTED_CURRENCIES.filter((c) => c.enabled);
}

/**
 * Get the default currency configuration
 * @returns Default CurrencyConfig (EUR)
 */
export function getDefaultCurrencyConfig(): CurrencyConfig {
  return SUPPORTED_CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY)!;
}
