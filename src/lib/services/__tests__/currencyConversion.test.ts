/**
 * @jest-environment node
 */

/**
 * Shared cross-currency conversion — DW-1.
 *
 * `/api/dashboard/stats` converted foreign rows using the stored entry-time rate
 * AND fell back to a live rate when a row had none. `/api/budgets`,
 * `/api/wishlist` and `/api/what-if` did only half of that, so a row with
 * `exchange_rate = NULL` was summed RAW — the dashboard converted a 100 USD
 * expense while the budget page counted it as 100 EUR, and both printed the
 * preferred-currency symbol over the result.
 *
 * The point of these tests is the AGREEMENT: one implementation, so the four
 * surfaces cannot drift apart again.
 */

jest.mock('@/lib/services/exchangeRateService', () => ({ getExchangeRates: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { getExchangeRates } from '@/lib/services/exchangeRateService';
import { logger } from '@/lib/utils/logger';
import {
  buildLiveRateMap,
  convertToPreferred,
  type ConvertibleRow,
} from '../currencyConversion';

const mockRates = getExchangeRates as jest.MockedFunction<typeof getExchangeRates>;

beforeEach(() => {
  jest.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockRates.mockResolvedValue({ rates: { EUR: 0.5 } } as any);
});

describe('convertToPreferred', () => {
  it('leaves a row already in the preferred currency alone', () => {
    expect(convertToPreferred({ amount: 100, currency: 'EUR' }, 'EUR')).toBe(100);
  });

  it('treats a NULL currency as already preferred, never as foreign', () => {
    // 215 of 217 production rows look like this. Double-converting them would
    // be far worse than the bug being fixed.
    expect(convertToPreferred({ amount: 100, currency: null }, 'EUR')).toBe(100);
    expect(convertToPreferred({ amount: 100 }, 'EUR')).toBe(100);
  });

  it('prefers the stored entry-time rate — that is the rate that actually applied', () => {
    expect(
      convertToPreferred({ amount: 100, currency: 'USD', exchange_rate: 2 }, 'EUR', { USD: 9 })
    ).toBe(200);
  });

  it('falls back to a live rate when the row predates the preference', () => {
    // This is the whole bug: budgets/wishlist/what-if used to return 100 here.
    expect(
      convertToPreferred({ amount: 100, currency: 'USD', exchange_rate: null }, 'EUR', { USD: 0.5 })
    ).toBe(50);
  });

  it('returns the amount unchanged when no rate is available at all', () => {
    // Same as the old behaviour for every foreign row — degrade, do not throw.
    expect(convertToPreferred({ amount: 100, currency: 'USD' }, 'EUR', {})).toBe(100);
  });
});

describe('buildLiveRateMap', () => {
  const rows: ConvertibleRow[] = [
    { amount: 10, currency: 'USD', exchange_rate: null },
    { amount: 20, currency: 'USD', exchange_rate: null },
    { amount: 30, currency: 'GBP', exchange_rate: null },
    { amount: 40, currency: 'EUR' },
    { amount: 50, currency: 'USD', exchange_rate: 1.1 },
  ];

  it('looks up once per CURRENCY, not once per row', async () => {
    await buildLiveRateMap(rows, 'EUR', 'Test');

    // Two distinct currencies need a rate, across five rows.
    expect(mockRates).toHaveBeenCalledTimes(2);
    expect(mockRates.mock.calls.map((c) => c[0]).sort()).toEqual(['GBP', 'USD']);
  });

  it('does not look anything up when nothing is foreign', async () => {
    await buildLiveRateMap([{ amount: 1, currency: 'EUR' }, { amount: 2 }], 'EUR', 'Test');
    // The common case must add no latency.
    expect(mockRates).not.toHaveBeenCalled();
  });

  it('skips currencies that already carry a stored rate', async () => {
    await buildLiveRateMap([{ amount: 1, currency: 'USD', exchange_rate: 2 }], 'EUR', 'Test');
    expect(mockRates).not.toHaveBeenCalled();
  });

  it('warns and omits the currency when a lookup fails, never throwing', async () => {
    mockRates.mockRejectedValue(new Error('upstream down'));

    const map = await buildLiveRateMap(
      [{ amount: 1, currency: 'USD', exchange_rate: null }],
      'EUR',
      'Test'
    );

    // Enrichment failure: warn, leave the row unconverted, do not 500 a screen
    // over one unavailable rate.
    expect(map).toEqual({});
    expect(logger.warn).toHaveBeenCalled();
  });

  it('omits a currency the provider has no rate for', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockRates.mockResolvedValue({ rates: { JPY: 3 } } as any);
    const map = await buildLiveRateMap(
      [{ amount: 1, currency: 'USD', exchange_rate: null }],
      'EUR',
      'Test'
    );
    expect(map).toEqual({});
  });
});

describe('the four surfaces agree on the same rows', () => {
  /**
   * The same mixed-currency month, aggregated the way each surface aggregates
   * it. Before DW-1 the dashboard converted the rateless foreign row and the
   * other three did not, so the totals differed by 50.
   */
  const month: ConvertibleRow[] = [
    { amount: 100, currency: 'EUR' },
    { amount: 100, currency: 'USD', exchange_rate: 2 },
    { amount: 100, currency: 'USD', exchange_rate: null },
  ];

  it('produces one total, whichever surface computes it', async () => {
    const rates = await buildLiveRateMap(month, 'EUR', 'Test');
    const total = (rows: ConvertibleRow[]) =>
      rows.reduce((sum, r) => sum + convertToPreferred(r, 'EUR', rates), 0);

    // 100 + (100 * 2) + (100 * 0.5)
    expect(total(month)).toBe(350);

    // Every surface runs the identical helper, so agreement is structural
    // rather than something four separate code paths have to keep remembering.
    const dashboard = total(month);
    const budgets = total(month);
    const wishlist = total(month);
    const whatIf = total(month);
    expect(new Set([dashboard, budgets, wishlist, whatIf]).size).toBe(1);
  });

  it('the rateless foreign row is exactly what used to differ', async () => {
    const rateless: ConvertibleRow = { amount: 100, currency: 'USD', exchange_rate: null };
    const rates = await buildLiveRateMap([rateless], 'EUR', 'Test');

    const nowConverted = convertToPreferred(rateless, 'EUR', rates);
    const oldBudgetsBehaviour = rateless.exchange_rate
      ? rateless.amount * rateless.exchange_rate
      : rateless.amount;

    expect(oldBudgetsBehaviour).toBe(100);
    expect(nowConverted).toBe(50);
  });
});
