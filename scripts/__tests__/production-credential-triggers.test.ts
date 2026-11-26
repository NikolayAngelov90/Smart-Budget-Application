/**
 * @jest-environment node
 *
 * A workflow that holds the production database credential runs ONLY on
 * triggers whose workflow definition has already been reviewed and merged.
 *
 * WHY. For a same-repo branch, `pull_request` (and its relatives
 * `pull_request_target`, `pull_request_review`, `pull_request_review_comment`)
 * run with the repository's secrets, and the PR events run the workflow
 * definition FROM THE BRANCH: a branch could edit the file to print the secret.
 * .github/workflows/schema-drift.yml explains this and restricts itself to
 * push-to-main, schedule and dispatch. With a SECOND workflow using the same
 * credential (account-notice-health.yml, 2026-11-25), that restriction became a
 * rule held in two places; this test is the mechanism.
 *
 * AN ALLOWLIST, not a denylist (review 2026-11-26): `schedule`,
 * `workflow_dispatch`, and `push` restricted to `branches: [main]`. Anything
 * else - including PR relatives a denylist would have to remember - fails. And
 * the parser FAILS CLOSED: a shape it cannot read throws, it never returns
 * "nothing found".
 *
 * NOT covered here, and cannot be by a test: a collaborator dispatching a
 * branch's modified copy (workflow_dispatch on a branch ref) or pushing a new
 * workflow on a branch. Repository secrets reach those too; only a GitHub
 * Environment restricted to main would close that (a settings change, on the
 * board for Niki).
 *
 * It finds the workflows by the secret itself, not by a list of file names, so
 * a third user of the secret is covered the day it is added.
 */

export {};

const fs = jest.requireActual('fs') as typeof import('fs');
const path = jest.requireActual('path') as typeof import('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const SECRET = 'secrets.SCHEMA_READER_PASSWORD';

type Trigger = { name: string; body: string[] };

/**
 * The triggers of a workflow's top-level `on:` with each one's indented body,
 * in the shapes GitHub accepts: `on: push`, `on: [push, schedule]`, and the
 * block form (keys or a list, two-space indented, keys optionally quoted).
 * THROWS on anything else - no `on:` at all, a flow map, a line it cannot read -
 * so "found nothing" can never stand in for "found nothing forbidden".
 */
function triggersOf(yaml: string): Trigger[] {
  const lines = yaml.split(/\r?\n/);
  const at = lines.findIndex((l) => /^(on|"on"|'on')\s*:/.test(l));
  if (at < 0) throw new Error('no top-level `on:`');
  const inline = lines[at]!.replace(/^(on|"on"|'on')\s*:/, '')
    .replace(/#.*$/, '')
    .trim();
  if (inline) {
    if (inline.startsWith('{')) throw new Error('unsupported `on:` shape (a flow map)');
    return inline
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
      .map((name) => ({ name, body: [] }));
  }
  const found: Trigger[] = [];
  for (const line of lines.slice(at + 1)) {
    if (/^\S/.test(line)) break; // the next top-level key ends the block
    if (/^\s*(#.*)?$/.test(line)) continue; // blank or comment
    const key = /^ {2}(['"]?)([A-Za-z_]+)\1\s*:/.exec(line);
    const item = /^ {2}-\s*(['"]?)([A-Za-z_]+)\1\s*$/.exec(line);
    if (key) found.push({ name: key[2]!, body: [] });
    else if (item) found.push({ name: item[2]!, body: [] });
    else if (/^ {3,}\S/.test(line) && found.length > 0) found.at(-1)!.body.push(line.trim());
    else throw new Error(`unreadable line in \`on:\`: ${line.trim()}`);
  }
  return found;
}

/** Every trigger outside the allowlist, by name. */
function violations(triggers: Trigger[]): string[] {
  return triggers.flatMap((t) => {
    if (t.name === 'schedule' || t.name === 'workflow_dispatch') return [];
    if (t.name === 'push') {
      const rules = t.body.filter((l) => !l.startsWith('#'));
      return rules.length === 1 && rules[0] === 'branches: [main]'
        ? []
        : ['push (not restricted to main)'];
    }
    return [t.name];
  });
}

const users = fs
  .readdirSync(WORKFLOWS)
  .filter((f) => /\.ya?ml$/.test(f))
  .filter((f) => fs.readFileSync(path.join(WORKFLOWS, f), 'utf8').includes(SECRET))
  .sort();

describe('workflows that hold the production database credential', () => {
  it('MUST-FIND: the known users of the secret are found by the secret itself', () => {
    expect(users).toEqual(
      expect.arrayContaining(['account-notice-health.yml', 'schema-drift.yml'])
    );
  });

  it.each(users)('%s runs only on the allowlisted triggers', (file) => {
    const triggers = triggersOf(fs.readFileSync(path.join(WORKFLOWS, file), 'utf8'));
    // MUST-FIND: the parser really read this file's `on:` (each is scheduled).
    expect(triggers.map((t) => t.name)).toContain('schedule');
    expect(violations(triggers)).toEqual([]);
  });

  // The other direction: every shape of a trigger outside the allowlist is SEEN.
  it.each([
    ['inline', 'on: pull_request\njobs: {}', ['pull_request']],
    ['inline list', 'on: [schedule, pull_request]\njobs: {}', ['pull_request']],
    [
      'block keys',
      "on:\n  schedule:\n    - cron: '0 6 * * *'\n  pull_request:\n    branches: [main]\njobs: {}",
      ['pull_request'],
    ],
    ['block list', 'on:\n  - schedule\n  - pull_request_target\njobs: {}', ['pull_request_target']],
    ['quoted key', 'on:\n  "pull_request":\njobs: {}', ['pull_request']],
    ['quoted on', '"on":\n  pull_request:\njobs: {}', ['pull_request']],
    ['a PR relative', 'on:\n  pull_request_review:\njobs: {}', ['pull_request_review']],
    [
      'another PR relative',
      'on: [pull_request_review_comment]\njobs: {}',
      ['pull_request_review_comment'],
    ],
    ['push, every branch', 'on: push\njobs: {}', ['push (not restricted to main)']],
    [
      'push, a wider filter',
      "on:\n  push:\n    branches: ['**']\njobs: {}",
      ['push (not restricted to main)'],
    ],
    ['an unknown event', 'on:\n  workflow_run:\n    workflows: [x]\njobs: {}', ['workflow_run']],
  ])('a trigger outside the allowlist is seen (%s)', (_shape, yaml, expected) => {
    expect(violations(triggersOf(yaml))).toEqual(expected);
  });

  it('push restricted to main, schedule and dispatch are allowed', () => {
    const yaml =
      "on:\n  schedule:\n    # nightly\n    - cron: '0 6 * * *'\n  push:\n    branches: [main]\n  workflow_dispatch:\njobs: {}";
    expect(violations(triggersOf(yaml))).toEqual([]);
  });

  it('the parser fails CLOSED: no `on:`, a flow map, or an unreadable line throws', () => {
    expect(() => triggersOf('name: x\njobs: {}')).toThrow('no top-level `on:`');
    expect(() => triggersOf('on: {pull_request: {}}\njobs: {}')).toThrow('flow map');
    expect(() => triggersOf('on:\n pull_request:\njobs: {}')).toThrow('unreadable line');
    // ...and it reads only the `on:` block.
    expect(triggersOf('on:\n  schedule:\njobs:\n  pull_request:\n').map((t) => t.name)).toEqual([
      'schedule',
    ]);
  });
});
