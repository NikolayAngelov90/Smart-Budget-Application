#!/usr/bin/env node
/**
 * CATASTROPHE CANARY, NOT A DRIFT GATE. Fails when the LOWEST of the four total
 * coverage metrics (statements, branches, functions, lines) is below 30%.
 *
 * It was an inline bash block in test.yml until 2026-11-20. It moved here so
 * that CI and `npm run verify` run ONE definition, not two that can drift.
 * The drift gate is codecov.yml's `target: auto` + 1% threshold; a green run
 * here does not mean coverage is fine (see the comment above the step in
 * test.yml).
 *
 * Usage: node scripts/ci/check-coverage-threshold.mjs [coverage-summary.json]
 */

import { readFileSync } from 'node:fs';

const THRESHOLD = 30;
const file = process.argv[2] ?? './coverage/coverage-summary.json';

let total;
try {
  total = JSON.parse(readFileSync(file, 'utf8')).total;
} catch (error) {
  console.error(
    `::error::cannot read ${file}: ${error.message}. Run the tests with coverage first.`
  );
  process.exit(1);
}

const metrics = ['statements', 'branches', 'functions', 'lines'].map((m) => total?.[m]?.pct);
if (metrics.some((pct) => typeof pct !== 'number' || Number.isNaN(pct))) {
  console.error(`::error::${file} has no total.{statements,branches,functions,lines}.pct`);
  process.exit(1);
}

const coverage = Math.min(...metrics);
console.log(`Coverage: ${coverage}%`);
if (coverage < THRESHOLD) {
  console.log(`❌ Coverage (${coverage}%) is below ${THRESHOLD}% threshold`);
  process.exit(1);
}
console.log(`✅ Coverage (${coverage}%) meets minimum ${THRESHOLD}% threshold`);
