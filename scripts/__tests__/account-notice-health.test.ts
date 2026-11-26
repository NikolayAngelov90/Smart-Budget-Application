/**
 * @jest-environment node
 *
 * The nightly account-notice health check (scripts/account-notice-health/check.sh,
 * run by .github/workflows/account-notice-health.yml) is the place a CONTAINED
 * notice failure becomes visible. Its exit code is the whole signal, so each one
 * is pinned here, against the real script with a stub `psql` on PATH:
 *   0 = no unacknowledged failure, 1 = some (listed), 2 = the log could not be
 *   read - which must never pass as "none".
 * And the two contracts with the workflow that a typo would break silently:
 *   - the step pipes the script into `tee`, so it needs `set -o pipefail` (GitHub's
 *     default `bash -e` has no pipefail: without it the step returns tee's 0 and
 *     the check passes forever);
 *   - the watchdog's signature greps the script's `  FAILED ` lines and its
 *     `ok: no unacknowledged` line, so the script must print exactly those.
 */

export {};

const fs = jest.requireActual('fs') as typeof import('fs');
const os = jest.requireActual('os') as typeof import('os');
const path = jest.requireActual('path') as typeof import('path');
const { spawnSync } = jest.requireActual('child_process') as typeof import('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = 'scripts/account-notice-health/check.sh';
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'account-notice-health.yml');
// On Windows a bare `bash` can be WSL's; the script is meant for Git Bash or Linux.
const BASH = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

const STUB = `#!/usr/bin/env bash
# A stand-in psql. It insists on being asked for the summary, so a script that
# queried anything else would fail (exit 3 -> the script's exit 2).
case "$*" in *public.account_notice_failure_summary*) ;; *) echo "wrong query" >&2; exit 3;; esac
case "$STUB_PSQL_MODE" in
  rows)
    printf '%s\\n' 'publish|household_transferred|23514|2|2026-11-25 06:00|2026-11-26 07:30' \\
                   'stage|categories_copied|42883|1|2026-11-26 01:00|2026-11-26 01:00' ;;
  empty) ;;
  denied) echo 'ERROR:  permission denied for function account_notice_failure_summary' >&2; exit 1 ;;
  down) echo 'psql: error: connection to server failed' >&2; exit 2 ;;
  *) echo "unknown STUB_PSQL_MODE" >&2; exit 4 ;;
esac
`;

let stubDir = '';

beforeAll(() => {
  expect(fs.existsSync(BASH) || BASH === 'bash').toBe(true); // NOT MEASURED otherwise
  stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notice-health-'));
  fs.writeFileSync(path.join(stubDir, 'psql'), STUB, { mode: 0o755 });
});

afterAll(() => {
  if (stubDir) fs.rmSync(stubDir, { recursive: true, force: true });
});

function run(mode: string): { code: number | null; out: string } {
  const r = spawnSync(BASH, [SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${stubDir}${path.delimiter}${process.env.PATH ?? ''}`,
      STUB_PSQL_MODE: mode,
    },
  });
  if (r.error) throw r.error;
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('scripts/account-notice-health/check.sh', () => {
  it('exit 1 when failures are unacknowledged: one FAILED line per cause, with count and last time', () => {
    const { code, out } = run('rows');
    expect(code).toBe(1);
    const failed = out.split(/\r?\n/).filter((l) => l.startsWith('  FAILED '));
    expect(failed).toEqual([
      '  FAILED publish|household_transferred|23514 x2 last 2026-11-26 07:30 UTC',
      '  FAILED stage|categories_copied|42883 x1 last 2026-11-26 01:00 UTC',
    ]);
    // The acknowledgement it documents is scoped, never a sweep of unread rows.
    expect(out).toContain("created_at <= '<newest created_at you read>'");
  });

  it('exit 0, with the exact line the watchdog step recognises, when there are none', () => {
    const { code, out } = run('empty');
    expect(code).toBe(0);
    expect(out.trim()).toBe('ok: no unacknowledged account-notice failures');
  });

  it.each(['denied', 'down'])('exit 2 - NOT a pass - when the log cannot be read (%s)', (mode) => {
    const { code, out } = run(mode);
    expect(code).toBe(2);
    expect(out).toContain("This is NOT 'no failures'");
    expect(out).not.toContain('ok: no unacknowledged');
  });
});

describe('.github/workflows/account-notice-health.yml', () => {
  const yml = fs.readFileSync(WORKFLOW, 'utf8');

  it('the step that pipes the script into tee sets pipefail first', () => {
    const step = yml.split(/\n\s{6}- name: /).find((s) => s.includes(`bash ${SCRIPT}`));
    expect(step).toBeDefined(); // MUST-FIND: the step exists
    const pipefail = step!.indexOf('set -o pipefail');
    const pipe = step!.indexOf(`${SCRIPT} 2>&1 | tee health.log`);
    expect(pipe).toBeGreaterThan(-1);
    expect(pipefail).toBeGreaterThan(-1);
    expect(pipefail).toBeLessThan(pipe);
  });

  it("the watchdog's signature reads exactly the lines the script prints", () => {
    expect(yml).toContain("grep -E '^  FAILED ' health.log");
    expect(yml).toContain("grep -q '^ok: no unacknowledged' health.log");
  });
});
