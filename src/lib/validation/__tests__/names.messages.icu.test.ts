/**
 * @jest-environment node
 *
 * spec-cyrillic-names: the name messages, rendered by the REAL ICU engine from
 * both message files. The invalid-characters text lists the allowed signs,
 * including an apostrophe - which ICU treats as a quote character in some
 * positions - so it is rendered here, not assumed.
 *
 * A child process, as in noticeTexts.icu.test.ts: use-intl ships ESM only.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');

const RENDER = `
import { createTranslator } from 'use-intl/core';
import { readFileSync } from 'node:fs';
const [locale, file] = [process.argv[1], process.argv[2]];
const messages = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];
const onError = (e) => errors.push(String(e));
const t = createTranslator({ locale, messages, namespace: 'names', onError });
const goals = createTranslator({ locale, messages, namespace: 'householdGoals', onError });
process.stdout.write(JSON.stringify({
  texts: [t('empty'), t('tooLong', { max: 100 }), t('invalidCharacters'), t('needsLetter'), goals('invalidTarget')],
  errors,
}));
`;

function render(locale: 'en' | 'bg'): { texts: string[]; errors: string[] } {
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', RENDER, locale, path.join(ROOT, 'messages', `${locale}.json`)],
    { cwd: ROOT, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return JSON.parse(out);
}

describe.each([
  [
    'en',
    [
      'Enter a name.',
      'Use at most 100 characters.',
      "Use only letters, digits, spaces and these signs: & - ' . , ( ) /",
      'Include at least one letter or digit.',
      'Enter a target amount greater than 0.',
    ],
  ],
  [
    'bg',
    [
      'Въведете име.',
      'Използвайте най-много 100 знака.',
      "Използвайте само букви, цифри, интервали и тези знаци: & - ' . , ( ) /",
      'Включете поне една буква или цифра.',
      'Въведете целева сума, по-голяма от 0.',
    ],
  ],
] as const)('name messages under real ICU (%s)', (locale, expected) => {
  test('render exactly, every sign shown and the limit filled', () => {
    const { texts, errors } = render(locale);
    expect(errors).toEqual([]);
    expect(texts).toEqual(expected);
  });
});
