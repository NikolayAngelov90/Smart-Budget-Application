/**
 * @jest-environment node
 */

/**
 * THE PREFLIGHT'S OWN GUARD.
 *
 * `npm run test:rls` without credentials used to exit 0 with every isolation
 * suite skipped, because `rlsDescribe` degrades to `describe.skip`. A pass and a
 * run that proved nothing were the same signal. The preflight exists to make
 * those two outcomes distinguishable, and this file exists because a guard with
 * no recorded red state is not evidence.
 *
 * IT IS TESTED BY SPAWNING THE REAL SCRIPT. The alternative — importing and
 * unit-testing a helper — would leave the thing `npm run test:rls` actually
 * invokes untested, and the exit code is the entire contract.
 *
 * The environment is CONSTRUCTED, never inherited: a machine that happens to
 * have RLS_TEST_* exported would otherwise turn the negative cases green.
 *
 * MUTATION RECORD — each applied, run, observed RED, reverted:
 *   1. `hostname === allowed` -> `hostname.includes(allowed)`
 *      -> "rejects a host that merely CONTAINS an allowlisted name" FAILS:
 *         127.0.0.1.evil.com and localhost.attacker.net both exit 0.
 *   2. drop the `missing.length > 0` block
 *      -> 4 FAIL: the three "names the missing variable" cases and the one
 *         asserting the message explains the silent-skip consequence.
 *   3. `new URL(rawUrl).hostname` wrapped so a throw yields LOCAL_HOSTS[0]
 *      -> "an unparseable URL fails rather than skipping the check" FAILS.
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts', 'rls-preflight.mjs');

const LOCAL_URL = 'http://127.0.0.1:54321';

/** Run the preflight with an env built from scratch. Never throws. */
function run(vars: Record<string, string>): { code: number; out: string } {
  // Strip any RLS_TEST_* the host machine or CI has exported, then add only what
  // the case under test wants. Inheriting them would make every negative case
  // pass for the wrong reason — on the CI job where they ARE set, no less.
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('RLS_TEST_')) delete env[key];
  }
  Object.assign(env, vars);

  try {
    const out = execFileSync('node', [SCRIPT], { encoding: 'utf8', env: env as NodeJS.ProcessEnv });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status: number; stdout?: string; stderr?: string };
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const ALL = {
  RLS_TEST_SUPABASE_URL: LOCAL_URL,
  RLS_TEST_SUPABASE_ANON_KEY: 'anon',
  RLS_TEST_SUPABASE_SERVICE_KEY: 'svc',
};

describe('rls preflight — credentials', () => {
  it('passes when all three are set and the host is local', () => {
    // The non-vacuity half. Without this, every assertion below is satisfied by
    // a script that fails unconditionally.
    const { code, out } = run(ALL);
    expect(code).toBe(0);
    expect(out).toContain('3/3 credentials set');
  });

  it.each([
    'RLS_TEST_SUPABASE_URL',
    'RLS_TEST_SUPABASE_ANON_KEY',
    'RLS_TEST_SUPABASE_SERVICE_KEY',
  ])('fails and NAMES %s when it is the one missing', (name) => {
    // Naming the variable is the point. "RLS_TEST_* credentials are empty" — the
    // message the CI copy of this check used to print — sends someone hunting
    // through three names, and the CI copy did not check the host at all.
    const vars: Record<string, string> = { ...ALL };
    delete vars[name];

    const { code, out } = run(vars);

    expect(code).toBe(1);
    expect(out).toContain(`MISSING  ${name}`);
    // The remedy, not just the diagnosis.
    expect(out).toContain('npx supabase start');
  });

  it('explains that a missing credential would otherwise SKIP, not fail', () => {
    // The reason this guard exists at all, kept in the output so whoever hits it
    // learns why a green run would have been worthless.
    const { out } = run({ RLS_TEST_SUPABASE_ANON_KEY: 'anon' });
    expect(out).toContain('describe.skip');
  });
});

describe('rls preflight — the host must be local', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321'])(
    'accepts %s',
    (url) => {
      // All three spellings, including the bracketed IPv6 form that
      // `new URL(...).hostname` returns — the allowlist has to match the
      // parser's spelling, not the one a human would type.
      expect(run({ ...ALL, RLS_TEST_SUPABASE_URL: url }).code).toBe(0);
    }
  );

  it('refuses a remote project, naming the host and the allowlist', () => {
    // THE CASE THAT MATTERS. These suites provision real auth users, seed rows
    // and cascade deletes on teardown. Pointed at production they are
    // destructive, so this is refused rather than warned about.
    const { code, out } = run({
      ...ALL,
      RLS_TEST_SUPABASE_URL: 'https://rlcgqvqpuqkkxtczalpi.supabase.co',
    });

    expect(code).toBe(1);
    expect(out).toContain('does not point at a local stack');
    expect(out).toContain('rlcgqvqpuqkkxtczalpi.supabase.co');
    expect(out).toContain('127.0.0.1, localhost, [::1]');
  });

  it.each(['http://127.0.0.1.evil.com:54321', 'http://localhost.attacker.net'])(
    'rejects %s — a host that merely CONTAINS an allowlisted name',
    (url) => {
      // THE COMPARISON IS THE GUARD. Both of these contain an allowlisted string
      // and resolve off-box. Replacing `hostname === allowed` with
      // `hostname.includes(allowed)` makes both exit 0, which is why the
      // comparison is exact and why this test is here rather than a comment.
      expect(run({ ...ALL, RLS_TEST_SUPABASE_URL: url }).code).toBe(1);
    }
  );

  it('fails on an unparseable URL rather than skipping the host check', () => {
    // A host check that cannot run is not a host check. The alternative — catch
    // and continue — is the exact shape of the defects this repository keeps
    // finding: a guard that silently does not apply.
    const { code, out } = run({ ...ALL, RLS_TEST_SUPABASE_URL: 'not-a-url' });

    expect(code).toBe(1);
    expect(out).toContain('not a parseable URL');
  });
});
