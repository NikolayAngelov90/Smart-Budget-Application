/**
 * @jest-environment node
 *
 * ONE npm version for local and CI.
 *
 * In PR #104 a lockfile written by local npm 11.6.3 passed every local gate and
 * failed `npm ci` in CI, where Node 22 bundles npm 10. The fix is a mechanism:
 * package.json pins npm in "packageManager", and every CI job installs exactly
 * that npm (.github/actions/pinned-npm) before `npm ci`.
 *
 * This test keeps the mechanism from eroding. A job added later with a bare
 * `npm ci` would silently use whatever npm Node bundles, with no error anywhere.
 * So: every job that installs from the lockfile must use the pinned-npm action
 * FIRST.
 */

export {};

const fs = jest.requireActual('fs') as typeof import('fs');
const path = jest.requireActual('path') as typeof import('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const PIN_ACTION = 'uses: ./.github/actions/pinned-npm';
/** Installs that read the lockfile. A global tool install (`npm install --global x`) does not. */
const LOCKFILE_INSTALL = /^\s*(?:-\s+)?run:\s*npm\s+(?:ci|install|i)(?!.*(?:--global|\s-g\b))\b/;

type Job = { file: string; job: string; lines: string[] };

/** Splits a workflow into its jobs by indentation: `jobs:` at column 0, job keys at 2. */
function jobsOf(file: string): Job[] {
  const lines = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start < 0) return [];
  const jobs: Job[] = [];
  let current: Job | null = null;
  for (const line of lines.slice(start + 1)) {
    const key = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (key) {
      current = { file, job: key[1]!, lines: [] };
      jobs.push(current);
    } else if (/^\S/.test(line)) {
      break; // a new top-level key ends `jobs:`
    } else if (current) {
      current.lines.push(line);
    }
  }
  return jobs;
}

const workflowFiles = fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
const allJobs = workflowFiles.flatMap(jobsOf);
const installingJobs = allJobs.filter((j) => j.lines.some((l) => LOCKFILE_INSTALL.test(l)));

describe('pinned npm: one version for local and CI', () => {
  it('package.json pins an exact npm version in "packageManager"', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.packageManager).toMatch(/^npm@\d+\.\d+\.\d+$/);
  });

  it('the parser can SEE the jobs that install from the lockfile (non-vacuity)', () => {
    // MUST-FIND: if the workflows are not parsed, every job "passes" the check below.
    // A count of zero means the reader broke, not that nothing installs.
    expect(allJobs.length).toBeGreaterThan(0);
    expect(installingJobs.length).toBeGreaterThan(0);
    expect(installingJobs.map((j) => j.job)).toEqual(expect.arrayContaining(['test']));
  });

  it('every job that installs from the lockfile uses the pinned-npm action BEFORE that install', () => {
    const violations = installingJobs.flatMap((j) => {
      const pin = j.lines.findIndex((l) => l.includes(PIN_ACTION));
      const firstInstall = j.lines.findIndex((l) => LOCKFILE_INSTALL.test(l));
      return pin >= 0 && pin < firstInstall
        ? []
        : [`${j.file} > ${j.job}: ${pin < 0 ? 'no pinned-npm step' : 'pinned-npm step comes AFTER the install'}`];
    });
    expect(violations).toEqual([]);
  });

  it('the action delegates to the script the docs and this test describe', () => {
    const action = fs.readFileSync(path.join(ROOT, '.github', 'actions', 'pinned-npm', 'action.yml'), 'utf8');
    expect(action).toContain('bash scripts/ci/pinned-npm.sh');
    expect(fs.existsSync(path.join(ROOT, 'scripts', 'ci', 'pinned-npm.sh'))).toBe(true);
  });
});
