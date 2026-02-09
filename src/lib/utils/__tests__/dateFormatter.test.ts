/**
 * Story 10-1: i18n Framework Setup & Language Switcher
 * Tests for date formatting with locale support
 *
 * AC-10.1.7: Date formatting locale awareness
 */

import { formatDate, formatTransactionDate } from '../dateFormatter';

describe('formatDate', () => {
  const testDate = new Date('2025-03-15T12:00:00Z');

  test('formats with US date format', () => {
    expect(formatDate(testDate, 'MM/DD/YYYY')).toBe('03/15/2025');
  });

  test('formats with European date format', () => {
    expect(formatDate(testDate, 'DD/MM/YYYY')).toBe('15/03/2025');
  });

  test('formats with ISO date format', () => {
    expect(formatDate(testDate, 'YYYY-MM-DD')).toBe('2025-03-15');
  });

  test('formats short date with US format', () => {
    expect(formatDate(testDate, 'MM/DD/YYYY', true)).toBe('Mar 15, 2025');
  });

  test('formats short date with European format', () => {
    expect(formatDate(testDate, 'DD/MM/YYYY', true)).toBe('15 Mar 2025');
  });

  test('returns Invalid date for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('Invalid date');
  });

  test('accepts language parameter without error', () => {
    const result = formatDate(testDate, 'MM/DD/YYYY', false, 'bg');
    expect(result).toBe('03/15/2025');
  });

  test('accepts string date input', () => {
    expect(formatDate('2025-03-15', 'YYYY-MM-DD')).toBe('2025-03-15');
  });
});

describe('formatTransactionDate', () => {
  const testDate = new Date('2025-06-20T12:00:00Z');

  test('formats transaction date with US format', () => {
    expect(formatTransactionDate(testDate, 'MM/DD/YYYY')).toBe('Jun 20, 2025');
  });

  test('formats transaction date with European format', () => {
    expect(formatTransactionDate(testDate, 'DD/MM/YYYY')).toBe('20 Jun 2025');
  });

  test('accepts language parameter', () => {
    const result = formatTransactionDate(testDate, 'MM/DD/YYYY', 'en');
    expect(result).toBe('Jun 20, 2025');
  });
});
