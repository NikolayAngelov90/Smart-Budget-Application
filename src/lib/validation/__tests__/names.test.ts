/**
 * spec-cyrillic-names: the ONE definition of a valid name.
 *
 * The shared list (src/lib/test-utils/nameCorpus.ts) is the same list the
 * database test runs, so the two layers are judged on the same names.
 */

import { z } from 'zod';
import { NAME_CORPUS } from '@/lib/test-utils/nameCorpus';
import {
  checkName,
  isNameProblem,
  nameApiMessage,
  nameProblemOf,
  nameSchema,
  normalizeName,
  optionalNameSchema,
  NAME_LIMITS,
  NAME_PATTERN,
  type NameField,
} from '@/lib/validation/names';

const FIELDS = Object.keys(NAME_LIMITS) as NameField[];

describe('names: the shared list, for every field', () => {
  test('CONTROL: the list holds accepted, normalised and refused names of every kind', () => {
    const problems = NAME_CORPUS.flatMap((c) => ('problem' in c.app ? [c.app.problem] : []));
    expect(new Set(problems)).toEqual(new Set(['empty', 'invalidCharacters', 'needsLetter']));
    expect(NAME_CORPUS.some((c) => 'name' in c.app && c.app.name !== c.raw)).toBe(true);
    expect(
      NAME_CORPUS.filter((c) => 'name' in c.app && c.app.name === c.raw).length
    ).toBeGreaterThan(5);
  });

  test.each(NAME_CORPUS.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    for (const field of FIELDS) {
      const result = checkName(c.raw, field);
      const got = result.ok ? { name: result.name } : { problem: result.problem };
      expect({ field, got }).toEqual({ field, got: c.app });
    }
  });
});

describe('names: letters of every script', () => {
  // THE MUST-FIND: letters, marks and digits of many scripts. An ASCII-only class
  // ([a-zA-Z], or \w / \p without the `u` flag) refuses every one of these.
  test.each([
    ['Cyrillic', 'Ёлка Ъгъл'],
    ['Greek', 'Φαγητό'],
    ['Arabic', 'طعام'],
    ['Hebrew', 'אוכל'],
    ['Devanagari, with combining vowel signs', 'खाना'],
    ['Chinese', '食物'],
    ['Japanese', 'たべもの カタカナ'],
    ['Korean', '음식'],
    ['Thai, with combining marks', 'อาหาร'],
    ['Latin with diacritics', 'Ålesund Łódź Ærø'],
    ['non-ASCII digits', 'Бюджет ٣ ५'],
    ['every allowed sign', "O'Brien & Co. - (a, b) / c"],
  ])('%s: accepted', (_script, name) => {
    expect(checkName(name, 'category')).toEqual({ ok: true, name });
    expect(NAME_PATTERN.flags).toContain('u');
  });
});

describe('names: what is refused', () => {
  test.each([
    ['not a string', undefined],
    ['a number', 42],
    ['null', null],
  ])('%s: empty', (_label, raw) => {
    expect(checkName(raw, 'goal')).toMatchObject({ ok: false, problem: 'empty' });
  });

  test('each field keeps its own limit, counted in code points as Postgres counts', () => {
    for (const field of FIELDS) {
      const max = NAME_LIMITS[field];
      expect(checkName('ж'.repeat(max), field)).toMatchObject({ ok: true });
      expect(checkName('ж'.repeat(max + 1), field)).toEqual({
        ok: false,
        name: 'ж'.repeat(max + 1),
        problem: 'tooLong',
        max,
      });
      // Two UTF-16 units per letter: .length would say 2 * max.
      const wide = '\u{20000}'.repeat(max);
      expect(wide.length).toBe(2 * max);
      expect(checkName(wide, field)).toMatchObject({ ok: true });
    }
    // A decomposed letter is one character once normalised, as stored.
    expect(checkName('й'.normalize('NFD').repeat(100), 'category')).toMatchObject({ ok: true });
    expect(NAME_LIMITS).toEqual({
      category: 100,
      goal: 200,
      sharedGoal: 100,
      household: 100,
      wishlistItem: 100,
      value: 50,
      displayName: 100,
    });
  });

  test('a name too long is reported as too long even when it also holds a bad character', () => {
    expect(checkName(`${'ж'.repeat(60)}\u200B`, 'value')).toMatchObject({ problem: 'tooLong' });
  });
});

