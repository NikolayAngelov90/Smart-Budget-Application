/**
 * Story 10-1 & 10-2: i18n Framework Setup & Bulgarian Translations
 * Tests for translation file structure and completeness
 *
 * AC-10.1.2: Translation file structure
 * AC-10.1.9: Translation key consistency
 * AC-10.2.2: All bg.json values translated to Bulgarian
 */

import enMessages from '../../../messages/en.json';
import bgMessages from '../../../messages/bg.json';

/**
 * Recursively extract all keys from a nested object, returning dot-notation paths
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe('Translation files', () => {
  const enKeys = extractKeys(enMessages as Record<string, unknown>);
  const bgKeys = extractKeys(bgMessages as Record<string, unknown>);

  test('en.json has translation keys', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  test('bg.json has translation keys', () => {
    expect(bgKeys.length).toBeGreaterThan(0);
  });

  test('en.json and bg.json have the same keys', () => {
    const enSet = new Set(enKeys);
    const bgSet = new Set(bgKeys);

    const missingInBg = enKeys.filter((key) => !bgSet.has(key));
    const missingInEn = bgKeys.filter((key) => !enSet.has(key));

    if (missingInBg.length > 0) {
      console.warn('Keys in en.json missing from bg.json:', missingInBg);
    }
    if (missingInEn.length > 0) {
      console.warn('Keys in bg.json missing from en.json:', missingInEn);
    }

    expect(missingInBg).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  test('en.json contains expected top-level namespaces', () => {
    const expectedNamespaces = [
      'common',
      'navigation',
      'dashboard',
      'transactions',
      'categories',
      'insights',
      'settings',
      'onboarding',
      'validation',
      'toast',
      'sync',
      'offline',
      'devices',
      'profile',
      'header',
    ];

    for (const ns of expectedNamespaces) {
      expect(enMessages).toHaveProperty(ns);
    }
  });

  test('no empty string values in en.json', () => {
    const emptyKeys = enKeys.filter((key) => {
      const parts = key.split('.');
      let value: unknown = enMessages;
      for (const part of parts) {
        value = (value as Record<string, unknown>)[part];
      }
      return value === '';
    });

    expect(emptyKeys).toEqual([]);
  });

  test('no empty string values in bg.json', () => {
    const emptyKeys = bgKeys.filter((key) => {
      const parts = key.split('.');
      let value: unknown = bgMessages;
      for (const part of parts) {
        value = (value as Record<string, unknown>)[part];
      }
      return value === '';
    });

    expect(emptyKeys).toEqual([]);
  });

  test('bg.json values are actually translated (not identical to en.json)', () => {
    // Keys that are intentionally the same in both languages (proper nouns, abbreviations, etc.)
    const allowlist = new Set([
      'common.appName',             // Brand name stays the same
      'settings.languageEnglish',   // "English" stays in English
      'settings.languageBulgarian', // "Български" is already Bulgarian
      'common.or',                  // Short words may coincide
      'common.and',
    ]);

    const untranslatedKeys = enKeys.filter((key) => {
      if (allowlist.has(key)) return false;

      const parts = key.split('.');
      let enValue: unknown = enMessages;
      let bgValue: unknown = bgMessages;
      for (const part of parts) {
        enValue = (enValue as Record<string, unknown>)?.[part];
        bgValue = (bgValue as Record<string, unknown>)?.[part];
      }

      // Only flag string values that are exactly the same
      return typeof enValue === 'string' && typeof bgValue === 'string' && enValue === bgValue;
    });

    if (untranslatedKeys.length > 0) {
      console.warn('Potentially untranslated keys (bg.json value equals en.json value):', untranslatedKeys);
    }

    expect(untranslatedKeys).toEqual([]);
  });
});
