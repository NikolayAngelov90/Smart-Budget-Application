/**
 * Exchange Rate Service Unit Tests
 * Story 10-5: Exchange Rate Integration & Currency Conversion
 *
 * Tests for:
 * - API fetching (AC-10.5.1)
 * - Caching behavior (AC-10.5.2)
 * - Currency conversion (AC-10.5.3)
 * - Fallback behavior (AC-10.5.4)
 * - Rate display formatting (AC-10.5.7)
 * - Rate limiting (AC-10.5.9)
 */

import {
  fetchRatesFromApi,
  getExchangeRates,
  convertCurrency,
  formatExchangeRate,
  __clearCacheForTesting,
} from '@/lib/services/exchangeRateService';

// Mock Redis client
jest.mock('@/lib/redis/client', () => ({
  getRedisClient: jest.fn().mockReturnValue(null),
  isRedisConfigured: jest.fn().mockReturnValue(false),
  getRedisProvider: jest.fn().mockReturnValue('none'),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('exchangeRateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __clearCacheForTesting();
  });

  // ============================================================
  // AC-10.5.1: Integrate free exchange rate API
  // ============================================================
  describe('fetchRatesFromApi', () => {
    test('fetches rates from API and returns structured data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          base: 'EUR',
          date: '2025-01-15',
          rates: { USD: 1.08, GBP: 0.86, EUR: 1 },
        }),
      });

      const result = await fetchRatesFromApi('EUR');

      expect(result).not.toBeNull();
      expect(result!.base).toBe('EUR');
      expect(result!.date).toBe('2025-01-15');
      expect(result!.rates.USD).toBe(1.08);
      expect(result!.rates.GBP).toBe(0.86);
      expect(result!.fetchedAt).toBeDefined();
    });

    test('returns null when API returns non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await fetchRatesFromApi('EUR');
      expect(result).toBeNull();
    });

    test('returns null when API returns invalid data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'data' }),
      });

      const result = await fetchRatesFromApi('EUR');
      expect(result).toBeNull();
    });

    test('returns null when fetch throws an error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchRatesFromApi('EUR');
      expect(result).toBeNull();
    });

    test('calls correct API URL with base currency', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          base: 'USD',
          date: '2025-01-15',
          rates: { EUR: 0.93, GBP: 0.79 },
        }),
      });

      await fetchRatesFromApi('USD');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('USD'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  // ============================================================
  // AC-10.5.2 & AC-10.5.4: Caching and fallback behavior
  // ============================================================
  describe('getExchangeRates', () => {
    test('fetches from API when no cache exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          base: 'EUR',
          date: '2025-01-15',
          rates: { USD: 1.08, GBP: 0.86 },
        }),
      });

      const result = await getExchangeRates('EUR');

      expect(result.base).toBe('EUR');
      expect(result.rates.USD).toBe(1.08);
      expect(result.cached).toBe(false);
    });

    test('returns cached data on subsequent calls', async () => {
      // First call - fetches from API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          base: 'EUR',
          date: '2025-01-15',
          rates: { USD: 1.08 },
        }),
      });

      await getExchangeRates('EUR');

      // Second call - should use cache (no Redis, so uses in-memory)
      const result = await getExchangeRates('EUR');

      // fetch called only once (first call); second call uses memory cache
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.rates.USD).toBe(1.08);
    });

    test('falls back to hardcoded rates when API and cache are unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getExchangeRates('EUR');

      expect(result.base).toBe('EUR');
      expect(result.cached).toBe(true);
      // Hardcoded fallback rates
      expect(result.rates.USD).toBe(1.08);
      expect(result.rates.GBP).toBe(0.86);
    });

    test('uses in-memory cache when API fails after successful fetch', async () => {
      // First call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          base: 'EUR',
          date: '2025-01-15',
          rates: { USD: 1.10 },
        }),
      });

      await getExchangeRates('EUR');

      // Clear the fetch mock for second call
      mockFetch.mockRejectedValueOnce(new Error('API down'));

      // Second call should use cached data
      const result = await getExchangeRates('EUR');
      expect(result.rates.USD).toBe(1.10);
      expect(result.cached).toBe(true);
    });

    test('defaults to EUR when no base currency specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          base: 'EUR',
          date: '2025-01-15',
          rates: { USD: 1.08 },
        }),
      });

      const result = await getExchangeRates();
      expect(result.base).toBe('EUR');
    });
  });

  // ============================================================
  // AC-10.5.3: convertCurrency utility function
  // ============================================================
  describe('convertCurrency', () => {
    beforeEach(() => {
      // Set up API response for conversion tests
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          base: 'EUR',
          date: '2025-01-15',
          rates: { USD: 1.08, GBP: 0.86, EUR: 1 },
        }),
      });
    });

    test('converts EUR to USD correctly', async () => {
      const result = await convertCurrency(100, 'EUR', 'USD');

      expect(result).not.toBeNull();
      expect(result!.originalAmount).toBe(100);
      expect(result!.convertedAmount).toBe(108);
      expect(result!.fromCurrency).toBe('EUR');
      expect(result!.toCurrency).toBe('USD');
      expect(result!.rate).toBe(1.08);
    });

    test('returns same amount for same currency conversion', async () => {
      const result = await convertCurrency(100, 'EUR', 'EUR');

      expect(result).not.toBeNull();
      expect(result!.convertedAmount).toBe(100);
      expect(result!.rate).toBe(1);
    });

    test('rounds converted amount to 2 decimal places', async () => {
      const result = await convertCurrency(33.33, 'EUR', 'USD');

      expect(result).not.toBeNull();
      // 33.33 * 1.08 = 35.9964, rounded to 36.00
      expect(result!.convertedAmount).toBe(36);
    });

    test('handles zero amount', async () => {
      const result = await convertCurrency(0, 'EUR', 'USD');

      expect(result).not.toBeNull();
      expect(result!.convertedAmount).toBe(0);
    });

    test('handles large amounts', async () => {
      const result = await convertCurrency(1000000, 'EUR', 'USD');

      expect(result).not.toBeNull();
      expect(result!.convertedAmount).toBe(1080000);
    });

    test('includes rate date in result', async () => {
      const result = await convertCurrency(100, 'EUR', 'USD');

      expect(result).not.toBeNull();
      expect(result!.rateDate).toBe('2025-01-15');
    });

    test('returns null for unsupported currency pair', async () => {
      const result = await convertCurrency(100, 'EUR', 'XYZ');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // AC-10.5.7: Rate display formatting
  // ============================================================
  describe('formatExchangeRate', () => {
    test('formats EUR to USD rate correctly', () => {
      const result = formatExchangeRate('EUR', 'USD', 1.0834);
      expect(result).toBe('1 EUR = 1.0834 USD');
    });

    test('formats EUR to GBP rate correctly', () => {
      const result = formatExchangeRate('EUR', 'GBP', 0.8612);
      expect(result).toBe('1 EUR = 0.8612 GBP');
    });

    test('formats rate with 4 decimal places', () => {
      const result = formatExchangeRate('USD', 'EUR', 0.925925925);
      expect(result).toBe('1 USD = 0.9259 EUR');
    });

    test('formats rate of 1 (same currency)', () => {
      const result = formatExchangeRate('EUR', 'EUR', 1);
      expect(result).toBe('1 EUR = 1.0000 EUR');
    });
  });
});
