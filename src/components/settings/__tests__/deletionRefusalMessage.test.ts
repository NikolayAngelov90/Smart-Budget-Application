/**
 * @jest-environment node
 *
 * spec-account-deletion-refused-message: the deletion dialog's text for a failed
 * deletion, rendered by the REAL ICU engine from BOTH message files.
 *
 * Why a child process: the global next-intl mock substitutes `{k}` naively, so it
 * cannot show that a Bulgarian placeholder actually fills, and use-intl ships ESM
 * only, which Jest on Node 22 cannot require. So the test records which key and
 * values the mapping chose, and plain Node formats them with use-intl's
 * createTranslator - the engine next-intl's useTranslations runs in the app.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import enMessages from '../../../../messages/en.json';
import bgMessages from '../../../../messages/bg.json';
import {
  deletionFailureMessage,
  type SettingsTranslate,
} from '@/components/settings/deletionRefusalMessage';

type Call = [key: string, values: Record<string, string> | undefined];

const ROOT = path.resolve(__dirname, '../../../..');

const RENDER = `
import { createTranslator } from 'use-intl/core';
import { readFileSync } from 'node:fs';
const [locale, file, calls] = [process.argv[1], process.argv[2], JSON.parse(process.argv[3])];
const messages = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];
const t = createTranslator({ locale, messages, namespace: 'settings', onError: (e) => errors.push(String(e)) });
process.stdout.write(JSON.stringify({ texts: calls.map(([key, values]) => t(key, values)), errors }));
`;

function renderWithRealIcu(locale: 'en' | 'bg', calls: Call[]): string[] {
  const out = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      RENDER,
      locale,
      path.join(ROOT, 'messages', `${locale}.json`),
      JSON.stringify(calls),
    ],
    // A hung child must fail the test, not block the worker forever.
    { cwd: ROOT, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const { texts, errors } = JSON.parse(out) as { texts: string[]; errors: string[] };
  // A missing key or a bad ICU message is an error here, not a silently
  // returned key path.
  expect(errors).toEqual([]);
  return texts;
}

const refusal = (outcome: string, names = true) => ({
  error: {
    message: 'Account not deleted',
    code: 'ACCOUNT_NOT_DELETED',
    outcome,
    ...(names ? { household: 'Вкъщи', owner: 'owner@example.test' } : {}),
  },
});

/** The message file's text with the values substituted: what ICU must produce. */
function expected(locale: 'en' | 'bg', key: string): string {
  const settings = (locale === 'en' ? enMessages : bgMessages).settings as Record<
    string,
    string | undefined
  >;
  const text = settings[key];
  if (text === undefined) throw new Error(`settings.${key} missing in ${locale}`);
  return text
    .replace('{household}', 'Вкъщи')
    .replace('{newOwner}', 'owner@example.test')
    .replace('{owner}', 'owner@example.test');
}

type Case = { name: string; status: number; body: unknown } & (
  | { key: string } // a translated text
  | { verbatim: string } // a 4xx route `details`, shown as before
);

const CASES: Case[] = [
  {
    name: 'transferred',
    status: 500,
    body: refusal('transferred'),
    key: 'deletionRefusedTransferred',
  },
  {
    name: 'transferredShared',
    status: 500,
    body: refusal('transferredShared'),
    key: 'deletionRefusedTransferredShared',
  },
  { name: 'shared', status: 500, body: refusal('shared'), key: 'deletionRefusedShared' },
  {
    name: 'unchanged',
    status: 500,
    body: refusal('unchanged', false),
    key: 'deletionRefusedUnchanged',
  },
  {
    name: 'an outcome that needs names, without them',
    status: 500,
    body: refusal('transferred', false),
    key: 'accountDeleteFailed',
  },
  {
    name: 'an unknown outcome',
    status: 500,
    body: refusal('somethingNew'),
    key: 'accountDeleteFailed',
  },
  {
    name: 'no code (any other 500)',
    status: 500,
    body: { error: { message: 'Failed to delete account', details: 'raw server text' } },
    key: 'accountDeleteFailed',
  },
  { name: 'a 5xx body that was not JSON', status: 502, body: null, key: 'accountDeleteFailed' },
  { name: 'a non-object body', status: 500, body: 'oops', key: 'accountDeleteFailed' },
  {
    name: 'a 4xx WITHOUT details (expired session)',
    status: 401,
    body: { error: { message: 'Unauthorized' } },
    key: 'accountDeleteFailed',
  },
  { name: 'a 4xx body that was not JSON', status: 404, body: null, key: 'accountDeleteFailed' },
  {
    name: 'a 4xx with details (wrong password), as before',
    status: 401,
    body: {
      error: { message: 'Invalid password', details: 'The password you entered is incorrect' },
    },
    verbatim: 'The password you entered is incorrect',
  },
];

// Run the mapping once, recording what it asked the translator for. A translated
// result is the index of its recorded call; anything else came from the body.
const calls: Call[] = [];
const recording: SettingsTranslate = (key, values) => {
  calls.push([key, values]);
  return `#${calls.length - 1}`;
};
const results = CASES.map((c) => deletionFailureMessage(recording, c.status, c.body));
const callIndex = (i: number) => Number(results[i]!.slice(1));

describe('deletionFailureMessage chooses the key that is true', () => {
  test.each(CASES.map((c, i) => [c.name, c, i] as const))('%s', (_name, c, i) => {
    if ('verbatim' in c) {
      expect(results[i]).toBe(c.verbatim);
    } else {
      expect(results[i]).toMatch(/^#\d+$/);
      expect(calls[callIndex(i)]![0]).toBe(c.key);
    }
  });
});

describe.each(['en', 'bg'] as const)('rendered by the real ICU engine (%s)', (locale) => {
  let texts: string[];

  beforeAll(() => {
    texts = renderWithRealIcu(locale, calls);
  });

  test.each(CASES.map((c, i) => [c.name, c, i] as const).filter(([, c]) => 'key' in c))(
    '%s: the exact text of its key, values filled in',
    (_name, c, i) => {
      const text = texts[callIndex(i)]!;
      // EXACT: the three named variants share their first sentence, so a prefix
      // check could not tell them apart.
      expect(text).toBe(expected(locale, (c as { key: string }).key));
      expect(text).not.toMatch(/[{}]/);
      expect(text).not.toContain('raw server text');
    }
  );
});
