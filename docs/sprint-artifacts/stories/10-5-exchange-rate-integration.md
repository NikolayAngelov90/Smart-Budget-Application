# Story 10.5: Exchange Rate Integration & Currency Conversion

Status: done

## Story

As a user with multi-currency transactions,
I want the app to automatically fetch and cache exchange rates,
so that I can see accurate currency conversions and my financial data is presented in my preferred currency.

## Acceptance Criteria

- **AC-10.5.1**: Integrate free exchange rate API (exchangerate-api.com free tier, no API key needed)
- **AC-10.5.2**: Daily rate fetching with server-side caching (Redis with 1-hour TTL, rates update once per day)
- **AC-10.5.3**: `convertCurrency(amount, fromCurrency, toCurrency, date?)` utility function
- **AC-10.5.4**: Fallback to last known rate if API is unavailable (graceful degradation)
- **AC-10.5.5**: Exchange rate stored with each transaction when currency differs from preferred
- **AC-10.5.6**: Dashboard aggregations convert all transactions to preferred currency using stored rates
- **AC-10.5.7**: Rate display: "1 EUR = X.XX USD" shown in Settings currency section
- **AC-10.5.8**: Historical rates used for past transactions (rate at time of entry, not current rate)
- **AC-10.5.9**: API rate limiting: max 1 request per hour to exchange rate service
- **AC-10.5.10**: Unit tests for conversion logic, caching, fallback behavior, and rate staleness

## Implementation Notes

### Architecture
- Exchange rate service: `src/lib/services/exchangeRateService.ts`
- API route: `src/app/api/exchange-rates/route.ts`
- Types: `src/types/exchangeRate.types.ts`
- Conversion utility added to `src/lib/utils/currency.ts`
- Database migration: `supabase/migrations/009_exchange_rates_cache.sql`

### API Provider
- Primary: `https://api.exchangerate-api.com/v4/latest/EUR` (free, no key needed)
- Returns JSON with all rates relative to EUR base
- Fallback: use last cached rates from Redis or Supabase

### Caching Strategy
- Redis (Upstash): Primary cache with 1-hour TTL
- Supabase table: Persistent fallback cache (survives Redis eviction)
- In-memory fallback: Last-resort for when both Redis and API are down

### Rate Limiting
- Track last fetch timestamp in Redis
- Only allow 1 API request per hour per base currency
- Return cached data for intermediate requests

## Dev Notes

- AC-10.5.5 and AC-10.5.6 are foundational infrastructure - the actual storage/aggregation is implemented in Story 10-6
- This story focuses on the exchange rate fetching, caching, conversion utility, and Settings UI display
- The `convertCurrency` function is the key deliverable that Story 10-6 will consume
