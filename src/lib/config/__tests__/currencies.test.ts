/**
 * Story 10-3: Multi-Currency User Settings & Configuration
 * Tests for currency configuration module
 *
 * AC-10.3.2: Currency configuration with supported currencies array
 * AC-10.3.3: Initial supported currencies: EUR (default), USD
 */

import {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  getCurrencyConfig,
  getEnabledCurrencies,
  getDefaultCurrencyConfig,
} from '../currencies';

describe('SUPPORTED_CURRENCIES', () => {
  test('contains EUR, USD, and GBP', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(codes).toContain('EUR');
    expect(codes).toContain('USD');
    expect(codes).toContain('GBP');
  });

  test('EUR has correct configuration', () => {
    const eur = SUPPORTED_CURRENCIES.find((c) => c.code === 'EUR');
    expect(eur).toBeDefined();
    expect(eur!.symbol).toBe('€');
    expect(eur!.name).toBe('Euro');
    expect(eur!.enabled).toBe(true);
  });

  test('USD has correct configuration', () => {
    const usd = SUPPORTED_CURRENCIES.find((c) => c.code === 'USD');
    expect(usd).toBeDefined();
    expect(usd!.symbol).toBe('$');
    expect(usd!.name).toBe('US Dollar');
    expect(usd!.enabled).toBe(true);
  });

  test('GBP is disabled (coming soon)', () => {
    const gbp = SUPPORTED_CURRENCIES.find((c) => c.code === 'GBP');
    expect(gbp).toBeDefined();
    expect(gbp!.symbol).toBe('£');
    expect(gbp!.enabled).toBe(false);
  });

  test('each currency has all required fields', () => {
    SUPPORTED_CURRENCIES.forEach((currency) => {
      expect(currency.code).toBeTruthy();
      expect(currency.symbol).toBeTruthy();
      expect(currency.name).toBeTruthy();
      expect(currency.defaultLocale).toBeTruthy();
      expect(typeof currency.enabled).toBe('boolean');
    });
  });
});

describe('DEFAULT_CURRENCY', () => {
  test('is EUR', () => {
    expect(DEFAULT_CURRENCY).toBe('EUR');
  });
});

describe('getCurrencyConfig', () => {
  test('returns EUR config for "EUR"', () => {
    const config = getCurrencyConfig('EUR');
    expect(config).toBeDefined();
    expect(config!.code).toBe('EUR');
    expect(config!.symbol).toBe('€');
  });

  test('returns USD config for "USD"', () => {
    const config = getCurrencyConfig('USD');
    expect(config).toBeDefined();
    expect(config!.code).toBe('USD');
    expect(config!.symbol).toBe('$');
  });

  test('returns undefined for unknown currency code', () => {
    const config = getCurrencyConfig('JPY');
    expect(config).toBeUndefined();
  });
});

describe('getEnabledCurrencies', () => {
  test('returns only enabled currencies', () => {
    const enabled = getEnabledCurrencies();
    expect(enabled.every((c) => c.enabled)).toBe(true);
  });

  test('includes EUR and USD', () => {
    const enabled = getEnabledCurrencies();
    const codes = enabled.map((c) => c.code);
    expect(codes).toContain('EUR');
    expect(codes).toContain('USD');
  });

  test('does not include GBP', () => {
    const enabled = getEnabledCurrencies();
    const codes = enabled.map((c) => c.code);
    expect(codes).not.toContain('GBP');
  });
});

describe('getDefaultCurrencyConfig', () => {
  test('returns EUR configuration', () => {
    const config = getDefaultCurrencyConfig();
    expect(config.code).toBe('EUR');
    expect(config.symbol).toBe('€');
    expect(config.name).toBe('Euro');
  });
});
