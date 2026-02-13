/**
 * Exchange Rates API Endpoint
 * Story 10-5: Exchange Rate Integration & Currency Conversion
 *
 * GET /api/exchange-rates?base=EUR
 *
 * Returns current exchange rates with caching and rate limiting.
 * Uses exchangerate-api.com free tier (no API key required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getExchangeRates } from '@/lib/services/exchangeRateService';

/**
 * GET /api/exchange-rates
 *
 * Query params:
 * - base: Base currency code (default: 'EUR')
 *
 * Returns exchange rates relative to base currency.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get base currency from query params
    const { searchParams } = new URL(request.url);
    const baseCurrency = (searchParams.get('base') || 'EUR').toUpperCase();

    // Validate base currency
    const validCurrencies = ['EUR', 'USD', 'GBP'];
    if (!validCurrencies.includes(baseCurrency)) {
      return NextResponse.json(
        { error: `Invalid base currency: ${baseCurrency}. Supported: ${validCurrencies.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch rates (with caching and rate limiting)
    const rateData = await getExchangeRates(baseCurrency);

    return NextResponse.json(rateData, { status: 200 });
  } catch (error) {
    console.error('[ExchangeRates API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}
