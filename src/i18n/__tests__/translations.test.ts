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

/**
 * The ICU arguments a message uses, as `name:type` (`type` is `plain` for
 * `{name}`), nested plural/select branches included (spec-account-deletion-refused-message).
 *
 * Key parity alone let a translation drop or rename `{household}` - next-intl then
 * renders the bare placeholder, in one language only - or turn `{count, plural,
 * ...}` into `{count}`, losing its plural forms. `@formatjs/icu-messageformat-parser`
 * is not a direct dependency (it is not hoisted), so this is a small parser for
 * the subset next-intl uses: `{name}`, `{name, type}`, `{name, type, style}`, and
 * plural/selectordinal/select with `selector {message}` options (an `other`
 * option required, as ICU requires it).
 *
 * Apostrophes follow ICU: `''` is a literal quote everywhere, and `'` before `{`
 * or `}` (or `#` in a plural) quotes up to the next lone `'`. A QUOTED PLACEHOLDER
 * (`'{name}'`) throws: ICU renders it as the literal text "{name}", which is never
 * what a message means. Unbalanced braces throw too, so a broken message cannot
 * parse as "no arguments".
 */
function icuArguments(message: string): string[] {
  const args = new Set<string>();
  let i = 0;

  const fail = (why: string): never => {
    throw new Error(`ICU: ${why} at ${i} in ${JSON.stringify(message)}`);
  };
  const skipSpace = () => {
    while (i < message.length && /\s/.test(message[i]!)) i++;
  };
  const readWord = (pattern: RegExp): string => {
    const start = i;
    while (i < message.length && pattern.test(message[i]!)) i++;
    return message.slice(start, i);
  };
  const expectClose = () => {
    if (message[i] !== '}') fail("expected '}'");
    i++;
  };

  // At a quote that opens a quoted literal: skip to its closing lone quote.
  const skipQuoted = (): void => {
    const literal = /^'\{\s*[A-Za-z0-9_]+\s*[,}]/.test(message.slice(i));
    if (literal) fail('quoted placeholder renders literally (use \'\' for an apostrophe)');
    let j = i + 1;
    for (;;) {
      const close = message.indexOf("'", j);
      if (close === -1) {
        i = message.length;
        return;
      }
      if (message[close + 1] === "'") {
        j = close + 2; // '' inside a quoted literal is an apostrophe, not the end
        continue;
      }
      i = close + 1;
      return;
    }
  };

  // Reads text and arguments until an unmatched '}' (left for the caller) or the end.
  const readMessage = (nested: boolean, inPlural: boolean): void => {
    while (i < message.length) {
      const c = message[i]!;
      if (c === "'") {
        const next = message[i + 1];
        if (next === "'") i += 2;
        else if (next === '{' || next === '}' || (inPlural && next === '#')) skipQuoted();
        else i++;
      } else if (c === '{') {
        i++;
        readArgument();
      } else if (c === '}') {
        if (!nested) fail("unmatched '}'");
        return;
      } else {
        i++;
      }
    }
    if (nested) fail("unterminated '{'");
  };

  // At the character after '{'.
  const readArgument = (): void => {
    skipSpace();
    const name = readWord(/[A-Za-z0-9_]/);
    if (!name) fail('argument without a name');
    skipSpace();
    if (message[i] === '}') {
      args.add(`${name}:plain`);
      i++;
      return;
    }
    if (message[i] !== ',') fail("expected ',' or '}'");
    i++;
    skipSpace();
    const type = readWord(/[A-Za-z]/);
    if (!type) fail('argument without a type');
    args.add(`${name}:${type}`);
    skipSpace();
    if (message[i] === '}') {
      i++;
      return;
    }
    if (message[i] !== ',') fail("expected ',' or '}'");
    i++;
    if (type === 'plural' || type === 'selectordinal' || type === 'select') {
      const selectors = new Set<string>();
      for (;;) {
        skipSpace();
        if (message[i] === '}') {
          if (!selectors.has('other')) fail(`${type} without an 'other' option`);
          i++;
          return;
        }
        if (i >= message.length) fail(`unterminated ${type}`);
        const selector = readWord(/[^\s{}]/);
        if (!selector) fail('option without a selector');
        if (selector.startsWith('offset:')) {
          skipSpace();
          if (selector === 'offset:') readWord(/[0-9]/); // "offset: 1"
          continue;
        }
        selectors.add(selector);
        skipSpace();
        if (message[i] !== '{') fail(`expected '{' after selector ${selector}`);
        i++;
        readMessage(true, type !== 'select');
        expectClose();
      }
    }
    // number/date/time style: skip it, balancing braces.
    let depth = 0;
    while (i < message.length && !(message[i] === '}' && depth === 0)) {
      if (message[i] === '{') depth++;
      if (message[i] === '}') depth--;
      i++;
    }
    expectClose();
  };

  readMessage(false, false);
  return [...args].sort();
}

