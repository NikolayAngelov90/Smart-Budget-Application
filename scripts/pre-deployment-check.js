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

function runCommand(command, options = {}) {
  return execSync(command, {
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: options.timeout || 120000,
    cwd: process.cwd(),
    ...options,
  });
}

// ============================================================
console.log('\nPRE-DEPLOYMENT VALIDATION');
console.log('='.repeat(40));

let allPassed = true;

// Check 1: Environment Variables
runCheck('Environment variables', () => {
  const result = checkEnvVars(strictEnv);
  if (result.missing.length > 0) {
    return { status: 'fail', message: `Missing: ${result.missing.join(', ')}` };
  }
  if (result.warnings.length > 0) {
    return { status: 'warn', message: `${result.present.length}/${result.total} present (${result.warnings.length} optional in dev)` };
  }
  return { status: 'pass', message: `All ${result.total} required variables present` };
});

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
      return { status: 'fail', message: 'Build failed (see logs above)' };
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
