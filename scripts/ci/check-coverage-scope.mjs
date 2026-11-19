#!/usr/bin/env node
// =============================================================================
// Coverage measures SHIPPED code - checked, not assumed.
//
//   node scripts/ci/check-coverage-scope.mjs [coverage/coverage-final.json]
//
// Test-support code (src/test-utils, src/lib/test-utils, anything in a
// __tests__ or __mocks__ directory) is excluded in BOTH jest.config.js
// collectCoverageFrom and codecov.yml. It was instrumented but never run by the
// unit suite, so it read as 0% and turned codecov/patch red on code that runs
// in the RLS job - and a red check that "isn't required" trains people to
// ignore red.
//
// An exclusion list can also over-reach and silently drop product code from the
// ratio, so this is PAIRED:
//   MUST-NOT-EXCLUDE  a real product file is in the report
//   MUST-EXCLUDE      no test-support path is in the report
//   NON-VACUITY       the excluded directories really hold files on disk, so
//                     "none in the report" is an exclusion working, not an
//                     empty directory
// =============================================================================
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const report = process.argv[2] ?? 'coverage/coverage-final.json';
const PRODUCT = 'src/lib/services/goalService.ts';
const SUPPORT_DIRS = ['src/test-utils', 'src/lib/test-utils'];
const SUPPORT = [/(^|\/)src\/test-utils\//, /(^|\/)src\/lib\/test-utils\//, /\/__tests__\//, /\/__mocks__\//];

if (!existsSync(report)) {
  console.error(`::error::NOT MEASURED - ${report} does not exist; run coverage first.`);
  process.exit(2);
}
const files = Object.keys(JSON.parse(readFileSync(report, 'utf8'))).map((f) =>
  path.relative(process.cwd(), f).split(path.sep).join('/')
);

const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = path.join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const onDisk = SUPPORT_DIRS.flatMap((d) => (existsSync(d) ? walk(d) : []));

const problems = [];
if (!files.includes(PRODUCT)) problems.push(`MUST-NOT-EXCLUDE failed: ${PRODUCT} is not in the report`);
const leaked = files.filter((f) => SUPPORT.some((r) => r.test(f)));
leaked.forEach((f) => problems.push(`MUST-EXCLUDE failed: test-support file in the report: ${f}`));
if (onDisk.length === 0) problems.push('NON-VACUITY failed: no test-support files on disk, so the exclusion proves nothing');

console.log(`coverage report: ${files.length} files`);
console.log(`  must-not-exclude  ${PRODUCT}: ${files.includes(PRODUCT) ? 'present' : 'MISSING'}`);
console.log(`  must-exclude      test-support files in report: ${leaked.length} (want 0)`);
console.log(`  non-vacuity       test-support files on disk: ${onDisk.length} (want > 0)`);
if (problems.length) {
  problems.forEach((p) => console.error('::error::' + p));
  process.exit(1);
}
console.log('  ok');