/** Every string leaf, keyed by its dot path. */
function stringLeaves(obj: Record<string, unknown>, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of stringLeaves(value as Record<string, unknown>, path)) out.set(k, v);
    }
  }
  return out;
}

describe('ICU argument parity (en and bg use the same placeholders)', () => {
  const en = stringLeaves(enMessages as Record<string, unknown>);
  const bg = stringLeaves(bgMessages as Record<string, unknown>);

  test('the parser sees arguments and their types, nested ones included', () => {
    // MUST-FIND: a parser that sees nothing would make the parity test pass vacuously.
    expect(icuArguments('Hi {name}')).toEqual(['name:plain']);
    expect(
      icuArguments('{count, plural, one {# item from {who}} other {# items from {who}}}')
    ).toEqual(['count:plural', 'who:plain']);
    expect(icuArguments('{n, plural, offset: 1 =0 {none} other {# more}}')).toEqual([
      'n:plural',
    ]);
    expect(icuArguments('{n, number}')).toEqual(['n:number']);
    expect(icuArguments("It's {a}, isn't it")).toEqual(['a:plain']);
    expect(icuArguments("'{}' and '' and {b}")).toEqual(['b:plain']);
    expect(icuArguments("'{it''s}' then {b}")).toEqual(['b:plain']);
    expect(icuArguments("Category ''{name}'' created")).toEqual(['name:plain']);
    expect(icuArguments('no arguments')).toEqual([]);
  });

  test('the parser rejects what ICU would render wrongly or not at all', () => {
    expect(() => icuArguments('{open')).toThrow(/ICU:/);
    expect(() => icuArguments('close}')).toThrow(/unmatched/);
    expect(() => icuArguments('{c, plural, one {x}')).toThrow(/ICU:/);
    expect(() => icuArguments('{c, plural, one {x}}')).toThrow(/without an 'other'/);
    // The live bug this found (2026-11-20): three category toasts rendered
    // "Category {name} created successfully", braces and all.
    expect(() => icuArguments("Category '{name}' created")).toThrow(/renders literally/);
  });

  test('every message in both files parses', () => {
    const broken: string[] = [];
    for (const [file, leaves] of [
      ['en', en],
      ['bg', bg],
    ] as const) {
      for (const [key, value] of leaves) {
        try {
          icuArguments(value);
        } catch (error) {
          broken.push(`${file}:${key}: ${(error as Error).message}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  test('every key uses the same arguments, with the same types, in en and bg', () => {
    const mismatched: string[] = [];
    let withArguments = 0;
    for (const [key, enValue] of en) {
      const bgValue = bg.get(key);
      if (bgValue === undefined) continue; // key parity is its own test below
      const enArgs = icuArguments(enValue);
      const bgArgs = icuArguments(bgValue);
      if (enArgs.length > 0) withArguments++;
      if (enArgs.join(',') !== bgArgs.join(',')) {
        mismatched.push(`${key}: en {${enArgs.join(', ')}} vs bg {${bgArgs.join(', ')}}`);
      }
    }

    // MUST-FIND, on the real files: the scan read parameterised strings at all
    // (115 before this change, 2026-11-20), plurals among them, and the refusal
    // texts in particular.
    expect(withArguments).toBeGreaterThan(100);
    expect([...en.values()].filter((v) => /, ?plural,/.test(v)).length).toBeGreaterThan(10);
    expect(icuArguments(en.get('settings.deletionRefusedTransferred')!)).toEqual([
      'household:plain',
      'newOwner:plain',
    ]);
    expect(icuArguments(bg.get('settings.deletionRefusedShared')!)).toEqual([
      'household:plain',
      'owner:plain',
    ]);

    expect(mismatched).toEqual([]);
  });
});

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
      'common.appName', // Brand name stays the same
      'settings.languageEnglish', // "English" stays in English
      'settings.languageBulgarian', // "Български" is already Bulgarian
      'common.or', // Short words may coincide
      'common.and',
      'transactions.convertedAmount', // Format pattern: ({amount}) - language-agnostic
      'heatmap.subtitle', // Format pattern: {month} {year} - language-agnostic template
      'projections.trendUp', // Format pattern: +{percentage}% - numeric, language-agnostic
      'projections.trendDown', // Format pattern: -{percentage}% - numeric, language-agnostic
      'invitations.emailPlaceholder', // Email example (name@email.com) - language-agnostic
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
      console.warn(
        'Potentially untranslated keys (bg.json value equals en.json value):',
        untranslatedKeys
      );
    }

    expect(untranslatedKeys).toEqual([]);
  });
});
