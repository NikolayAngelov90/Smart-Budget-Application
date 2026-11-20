#!/usr/bin/env node
/**
 * `npm run verify`: the CI test job's steps, locally, in CI's order.
 *
 * WHY THIS EXISTS. PR #106 failed CI on `Check formatting` because the local
 * checks before the push were a list kept in memory, and it had no
 * format:check. A list someone remembers is a guideline with one reader. This
 * is the mechanism: the steps live in scripts/ci/verify-steps.json, and
 * scripts/__tests__/verify-steps.test.ts fails whenever test.yml's test job has
 * a `run:` step that the JSON neither runs nor skips with a reason.
 *
 * WHAT IT DOES NOT COVER. `uses:` steps (checkout, setup-node, the pinned-npm
 * action, the Codecov upload) are actions, not commands. The pinned npm is
 * checked below instead: the action installs npm globally, which a local check
 * must not do. Other workflows (pinned test order, RLS, drift) are separate jobs
 * with their own commands.
 *
 * Stops at the first failing step, except a step CI marks continue-on-error,
 * which is reported as a warning, as CI treats it.
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync(new URL('./verify-steps.json', import.meta.url), 'utf8'));

// The local stand-in for `uses: ./.github/actions/pinned-npm`, which runs
// `npm ci` with exactly the npm package.json pins.
const pinned = /^npm@(\d+\.\d+\.\d+)$/.exec(
  JSON.parse(readFileSync('package.json', 'utf8')).packageManager ?? ''
)?.[1];
const npmVersion = spawnSync('npm', ['--version'], {
  encoding: 'utf8',
  shell: true,
}).stdout?.trim();
if (!pinned || npmVersion !== pinned) {
  console.error(
    `verify: npm on PATH is ${npmVersion || 'missing'}; package.json pins ${pinned || 'nothing'}. ` +
      'CI installs the pinned npm first (scripts/ci/pinned-npm.sh). Install it, then re-run.'
  );
  process.exit(1);
}
console.log(`verify: npm ${npmVersion} (pinned) - running ${config.workflow} job "${config.job}"`);
for (const s of config.skip) console.log(`verify: SKIP  ${s.name} - ${s.why}`);

const results = [];
let failed = false;
for (const step of config.run) {
  console.log(`\nverify: ▶ ${step.name}  (${step.run})`);
  const started = Date.now();
  const { status } = spawnSync(step.run, { stdio: 'inherit', shell: true });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (status === 0) {
    results.push(`ok    ${step.name} (${seconds}s)`);
  } else if (step.continueOnError) {
    results.push(`WARN  ${step.name} (${seconds}s) - exit ${status}; continue-on-error, as in CI`);
  } else {
    results.push(`FAIL  ${step.name} (${seconds}s) - exit ${status}`);
    failed = true;
    break;
  }
}

const notRun = config.run.slice(results.length).map((s) => `-     ${s.name} (not run)`);
console.log(`\nverify summary (${config.workflow}, job "${config.job}"):`);
for (const line of [...results, ...notRun]) console.log(`  ${line}`);
console.log(
  failed ? 'verify: FAILED' : 'verify: OK - every runnable step of the CI test job passed'
);
process.exit(failed ? 1 : 0);
