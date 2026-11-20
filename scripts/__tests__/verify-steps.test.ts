/**
 * @jest-environment node
 *
 * `npm run verify` mirrors the CI test job, by construction.
 *
 * PR #106 failed CI on `Check formatting`: the local checks before the push
 * were a list kept in memory, and it had no format:check. The mechanism is
 * scripts/ci/verify-steps.json, which `npm run verify` executes, plus this
 * test, which fails unless EVERY `run:` step of jobs.test in test.yml is in the
 * JSON:
 *   - under `run`, with the same name, the same command, the same
 *     continue-on-error, and in CI's order; or
 *   - under `skip`, with a reason.
 * It also fails in the other direction: a JSON entry that names no workflow
 * step. A check for one direction of change is blind to the other.
 */

export {};

const fs = jest.requireActual('fs') as typeof import('fs');
const os = jest.requireActual('os') as typeof import('os');
const path = jest.requireActual('path') as typeof import('path');
const { spawnSync } = jest.requireActual('child_process') as typeof import('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

type VerifyStep = { name: string; run: string; continueOnError?: boolean };
type VerifyConfig = {
  workflow: string;
  job: string;
  run: VerifyStep[];
  skip: Array<{ name: string; why: string }>;
};

const config = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts', 'ci', 'verify-steps.json'), 'utf8')
) as VerifyConfig;

type WorkflowStep = { name: string; run?: string; uses?: string; continueOnError: boolean };

/**
 * The steps of one job, read by indentation: `jobs:` at column 0, the job at 2,
 * `steps:` at 4, items at 6 (`- `), their keys at 8. A `run: |` block collects
 * the more-indented lines under it. Comments and `with:`/`env:` contents are
 * ignored.
 */
export function jobSteps(text: string, job: string): WorkflowStep[] {
  const lines = text.split(/\r?\n/);
  const jobsAt = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  const jobAt = lines.findIndex((l, k) => k > jobsAt && l === `  ${job}:`);
  if (jobsAt < 0 || jobAt < 0) return [];
  let end = lines.length;
  for (let k = jobAt + 1; k < lines.length; k++) {
    if (/^ {0,2}\S/.test(lines[k]!) && !/^\s*#/.test(lines[k]!)) {
      end = k;
      break;
    }
  }
  const body = lines.slice(jobAt + 1, end);
  const stepsAt = body.findIndex((l) => /^ {4}steps:\s*$/.test(l));
  if (stepsAt < 0) return [];

  const steps: WorkflowStep[] = [];
  let current: Record<string, string> | null = null;
  const flush = () => {
    if (current?.name) {
      steps.push({
        name: current.name,
        run: current.run,
        uses: current.uses,
        continueOnError: current['continue-on-error'] === 'true',
      });
    }
  };
  for (let k = stepsAt + 1; k < body.length; k++) {
    const line = body[k]!;
    if (/^\s*#/.test(line) || line.trim() === '') continue;
    const item = /^ {6}- ([\w-]+):\s*(.*)$/.exec(line);
    const key = /^ {8}([\w-]+):\s*(.*)$/.exec(line);
    const m = item ?? key;
    if (!m) continue; // deeper keys (with:, env: contents) or block lines handled below
    if (item) {
      flush();
      current = {};
    }
    if (!current) continue;
    const [, name, raw] = m;
    let value = raw!.trim();
    if (value === '|' || value === '>') {
      const block: string[] = [];
      while (k + 1 < body.length && (/^ {10}/.test(body[k + 1]!) || body[k + 1]!.trim() === '')) {
        block.push(body[++k]!.slice(10));
      }
      value = block.join('\n').trim();
    }
    current[name!] = value.replace(/^(['"])(.*)\1$/, '$2');
  }
  flush();
  return steps;
}

const workflowText = fs.readFileSync(path.join(ROOT, config.workflow), 'utf8');
const steps = jobSteps(workflowText, config.job);
const runSteps = steps.filter((s) => s.run !== undefined);

describe('npm run verify mirrors the CI test job', () => {
  test('the parser reads the job (must-find: a broken parser cannot pass)', () => {
    expect(steps.length).toBeGreaterThanOrEqual(10);
    expect(runSteps.length).toBeGreaterThanOrEqual(8);
    expect(steps.some((s) => s.uses !== undefined)).toBe(true);
    expect(steps.find((s) => s.name === 'Check formatting')?.run).toBe('npm run format:check');
    expect(steps.find((s) => s.name === 'Security audit dependencies')?.continueOnError).toBe(true);
  });

  test('every run: step of the CI job is in verify, or skipped with a reason', () => {
    const listed = new Set([...config.run, ...config.skip].map((s) => s.name));
    const missing = runSteps.filter((s) => !listed.has(s.name)).map((s) => `${s.name}: ${s.run}`);
    expect(missing).toEqual([]);
  });

  test('every verify entry names a run: step that exists (the other direction)', () => {
    const inWorkflow = new Set(runSteps.map((s) => s.name));
    const stale = [...config.run, ...config.skip]
      .map((s) => s.name)
      .filter((name) => !inWorkflow.has(name));
    expect(stale).toEqual([]);
  });

  test('verify runs the SAME command, with the same continue-on-error, in CI order', () => {
    const byName = new Map(runSteps.map((s) => [s.name, s]));
    const drift = config.run
      .filter((v) => {
        const ci = byName.get(v.name);
        return ci && (ci.run !== v.run || ci.continueOnError !== Boolean(v.continueOnError));
      })
      .map((v) => `${v.name}: verify "${v.run}" vs CI "${byName.get(v.name)!.run}"`);
    expect(drift).toEqual([]);

    const ciOrder = runSteps.map((s) => s.name).filter((n) => config.run.some((v) => v.name === n));
    expect(config.run.map((v) => v.name)).toEqual(ciOrder);
  });

  test('a skip says why; nothing is both run and skipped; package.json wires it', () => {
    for (const s of config.skip) expect(s.why.length).toBeGreaterThan(20);
    const runNames = config.run.map((s) => s.name);
    expect(config.skip.filter((s) => runNames.includes(s.name))).toEqual([]);
    expect(new Set(runNames).size).toBe(runNames.length);
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.verify).toBe('node scripts/ci/verify.mjs');
  });
});

describe('check-coverage-threshold.mjs (shared by CI and verify)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-threshold-'));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  function run(total: unknown) {
    const file = path.join(dir, `summary-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(file, JSON.stringify({ total }));
    const r = spawnSync(process.execPath, ['scripts/ci/check-coverage-threshold.mjs', file], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30_000,
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  }
  const metrics = (pcts: [number, number, number, number]) => ({
    statements: { pct: pcts[0] },
    branches: { pct: pcts[1] },
    functions: { pct: pcts[2] },
    lines: { pct: pcts[3] },
  });

  test('passes on the LOWEST metric at or above 30%', () => {
    const r = run(metrics([80, 30, 90, 70]));
    expect(r.status).toBe(0);
    expect(r.out).toContain('Coverage: 30%');
  });

  test('fails when any one metric is below 30%', () => {
    const r = run(metrics([80, 29.9, 90, 70]));
    expect(r.status).toBe(1);
    expect(r.out).toContain('below 30% threshold');
  });

  test('fails on a summary without the four metrics (never a silent pass)', () => {
    expect(run({ statements: { pct: 90 } }).status).toBe(1);
  });
});
