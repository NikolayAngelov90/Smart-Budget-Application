/**
 * Exchange Rate Types
 * Story 10-5: Exchange Rate Integration & Currency Conversion
 */

/**
 * Exchange rate data from external API
 */
export interface ExchangeRateData {
  /** Base currency code (e.g., 'EUR') */
  base: string;
  /** Date of the rates (YYYY-MM-DD) */
  date: string;
  /** Map of currency code to rate relative to base */
  rates: Record<string, number>;
  /** Timestamp when rates were fetched */
  fetchedAt: string;
}

/**
 * Cached exchange rate entry stored in Redis/Supabase
 */
export interface ExchangeRateCache {
  /** Base currency code */
  base: string;
  /** Target currency code */
  target: string;
  /** Exchange rate (1 base = rate target) */
  rate: number;
  /** Date of the rate (YYYY-MM-DD) */
  date: string;
  /** When this cache entry was created */
  cachedAt: string;
}

/**
 * Response from GET /api/exchange-rates
 */
export interface ExchangeRateResponse {
  /** Base currency */
  base: string;
  /** All available rates */
  rates: Record<string, number>;
  /** Date of rates */
  date: string;
  /** Whether data came from cache */
  cached: boolean;
  /** When the data was last fetched from the API */
  lastFetched: string;
}

/**
 * Currency conversion result
 */
export interface ConversionResult {
  /** Original amount */
  originalAmount: number;
  /** Converted amount */
  convertedAmount: number;
  /** Source currency */
  fromCurrency: string;
  /** Target currency */
  toCurrency: string;
  /** Rate used for conversion */
  rate: number;
  /** Date of the rate used */
  rateDate: string;
}
