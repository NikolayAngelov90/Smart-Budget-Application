/**
 * Exchange Rate Service
 * Story 10-5: Exchange Rate Integration & Currency Conversion
 *
 * Fetches, caches, and provides exchange rates for currency conversion.
 * Uses exchangerate-api.com free tier (no API key required).
 *
 * Caching strategy:
 * 1. Redis (Upstash) with 1-hour TTL - primary cache
 * 2. In-memory fallback - last-resort when Redis and API are down
 *
 * Rate limiting: max 1 API request per hour per base currency
 */

import { getRedisClient, isRedisConfigured } from '@/lib/redis/client';
import { Redis as UpstashRedis } from '@upstash/redis';
import type {
  ExchangeRateData,
  ExchangeRateResponse,
  ConversionResult,
} from '@/types/exchangeRate.types';

/** Default API URL for exchange rates */
const DEFAULT_API_URL = 'https://api.exchangerate-api.com/v4/latest';

/** Cache TTL in seconds (1 hour) */
const CACHE_TTL_SECONDS = 3600;

/** Rate limit: minimum seconds between API calls per base currency */
const RATE_LIMIT_SECONDS = 3600;

/** Redis key prefix for exchange rate cache */
const REDIS_KEY_PREFIX = 'exchange_rates';

/** Redis key for rate limit tracking */
const RATE_LIMIT_KEY_PREFIX = 'exchange_rate_limit';

/** In-memory fallback cache (used when Redis is unavailable) */
const memoryCache = new Map<string, ExchangeRateData>();

/** In-memory rate limit tracking (used when Redis is unavailable) */
const memoryRateLimit = new Map<string, number>();

/**
 * Get the exchange rate API URL from environment or default
 */
function getApiUrl(baseCurrency: string): string {
  const baseUrl = process.env.EXCHANGE_RATE_API_URL || DEFAULT_API_URL;
  // If the URL already ends with a currency code, use as-is; otherwise append
  if (baseUrl.match(/\/[A-Z]{3}$/)) {
    return baseUrl;
  }
  return `${baseUrl}/${baseCurrency}`;
}

/**
 * Fetch exchange rates from the external API
 * AC-10.5.1: Integrate free exchange rate API
 *
 * @param baseCurrency - Base currency code (e.g., 'EUR')
 * @returns Exchange rate data or null if fetch fails
 */
