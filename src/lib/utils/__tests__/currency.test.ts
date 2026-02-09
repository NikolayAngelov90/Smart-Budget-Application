/**
 * Story 10-1: i18n Framework Setup & Language Switcher
 * Tests for currency formatting with locale support
 *
 * AC-10.1.8: Number/currency formatting locale awareness
 */

import { formatCurrency, formatCurrencyWithSign, calculateTrend } from '../currency';

describe('formatCurrency', () => {
  test('formats positive amount in USD', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  test('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  test('formats small amount', () => {
    expect(formatCurrency(0.99)).toBe('$0.99');
  });

  test('formats large amount', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  test('accepts language parameter "en"', () => {
    expect(formatCurrency(1234.56, 'en')).toBe('$1,234.56');
  });

  test('formats with Bulgarian locale', () => {
    const result = formatCurrency(1234.56, 'bg');
    // Bulgarian uses different grouping/decimal separators
    expect(result).toBeTruthy();
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  test('falls back to en-US for unknown language', () => {
    expect(formatCurrency(1234.56, 'xx')).toBe('$1,234.56');
  });
});

describe('formatCurrencyWithSign', () => {
  test('adds + sign for positive amount', () => {
    expect(formatCurrencyWithSign(100)).toBe('+$100.00');
  });

  test('adds - sign for negative amount', () => {
    expect(formatCurrencyWithSign(-100)).toBe('-$100.00');
  });

  test('no sign for zero', () => {
    expect(formatCurrencyWithSign(0)).toBe('$0.00');
  });

  test('no + sign when showSign is false', () => {
    expect(formatCurrencyWithSign(100, false)).toBe('$100.00');
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
