/**
 * Story 10-1: i18n Framework Setup & Language Switcher
 * Story 10-3: Multi-Currency User Settings & Configuration
 * Tests for currency formatting with locale and multi-currency support
 *
 * AC-10.1.8: Number/currency formatting locale awareness
 * AC-10.3.5: Currency symbol displayed correctly
 * AC-10.3.6: Currency formatting respects locale
 * AC-10.3.10: Unit tests for currency formatting
 */

import { formatCurrency, formatCurrencyWithSign, calculateTrend } from '../currency';

describe('formatCurrency', () => {
  describe('default currency (EUR)', () => {
    test('formats positive amount in EUR by default', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('€');
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    test('formats zero in EUR', () => {
      const result = formatCurrency(0);
      expect(result).toContain('€');
      expect(result).toContain('0.00');
    });

    test('formats small amount in EUR', () => {
      const result = formatCurrency(0.99);
      expect(result).toContain('€');
      expect(result).toContain('0.99');
    });

    test('formats large amount in EUR', () => {
      const result = formatCurrency(1000000);
      expect(result).toContain('€');
      expect(result).toContain('1');
      expect(result).toContain('000');
    });
  });

  describe('explicit USD currency', () => {
    test('formats amount in USD', () => {
      expect(formatCurrency(1234.56, undefined, 'USD')).toBe('$1,234.56');
    });

    test('formats zero in USD', () => {
      expect(formatCurrency(0, undefined, 'USD')).toBe('$0.00');
    });

    test('formats with en locale and USD', () => {
      expect(formatCurrency(1234.56, 'en', 'USD')).toBe('$1,234.56');
    });
  });

  describe('explicit EUR currency', () => {
    test('formats amount in EUR with en locale', () => {
      const result = formatCurrency(1234.56, 'en', 'EUR');
      expect(result).toContain('€');
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });

    test('formats amount in EUR with bg locale', () => {
      const result = formatCurrency(1234.56, 'bg', 'EUR');
      expect(result).toBeTruthy();
      expect(result).toContain('€');
      expect(result).toContain('1');
      expect(result).toContain('234');
    });
  });

  describe('locale-aware formatting', () => {
    test('accepts language parameter "en"', () => {
      const result = formatCurrency(1234.56, 'en');
      expect(result).toContain('€');
      expect(result).toContain('1');
    });

    test('formats with Bulgarian locale', () => {
      const result = formatCurrency(1234.56, 'bg');
      expect(result).toBeTruthy();
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    test('falls back to en-US for unknown language', () => {
      const result = formatCurrency(1234.56, 'xx');
      expect(result).toContain('€');
      expect(result).toContain('1');
    });
  });
});

describe('formatCurrencyWithSign', () => {
  describe('default currency (EUR)', () => {
    test('adds + sign for positive amount', () => {
      const result = formatCurrencyWithSign(100);
      expect(result).toMatch(/^\+/);
      expect(result).toContain('€');
      expect(result).toContain('100.00');
    });

    test('adds - sign for negative amount', () => {
      const result = formatCurrencyWithSign(-100);
      expect(result).toMatch(/^-/);
      expect(result).toContain('€');
      expect(result).toContain('100.00');
    });

    test('no sign for zero', () => {
      const result = formatCurrencyWithSign(0);
      expect(result).toContain('€');
      expect(result).toContain('0.00');
      expect(result).not.toMatch(/^[+-]/);
    });

    test('no + sign when showSign is false', () => {
      const result = formatCurrencyWithSign(100, false);
      expect(result).toContain('€');
      expect(result).not.toMatch(/^\+/);
    });
  });

  describe('explicit USD currency', () => {
    test('adds + sign for positive USD amount', () => {
      expect(formatCurrencyWithSign(100, true, undefined, 'USD')).toBe('+$100.00');
    });

    test('adds - sign for negative USD amount', () => {
      expect(formatCurrencyWithSign(-100, true, undefined, 'USD')).toBe('-$100.00');
    });

    test('no sign for zero USD', () => {
      expect(formatCurrencyWithSign(0, true, undefined, 'USD')).toBe('$0.00');
    });

    test('no + sign when showSign is false for USD', () => {
      expect(formatCurrencyWithSign(100, false, undefined, 'USD')).toBe('$100.00');
    });
  });

  describe('with language parameter', () => {
    test('formats with en locale and EUR', () => {
      const result = formatCurrencyWithSign(100, true, 'en', 'EUR');
      expect(result).toMatch(/^\+/);
      expect(result).toContain('€');
    });

    test('formats with bg locale and USD', () => {
      const result = formatCurrencyWithSign(100, true, 'bg', 'USD');
      expect(result).toMatch(/^\+/);
      // Bulgarian locale may display USD as "щ.д." instead of "$"
      expect(result).toContain('100');
    });
  });
});

describe('calculateTrend', () => {
  test('calculates positive trend', () => {
    expect(calculateTrend(150, 100)).toBe(50);
  });

  test('calculates negative trend', () => {
    expect(calculateTrend(50, 100)).toBe(-50);
  });

  test('returns 100 when previous is 0 and current is positive', () => {
    expect(calculateTrend(100, 0)).toBe(100);
  });

  test('returns 0 when both are 0', () => {
    expect(calculateTrend(0, 0)).toBe(0);
  });
});