export async function fetchRatesFromApi(
  baseCurrency: string
): Promise<ExchangeRateData | null> {
  try {
    const url = getApiUrl(baseCurrency);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      console.error(
        `[ExchangeRate] API returned ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    // exchangerate-api.com returns: { base, date, rates: { USD: 1.08, ... } }
    if (!data.base || !data.rates) {
      console.error('[ExchangeRate] Invalid API response format');
      return null;
    }

    const rateData: ExchangeRateData = {
      base: data.base,
      date: data.date,
      rates: data.rates,
      fetchedAt: new Date().toISOString(),
    };

    return rateData;
  } catch (error) {
    console.error('[ExchangeRate] Failed to fetch rates:', error);
    return null;
  }
}

/**
 * Check if we're rate-limited (max 1 API call per hour per base currency)
 * AC-10.5.9: API rate limiting
 */
async function isRateLimited(baseCurrency: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    // Fall back to in-memory rate limit
    const lastFetchTime = memoryRateLimit.get(baseCurrency);
    if (lastFetchTime) {
      const elapsed = (Date.now() - lastFetchTime) / 1000;
      return elapsed < RATE_LIMIT_SECONDS;
    }
    return false;
  }

  try {
    const client = getRedisClient() as UpstashRedis;
    const key = `${RATE_LIMIT_KEY_PREFIX}:${baseCurrency}`;
    const lastFetch = await client.get<string>(key);
    return lastFetch !== null;
  } catch {
    return false;
  }
}

/**
 * Set rate limit marker in Redis
 */
async function setRateLimit(baseCurrency: string): Promise<void> {
  // Always set in-memory rate limit
  memoryRateLimit.set(baseCurrency, Date.now());

  if (!isRedisConfigured()) return;

  try {
    const client = getRedisClient() as UpstashRedis;
    const key = `${RATE_LIMIT_KEY_PREFIX}:${baseCurrency}`;
    await client.set(key, new Date().toISOString(), {
      ex: RATE_LIMIT_SECONDS,
    });
  } catch (error) {
    console.error('[ExchangeRate] Failed to set rate limit:', error);
  }
}

/**
 * Get cached exchange rates from Redis
 * AC-10.5.2: Server-side caching
 */
async function getCachedRates(
  baseCurrency: string
): Promise<ExchangeRateData | null> {
  // Try Redis first
  if (isRedisConfigured()) {
    try {
      const client = getRedisClient() as UpstashRedis;
      const key = `${REDIS_KEY_PREFIX}:${baseCurrency}`;
      const cached = await client.get<ExchangeRateData>(key);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.error('[ExchangeRate] Redis read failed:', error);
    }
  }

  // Fall back to in-memory cache
  const memoryCached = memoryCache.get(baseCurrency);
  if (memoryCached) {
    return memoryCached;
  }

  return null;
}

/**
 * Store exchange rates in cache (Redis + in-memory)
 */
async function setCachedRates(
  baseCurrency: string,
  data: ExchangeRateData
): Promise<void> {
  // Always update in-memory cache
  memoryCache.set(baseCurrency, data);

  // Try Redis
  if (isRedisConfigured()) {
    try {
      const client = getRedisClient() as UpstashRedis;
      const key = `${REDIS_KEY_PREFIX}:${baseCurrency}`;
      await client.set(key, JSON.stringify(data), {
        ex: CACHE_TTL_SECONDS,
      });
    } catch (error) {
      console.error('[ExchangeRate] Redis write failed:', error);
    }
  }
}

/**
 * Get exchange rates for a base currency, with caching and rate limiting
 * AC-10.5.2: Daily rate fetching with server-side caching
 * AC-10.5.4: Fallback to last known rate
 * AC-10.5.9: Rate limiting
 *
 * @param baseCurrency - Base currency code (default: 'EUR')
 * @returns Exchange rate response
 */
export async function getExchangeRates(
  baseCurrency = 'EUR'
): Promise<ExchangeRateResponse> {
  // 1. Check cache first
  const cached = await getCachedRates(baseCurrency);

  // 2. Check rate limit before fetching
  const rateLimited = await isRateLimited(baseCurrency);

  if (rateLimited && cached) {
    // Return cached data, we're rate-limited
    return {
      base: cached.base,
      rates: cached.rates,
      date: cached.date,
      cached: true,
      lastFetched: cached.fetchedAt,
    };
  }

  // 3. Fetch fresh rates from API
  const freshRates = await fetchRatesFromApi(baseCurrency);

  if (freshRates) {
    // Store in cache and set rate limit
    await setCachedRates(baseCurrency, freshRates);
    await setRateLimit(baseCurrency);

    return {
      base: freshRates.base,
      rates: freshRates.rates,
      date: freshRates.date,
      cached: false,
      lastFetched: freshRates.fetchedAt,
    };
  }

  // 4. API failed - fall back to cached data (AC-10.5.4)
  if (cached) {
    console.warn(
      '[ExchangeRate] API unavailable, using cached rates from',
      cached.fetchedAt
    );
    return {
      base: cached.base,
      rates: cached.rates,
      date: cached.date,
      cached: true,
      lastFetched: cached.fetchedAt,
    };
  }

  // 5. No cache available - return hardcoded fallback rates
  console.warn('[ExchangeRate] No cache available, using hardcoded fallback rates');
  return {
    base: baseCurrency,
    rates: getHardcodedFallbackRates(baseCurrency),
    date: new Date().toISOString().split('T')[0]!,
    cached: true,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Hardcoded fallback rates when both API and cache are unavailable
 * These are approximate rates as of early 2025
 */
function getHardcodedFallbackRates(
  baseCurrency: string
): Record<string, number> {
  const eurRates: Record<string, number> = {
    EUR: 1,
    USD: 1.08,
    GBP: 0.86,
  };

  if (baseCurrency === 'EUR') {
    return eurRates;
  }

  // Convert from EUR-based rates to the requested base
  const baseInEur = eurRates[baseCurrency];
  if (!baseInEur) return eurRates;

  const converted: Record<string, number> = {};
  for (const [code, rate] of Object.entries(eurRates)) {
    converted[code] = rate / baseInEur;
  }
  return converted;
}

/**
 * Get a single exchange rate between two currencies
 *
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns The exchange rate, or null if unavailable
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1;

  const rateData = await getExchangeRates(fromCurrency);
  const rate = rateData.rates[toCurrency];

  if (rate === undefined) {
    console.error(
      `[ExchangeRate] No rate found for ${fromCurrency} -> ${toCurrency}`
    );
    return null;
  }

  return rate;
}

/**
 * Convert an amount from one currency to another
 * AC-10.5.3: convertCurrency utility function
 *
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Conversion result with rate info, or null if conversion impossible
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<ConversionResult | null> {
  if (fromCurrency === toCurrency) {
    return {
      originalAmount: amount,
      convertedAmount: amount,
      fromCurrency,
      toCurrency,
      rate: 1,
      rateDate: new Date().toISOString().split('T')[0]!,
    };
  }

  const rateData = await getExchangeRates(fromCurrency);
  const rate = rateData.rates[toCurrency];

  if (rate === undefined) {
    return null;
  }

  return {
    originalAmount: amount,
    convertedAmount: Math.round(amount * rate * 100) / 100,
    fromCurrency,
    toCurrency,
    rate,
    rateDate: rateData.date,
  };
}

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

/**
 * Clear exchange rate cache (for testing)
 * @internal
 */
export function __clearCacheForTesting(): void {
  memoryCache.clear();
  memoryRateLimit.clear();
}
