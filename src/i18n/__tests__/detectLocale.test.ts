/**
 * Story 10-1: i18n Framework Setup & Language Switcher
 * Tests for detectLocale utility
 *
 * AC-10.1.6: Browser Language Detection
 */

import { detectAndSetLocale } from '../detectLocale';

describe('detectAndSetLocale', () => {
  let originalCookie: string;

  beforeEach(() => {
    originalCookie = document.cookie;
    // Clear cookies
    document.cookie = 'NEXT_LOCALE=;path=/;max-age=0';
  });

  afterEach(() => {
    // Restore
    document.cookie = originalCookie || 'NEXT_LOCALE=;path=/;max-age=0';
  });

  test('returns existing cookie value if NEXT_LOCALE is set to "en"', () => {
    document.cookie = 'NEXT_LOCALE=en;path=/';
    const result = detectAndSetLocale();
    expect(result).toBe('en');
  });

  test('returns existing cookie value if NEXT_LOCALE is set to "bg"', () => {
    document.cookie = 'NEXT_LOCALE=bg;path=/';
    const result = detectAndSetLocale();
    expect(result).toBe('bg');
  });

  test('detects Bulgarian browser language and sets cookie', () => {
    document.cookie = 'NEXT_LOCALE=;path=/;max-age=0';
    Object.defineProperty(navigator, 'language', {
      value: 'bg-BG',
      configurable: true,
    });

    const result = detectAndSetLocale();
    expect(result).toBe('bg');
    expect(document.cookie).toContain('NEXT_LOCALE=bg');
  });

  test('defaults to "en" for unsupported browser language', () => {
    document.cookie = 'NEXT_LOCALE=;path=/;max-age=0';
    Object.defineProperty(navigator, 'language', {
      value: 'fr-FR',
      configurable: true,
    });

    const result = detectAndSetLocale();
    expect(result).toBe('en');
    expect(document.cookie).toContain('NEXT_LOCALE=en');
  });

  test('detects English browser language', () => {
    document.cookie = 'NEXT_LOCALE=;path=/;max-age=0';
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });

    const result = detectAndSetLocale();
    expect(result).toBe('en');
  });
});
