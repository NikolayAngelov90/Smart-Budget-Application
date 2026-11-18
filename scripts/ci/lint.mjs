#!/usr/bin/env node
// =============================================================================
// The lint gate, with its scope DERIVED FROM JEST rather than listed by hand.
//
//   node scripts/ci/lint.mjs [--cache] [--print-scope]
//
// A GATE CANNOT FAIL ON A FILE IT NEVER READS. `eslint src/` could not read the
// root __tests__/ suite, nor the test files Jest runs under scripts/ and docs/,
// so a lint rule aimed at test code was blind to a fifth of it. The scope here
// is whatever Jest actually runs:
//
//   src/                                  product code, as before
//   every __tests__/ directory that holds a test file `jest --listTests` returns
//   Jest's setupFiles / setupFilesAfterEnv
//
// Asking Jest means testMatch and testPathIgnorePatterns are applied by the
// tool that owns them, so a new test root joins the gate without anyone
// remembering to add it. Two things stay out BY CONSTRUCTION, not by exception:
// the masked-failure fixture (Jest's own ignore list excludes it) and the
// lint-rule fixtures (not under __tests__/). The production tooling in scripts/
// stays out too - .eslintignore keeps it out deliberately, and it is not Jest's.
//
// It is PAIRED: the derived scope must contain `src` and at least one test
// directory, and every file Jest lists must lie inside it - otherwise this
// exits NOT MEASURED instead of reporting a clean lint over a scope that
// silently shrank.
// =============================================================================
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ESLint } = require('eslint');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const args = process.argv.slice(2);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const jestBin = require.resolve('jest/bin/jest');

function jest(...flags) {
  return execFileSync(process.execPath, [jestBin, ...flags], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

// --- what Jest runs -----------------------------------------------------------
const testFiles = jest('--listTests').split(/\r?\n/).filter(Boolean).map((p) => path.resolve(p));
const config = JSON.parse(jest('--showConfig')).configs[0];
const setup = [...(config.setupFiles ?? []), ...(config.setupFilesAfterEnv ?? [])];

const testDirs = new Set();
for (const f of testFiles) {
  const parts = rel(f).split('/');
  const i = parts.lastIndexOf('__tests__');
  if (i >= 0) testDirs.add(parts.slice(0, i + 1).join('/'));
}
// src/ is linted whole, so test dirs inside it are already covered.
const extraTestDirs = [...testDirs].filter((d) => !d.startsWith('src/')).sort();
const scope = ['src', ...extraTestDirs, ...setup.map(rel)];

// --- pairing: the scope must cover every file Jest runs ----------------------
const covered = (f) => scope.some((s) => rel(f) === s || rel(f).startsWith(s + '/'));
const uncovered = testFiles.filter((f) => !covered(f));
if (!scope.includes('src') || testDirs.size === 0 || uncovered.length) {
  console.error('::error::NOT MEASURED - the derived lint scope does not cover what Jest runs.');
  uncovered.slice(0, 10).forEach((f) => console.error('  not covered: ' + rel(f)));
  process.exit(2);
}

console.log(`lint scope (derived from jest: ${testFiles.length} test files):`);
scope.forEach((s) => console.log('  ' + s));
if (args.includes('--print-scope')) process.exit(0);

// --- lint ---------------------------------------------------------------------
// ignore:false so .eslintignore's `scripts/` (production tooling, deliberately
// unlinted) does not also hide the __tests__/ directories Jest runs inside it.
// Every path passed here was derived above; nothing else is reached.
const eslint = new ESLint({
  cwd: ROOT,
  extensions: ['.js', '.jsx', '.ts', '.tsx'],
  ignore: false,
  cache: args.includes('--cache'),
  cacheLocation: path.join(ROOT, '.eslintcache'),
});
const results = await eslint.lintFiles(scope);
const formatter = await eslint.loadFormatter('stylish');
const out = await formatter.format(results);
if (out) console.log(out);
const errors = results.reduce((n, r) => n + r.errorCount, 0);
const warnings = results.reduce((n, r) => n + r.warningCount, 0);
console.log(`files linted: ${results.length}   errors: ${errors}   warnings: ${warnings} (max 0)`);
process.exit(errors || warnings ? 1 : 0);
