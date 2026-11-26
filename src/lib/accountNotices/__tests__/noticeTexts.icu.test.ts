/**
 * @jest-environment node
 *
 * spec-account-deletion-notifications: every account-notice text, rendered by
 * the REAL ICU engine from BOTH message files, exactly as the card and the push
 * show it.
 *
 * Why a child process: use-intl ships ESM only, which Jest on Node 22 cannot
 * require, and the global next-intl mock substitutes `{k}` naively (no plurals).
 * The mapping (noticeMessage) runs here in Jest; plain Node formats its keys and
 * values with use-intl's createTranslator, the engine next-intl runs.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import enMessages from '../../../../messages/en.json';
import bgMessages from '../../../../messages/bg.json';
import {
  noticeMessage,
  type AccountNotice,
  type AccountNoticeKind,
} from '@/lib/accountNotices/noticeMessage';

const ROOT = path.resolve(__dirname, '../../../..');
type Call = [key: string, values: Record<string, string | number>];

const RENDER = `
import { createTranslator } from 'use-intl/core';
import { readFileSync } from 'node:fs';
const [locale, file, calls] = [process.argv[1], process.argv[2], JSON.parse(process.argv[3])];
const messages = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];
const t = createTranslator({ locale, messages, namespace: 'accountNotices', onError: (e) => errors.push(String(e)) });
process.stdout.write(JSON.stringify({ texts: calls.map(([key, values]) => t(key, values)), errors }));
`;

function render(locale: 'en' | 'bg', calls: Call[]): string[] {
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
    { cwd: ROOT, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const { texts, errors } = JSON.parse(out) as { texts: string[]; errors: string[] };
  expect(errors).toEqual([]); // a missing key or bad ICU is an error, not a key path
  return texts;
}

const notice = (
  kind: AccountNoticeKind,
  params: Record<string, unknown>,
  cause: AccountNotice['cause'] = 'account_deleted'
): AccountNotice => ({
  id: kind,
  kind,
  cause,
  household_id: 'h',
  params,
  created_at: '2026-11-25T10:00:00Z',
});

const CASES = [
  notice('household_transferred', { household: 'Вкъщи', seniority: true }),
  notice('household_transferred', { household: 'Вкъщи', seniority: false }),
  notice('household_transferred', { household: 'Вкъщи' }, 'deletion_refused'),
  notice('categories_copied', { categories: ['Храна', 'Сметки'], shared_household: true }),
  notice('categories_copied', { categories: ['Храна', 'Сметки'], shared_household: false }),
  notice('category_renamed', { household: 'Вкъщи', from: 'Храна', to: 'Храна 2' }),
  notice('shared_plans_received', { household: 'Вкъщи', goals: 1, budgets: 1 }),
  notice('shared_plans_received', { household: 'Вкъщи', goals: 0, budgets: 2 }, 'member_removed'),
];

describe.each(['en', 'bg'] as const)('account-notice texts under real ICU (%s)', (locale) => {
  const file = (locale === 'en' ? enMessages : bgMessages).accountNotices as Record<string, string>;
  /** The message file's text with the values substituted: what ICU must produce. */
  const expected = (key: string, values: Record<string, string>) =>
    Object.entries(values).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), file[key]!);

  test.each(CASES.map((c, i) => [`${i}: ${c.kind}/${c.cause}`, c] as const))(
    '%s: title and body are the file text with every value filled',
    (_name, c) => {
      const message = noticeMessage(c, locale)!;
      expect(message).not.toBeNull();
      const [title, body] = render(locale, [
        [message.titleKey, message.values],
        [message.bodyKey, message.values],
      ]);
      expect(title).toBe(expected(message.titleKey, message.values));
      expect(body).toBe(expected(message.bodyKey, message.values));
      expect(`${title} ${body}`).not.toMatch(/[{}]/);
      // Every value reaches the reader. The file-derived expectation above cannot
      // see a placeholder DROPPED from the file (both sides lose it together).
      for (const value of Object.values(message.values)) {
        expect(`${title} ${body}`).toContain(value);
      }
    }
  );

  test('the list of copied categories reads naturally in this language', () => {
    const message = noticeMessage(CASES.find((c) => c.kind === 'categories_copied')!, locale)!;
    const [body] = render(locale, [[message.bodyKey, message.values]]);
    expect(body).toContain(locale === 'en' ? 'Храна and Сметки' : 'Храна и Сметки');
  });

  test('"N more" pluralises', () => {
    const [one, two, five] = render(locale, [
      ['more', { count: 1 }],
      ['more', { count: 2 }],
      ['more', { count: 5 }],
    ]);
    expect([one, two, five]).toEqual(
      locale === 'en'
        ? ['1 more notice', '2 more notices', '5 more notices']
        : ['Още 1 известие', 'Още 2 известия', 'Още 5 известия']
    );
  });
});
