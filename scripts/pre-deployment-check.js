#!/usr/bin/env node

/**
 * Pre-Deployment Validation Script
 * Story 9-8: Create Deployment Checklist (AC-9.8.7, AC-9.8.8, AC-9.8.9)
 *
 * Runs automated pre-deployment checks:
 * 1. Environment variables
 * 2. TypeScript type check
 * 3. ESLint
 * 4. Test suite
 * 5. Production build
 *
 * Exit code: 0 (all pass) or 1 (any fail)
 *
 * Usage:
 *   node scripts/pre-deployment-check.js           # Run all checks
 *   node scripts/pre-deployment-check.js --skip-build  # Skip build (faster)
 *   node scripts/pre-deployment-check.js --strict      # Strict env var check
 */

const { execSync } = require('child_process');
const { checkEnvVars } = require('./check-env-vars');

const PASS = '[PASS]';
const FAIL = '[FAIL]';
const WARN = '[WARN]';
const SKIP = '[SKIP]';

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const strictEnv = args.includes('--strict');

const results = [];

function runCheck(name, fn) {
  try {
    const result = fn();
    results.push({ name, ...result });
    const icon = result.status === 'pass' ? PASS : result.status === 'warn' ? WARN : result.status === 'skip' ? SKIP : FAIL;
    console.log(`${icon} ${name}: ${result.message}`);
    return result.status !== 'fail';
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
    console.log(`${FAIL} ${name}: ${error.message}`);
    return false;
  }
}

function tail(text, lines) {
  const all = text.split('\n');
  return all.length <= lines ? text : all.slice(-lines).join('\n');
}

function runCommand(command, options = {}) {
  return execSync(command, {
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: options.timeout || 120000,
    // execSync defaults maxBuffer to 1MB and KILLS the child when output
    // exceeds it, throwing ENOBUFS. A verbose `next build` can pass 1MB, and
    // the result is indistinguishable from a genuine compile failure.
    maxBuffer: 64 * 1024 * 1024,
    cwd: process.cwd(),
    ...options,
  });
}

// ============================================================
console.log('\nPRE-DEPLOYMENT VALIDATION');
console.log('='.repeat(40));

let allPassed = true;

// Check 1: Environment Variables — a failure here MUST fail the run (this
// result was previously dropped, letting deploys pass with missing env)
if (!runCheck('Environment variables', () => {
  const result = checkEnvVars(strictEnv);
  if (result.missing.length > 0) {
    return { status: 'fail', message: `Missing: ${result.missing.join(', ')}` };
  }
  if (result.warnings.length > 0) {
    return { status: 'warn', message: `${result.present.length}/${result.total} present (${result.warnings.length} optional in dev)` };
  }
  return { status: 'pass', message: `All ${result.total} required variables present` };
})) {
  allPassed = false;
}

// Check 2: TypeScript Type Check
if (!runCheck('Type check', () => {
  try {
    runCommand('npx tsc --noEmit', { timeout: 180000 });
    return { status: 'pass', message: 'Passed (0 errors)' };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const errorCount = (output.match(/error TS/g) || []).length;
    return { status: 'fail', message: `Failed (${errorCount} error${errorCount !== 1 ? 's' : ''})` };
  }
})) {
  allPassed = false;
}

// Check 3: ESLint
if (!runCheck('Lint', () => {
  try {
    const output = runCommand('npx next lint', { timeout: 120000 });
    if (output.includes('No ESLint warnings or errors')) {
      return { status: 'pass', message: 'Passed (0 warnings)' };
    }
    // Count warnings
    const warningMatch = output.match(/(\d+) Warning/);
    if (warningMatch) {
      return { status: 'warn', message: `${warningMatch[1]} warning(s)` };
    }
    return { status: 'pass', message: 'Passed' };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const errorMatch = output.match(/(\d+) Error/);
    return { status: 'fail', message: `Failed${errorMatch ? ` (${errorMatch[1]} errors)` : ''}` };
  }
})) {
  allPassed = false;
}

// Check 4: Test Suite
if (!runCheck('Tests', () => {
  try {
    const output = runCommand('npx jest --no-coverage', { timeout: 300000 });
    const passMatch = output.match(/Tests:\s+(\d+) passed/);
    const total = passMatch ? passMatch[1] : '?';
    return { status: 'pass', message: `All passed (${total} tests)` };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const failMatch = output.match(/Tests:\s+(\d+) failed/);
    const passMatch = output.match(/(\d+) passed/);
    const failCount = failMatch ? failMatch[1] : '?';
    const passCount = passMatch ? passMatch[1] : '?';
    return { status: 'fail', message: `${failCount} failed, ${passCount} passed` };
  }
})) {
  allPassed = false;
}

// Check 5: Production Build
if (skipBuild) {
  runCheck('Build', () => ({ status: 'skip', message: 'Skipped (--skip-build)' }));
} else {
  if (!runCheck('Build', () => {
    try {
      runCommand('npx next build', { timeout: 300000 });
      return { status: 'pass', message: 'Success' };
    } catch (error) {
      // runCommand uses stdio:'pipe', so the build's output is captured on the
      // error and nothing reaches the log by itself. This used to say
      // "see logs above" — there were no logs above, and a CI build failure was
      // undiagnosable without reproducing it locally. Print what actually broke.
      const stdout = (error.stdout || '').toString();
      const stderr = (error.stderr || '').toString();
      const combined = `${stdout}\n${stderr}`.trim();

      console.log('\n--- next build output ---');
      console.log(combined ? tail(combined, 80) : '(no output captured)');
      if (error.signal) console.log(`signal: ${error.signal}`);
      if (typeof error.status === 'number') console.log(`exit code: ${error.status}`);
      // execSync sets ETIMEDOUT/SIGTERM on timeout and ENOBUFS when output
      // overflows maxBuffer; both otherwise look identical to a compile error.
      if (error.code) console.log(`error code: ${error.code}`);
      console.log('--- end build output ---\n');

      // Match only lines that are actually error headers. A loose /error|failed/i
      // matched next-pwa's "Fallback to precache routes when fetch failed…"
      // notice and reported it as the build failure.
      const firstError = combined
        .split('\n')
        .find((l) => /^\s*(\[?Error:|Failed to compile|Type error:|Module not found)/.test(l));
      return {
        status: 'fail',
        message: firstError ? firstError.trim().slice(0, 160) : 'Build failed — see output above',
      };
    }
  })) {
    allPassed = false;
  }
}

// ============================================================
console.log('='.repeat(40));

const failCount = results.filter((r) => r.status === 'fail').length;
const warnCount = results.filter((r) => r.status === 'warn').length;

if (allPassed) {
  console.log(`${PASS} PRE-DEPLOYMENT CHECKS PASSED${warnCount > 0 ? ` (${warnCount} warning${warnCount !== 1 ? 's' : ''})` : ''}`);
  console.log('Ready to deploy!\n');
  process.exit(0);
} else {
  console.log(`${FAIL} PRE-DEPLOYMENT CHECKS FAILED (${failCount} failure${failCount !== 1 ? 's' : ''})`);
  console.log('Fix errors before deploying.\n');
  process.exit(1);
}