describe('names: normalisation', () => {
  test('trimmed, and internal runs of spaces collapsed', () => {
    expect(normalizeName('  Храна   за  дома ')).toBe('Храна за дома');
  });

  test('NFC: "й" typed two ways is ONE name', () => {
    const decomposed = 'Чай'.normalize('NFD');
    expect(decomposed).not.toBe('Чай'); // CONTROL: the inputs really differ
    expect(decomposed.length).toBe(4);
    expect(checkName(decomposed, 'category')).toEqual({ ok: true, name: 'Чай' });
    expect(checkName('Чай', 'category')).toEqual({ ok: true, name: 'Чай' });
  });

  test('every space separator becomes a plain space; autocorrect punctuation becomes the allowed sign', () => {
    expect(normalizeName('а\u00A0б\u2009в\u202Fг\u3000д')).toBe('а б в г д');
    expect(normalizeName('\u2018а\u2019 \u02BCб')).toBe("'а' 'б");
    expect(normalizeName('а\u2010б\u2011в\u2012г\u2013д\u2014е\u2015ж\u2212з')).toBe(
      'а-б-в-г-д-е-ж-з'
    );
  });

  test('case is NOT folded: "Храна" and "храна" stay two names', () => {
    expect(checkName('храна', 'category')).toEqual({ ok: true, name: 'храна' });
    expect(checkName('Храна', 'category')).toEqual({ ok: true, name: 'Храна' });
  });
});

describe('nameSchema and optionalNameSchema (the zod forms of the same rule)', () => {
  test('parses to the normalised name', () => {
    expect(nameSchema('household').parse('  Вкъщи  нова ')).toBe('Вкъщи нова');
  });

  test.each([
    ['', 'empty'],
    ['Хра\u200Bна', 'invalidCharacters'],
    ['ж'.repeat(51), 'tooLong'],
    ['- -', 'needsLetter'],
  ])('%j fails with the problem code as its message', (raw, problem) => {
    const result = nameSchema('value').safeParse(raw);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual([problem]);
  });

  test('the optional form: empty (after normalising) is allowed, anything else follows the rule', () => {
    const schema = optionalNameSchema('displayName');
    expect(schema.parse('  ')).toBe('');
    expect(schema.parse('\u00A0')).toBe('');
    expect(schema.parse(' Иван  Петров ')).toBe('Иван Петров');
    expect(schema.safeParse('Иван\u200B').error?.issues.map((i) => i.message)).toEqual([
      'invalidCharacters',
    ]);
  });
});

describe('the problem code, for an API response', () => {
  test('nameProblemOf finds the NAME field problem, and nothing else', () => {
    const schema = z.object({ name: nameSchema('category'), color: z.string().min(1) });
    const nameBad = schema.safeParse({ name: 'Хра\u200Bна', color: '#fff' });
    expect(nameBad.success || nameProblemOf(nameBad.error)).toBe('invalidCharacters');
    const colorBad = schema.safeParse({ name: 'Храна', color: '' });
    expect(colorBad.success || nameProblemOf(colorBad.error)).toBeUndefined();
  });

  test('isNameProblem accepts the four codes only', () => {
    expect(['empty', 'tooLong', 'invalidCharacters', 'needsLetter'].every(isNameProblem)).toBe(
      true
    );
    expect(['Required', 'name', '', undefined].some(isNameProblem)).toBe(false);
  });

  test('nameApiMessage says what is wrong, per problem', () => {
    expect(nameApiMessage('Goal', 'empty', 200)).toBe('Goal name is required');
    expect(nameApiMessage('Goal', 'tooLong', 200)).toBe(
      'Goal name must be 200 characters or fewer'
    );
    expect(nameApiMessage('Goal', 'needsLetter', 200)).toBe(
      'Goal name needs at least one letter or digit'
    );
    expect(nameApiMessage('Goal', 'invalidCharacters', 200)).toBe(
      'Goal name contains characters that are not allowed'
    );
  });
});
