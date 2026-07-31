/**
 * Cross-currency conversion for aggregate reads — DW-1.
 *
 * `/api/dashboard/stats` has always converted foreign-currency rows using the
 * stored entry-time `exchange_rate` AND falling back to a live rate when a row
 * has none. `/api/budgets`, `/api/wishlist` and `/api/what-if` did only half of
 * that — stored rate or nothing — so a row with `exchange_rate = NULL` was
 * summed RAW, as if its amount were already in the preferred currency.
 *
 * Those rows exist: anything entered before the currency preference existed has
 * no stored rate. The result was two numbers for one month — the dashboard
 * converted a 100 USD expense, the budget page counted it as 100 EUR — with the
 * preferred-currency symbol asserting something untrue on both.
 *
 * This is one implementation rather than four. Four copies is how the three
 * routes drifted from the dashboard in the first place.
 */

import { getExchangeRates } from '@/lib/services/exchangeRateService';
import { logger } from '@/lib/utils/logger';

/** The columns any aggregate read needs in order to convert honestly. */
export interface ConvertibleRow {
  amount: number;
  currency?: string | null;
  exchange_rate?: number | null;
}

/** currency code -> rate INTO the preferred currency. */
export type LiveRateMap = Record<string, number>;

/**
 * True when a row is in a different currency AND carries no stored rate, so it
 * needs a live lookup. `currency = NULL` means "already preferred" — it is not
 * foreign, and treating it as such would double-convert.
 */
function needsLiveRate(row: ConvertibleRow, preferredCurrency: string): boolean {
  return !!row.currency && row.currency !== preferredCurrency && !row.exchange_rate;
}

/**
 * One lookup per CURRENCY, never per row.
 *
 * `getExchangeRates` is Redis-cached at roughly one upstream call per hour per
 * currency, but a per-row loop would still serialise a network round trip for
 * every transaction in the window.
 *
 * A missing rate is an ENRICHMENT failure per the degradation policy: warn and
 * leave the row unconverted. Never throw — that would 500 a whole screen over
 * one unavailable rate, and an error response poisons the SWR localStorage
 * cache.
 */
export async function buildLiveRateMap(
  rows: ConvertibleRow[],
  preferredCurrency: string,
  logScope: string
): Promise<LiveRateMap> {
  const needed = new Set<string>();
  for (const row of rows) {
    if (needsLiveRate(row, preferredCurrency)) needed.add(row.currency as string);
  }
  // The common case: nothing foreign, so no lookup and no added latency.
  if (needed.size === 0) return {};

  const rates: LiveRateMap = {};
  for (const from of needed) {
    try {
      const data = await getExchangeRates(from);
      const rate = data.rates[preferredCurrency];
      if (rate != null) rates[from] = rate;
    } catch (e) {
      logger.warn(logScope, `Could not fetch live rate for ${from}->${preferredCurrency}:`, e);
    }
  }
  return rates;
}

/**
 * A row's amount in the preferred currency.
 *
 * Stored rate first — it is the rate at the moment the money moved, which is
 * what actually happened. The live rate is a fallback for rows that predate the
 * preference. If neither is available the amount is returned unchanged, which
 * is the same thing every one of these routes did for ALL foreign rows before.
 */
export function convertToPreferred(
  row: ConvertibleRow,
  preferredCurrency: string,
  liveRates: LiveRateMap = {}
): number {
  if (!row.currency || row.currency === preferredCurrency) return row.amount;
  if (row.exchange_rate) return row.amount * row.exchange_rate;

  const live = liveRates[row.currency];
  return live != null ? row.amount * live : row.amount;
}

/**
 * Convenience for the common shape: build the map, then convert every row.
 * Returns the converted amounts positionally so callers can keep their own
 * grouping logic.
 */
export async function convertRows<T extends ConvertibleRow>(
  rows: T[],
  preferredCurrency: string,
  logScope: string
): Promise<{ row: T; amount: number }[]> {
  const liveRates = await buildLiveRateMap(rows, preferredCurrency, logScope);
  return rows.map((row) => ({
    row,
    amount: convertToPreferred(row, preferredCurrency, liveRates),
  }));
}
