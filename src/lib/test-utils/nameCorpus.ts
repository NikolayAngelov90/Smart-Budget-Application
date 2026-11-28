/**
 * spec-cyrillic-names: THE ONE LIST of test names. The validator's unit test
 * (src/lib/validation/__tests__/names.test.ts) and the database test
 * (src/lib/test-utils/__tests__/names.rls.test.ts) both run every entry, so
 * the two layers are checked against the same names and cannot drift apart.
 *
 * Invisible characters are written as escapes, never literally: a literal
 * zero-width space in a test file is itself the bug this story removes.
 */

import type { NameProblem } from '@/lib/validation/names';

export interface NameCase {
  label: string;
  /** What the person typed or pasted. */
  raw: string;
  /** The validator: the name it stores (normalised), or why it refuses. */
  app: { name: string } | { problem: NameProblem };
  /**
   * The database (public.is_clean_name) on the RAW string. It enforces only the
   * never-allowed half, so it may accept what the app refuses (an emoji) and
   * refuse the untidy raw form of what the app accepts after normalising.
   */
  dbRaw: boolean;
}

export const NAME_CORPUS: NameCase[] = [
  // Niki's names, and a mixed-script one: accepted unchanged, everywhere.
  { label: 'Храна', raw: 'Храна', app: { name: 'Храна' }, dbRaw: true },
  { label: 'Сметки за ток', raw: 'Сметки за ток', app: { name: 'Сметки за ток' }, dbRaw: true },
  { label: 'Дрехи & обувки', raw: 'Дрехи & обувки', app: { name: 'Дрехи & обувки' }, dbRaw: true },
  { label: 'Кафе (вкъщи)', raw: 'Кафе (вкъщи)', app: { name: 'Кафе (вкъщи)' }, dbRaw: true },
  { label: 'mixed script', raw: 'Café Кафе 2', app: { name: 'Café Кафе 2' }, dbRaw: true },
  { label: 'lower case kept', raw: 'храна', app: { name: 'храна' }, dbRaw: true },
  {
    label: 'three stacked marks',
    raw: 'ж\u0301\u0301\u0301',
    app: { name: 'ж\u0301\u0301\u0301' },
    dbRaw: true,
  },
  {
    label: 'a digit with an enclosing keycap mark',
    raw: '1\u20E3',
    app: { name: '1\u20E3' },
    dbRaw: true,
  },

  // Untidy: the app NORMALISES it; the database refuses the raw form where it is untidy.
  {
    label: 'spaces to trim and collapse',
    raw: '  Храна   за  дома ',
    app: { name: 'Храна за дома' },
    dbRaw: false,
  },
  // Only a doubled space INSIDE: the database's collapse check alone refuses it.
  {
    label: 'a doubled space inside only',
    raw: 'Храна  за дома',
    app: { name: 'Храна за дома' },
    dbRaw: false,
  },
  {
    label: 'a decomposed й (NFD)',
    raw: 'Чай'.normalize('NFD'),
    app: { name: 'Чай' },
    dbRaw: false,
  },
  { label: 'a no-break space inside', raw: 'Хра\u00A0на', app: { name: 'Хра на' }, dbRaw: true },
  {
    label: 'a no-break space at the end',
    raw: 'Храна\u00A0',
    app: { name: 'Храна' },
    dbRaw: false,
  },
  {
    label: 'an ideographic space inside',
    raw: 'Хра\u3000на',
    app: { name: 'Хра на' },
    dbRaw: true,
  },
  { label: 'a typographic apostrophe', raw: 'O\u2019Brien', app: { name: "O'Brien" }, dbRaw: true },
  { label: 'an en dash', raw: 'Храна \u2013 дом', app: { name: 'Храна - дом' }, dbRaw: true },
  { label: 'a tab at the end (trimmed)', raw: 'Храна\t', app: { name: 'Храна' }, dbRaw: false },

  // Never allowed: BOTH refuse.
  {
    label: 'a tab inside (control)',
    raw: 'Хра\tна',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'a bell (control)',
    raw: 'Хра\u0007на',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'a newline (control)',
    raw: 'Хра\nна',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'a zero-width space',
    raw: 'Хра\u200Bна',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'a zero-width joiner',
    raw: 'Хра\u200Dна',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'a byte-order mark inside',
    raw: 'Хра\uFEFFна',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'a right-to-left override',
    raw: 'Хра\u202Eна',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'a soft hyphen',
    raw: 'Хра\u00ADна',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'a line separator',
    raw: 'Хра\u2028на',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  // Default-ignorable but NOT a format character: one is a letter (Lo), one a mark (Mn).
  {
    label: 'a Hangul filler (an invisible letter)',
    raw: 'Хра\u3164на',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'a variation selector',
    raw: 'Хра\uFE0Fна',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  {
    label: 'the keycap emoji (variation selector + keycap)',
    raw: '1\uFE0F\u20E3',
    app: { problem: 'invalidCharacters' },
    dbRaw: false,
  },
  { label: 'empty', raw: '', app: { problem: 'empty' }, dbRaw: false },
  { label: 'only spaces', raw: '   ', app: { problem: 'empty' }, dbRaw: false },
  { label: 'only a no-break space', raw: '\u00A0', app: { problem: 'empty' }, dbRaw: false },

  // Outside the allowed set but not never-allowed: the app refuses, the database allows.
  {
    label: 'an emoji (a later product choice)',
    raw: 'Храна \u{1F355}',
    app: { problem: 'invalidCharacters' },
    dbRaw: true,
  },
  {
    label: 'a sign outside the set',
    raw: 'Храна #1',
    app: { problem: 'invalidCharacters' },
    dbRaw: true,
  },
  { label: 'an underscore', raw: 'Хра_на', app: { problem: 'invalidCharacters' }, dbRaw: true },
  {
    label: 'a mark with nothing under it',
    raw: '\u0301Храна',
    app: { problem: 'invalidCharacters' },
    dbRaw: true,
  },
  {
    label: 'four stacked marks',
    raw: 'ж\u0301\u0301\u0301\u0301',
    app: { problem: 'invalidCharacters' },
    dbRaw: true,
  },
  { label: 'only signs', raw: '- / -', app: { problem: 'needsLetter' }, dbRaw: true },
];
