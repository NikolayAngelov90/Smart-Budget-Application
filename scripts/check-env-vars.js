#!/usr/bin/env node

/**
 * Environment Variable Checker
 * Story 9-8: Create Deployment Checklist (AC-9.8.2)
 *
 * Validates that all required environment variables are present.
 * Reads variable names from .env.example for maintainability.
 *
 * Usage: node scripts/check-env-vars.js
 * Exit code: 0 (all present) or 1 (missing vars)
 */

const fs = require('fs');
const path = require('path');

// Required environment variables for production deployment
const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'CRON_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXT_PUBLIC_APP_URL',
];

// Variables that are optional in development
const DEV_OPTIONAL = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'CRON_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

function checkEnvVars(strict = false) {
  // Try to load .env.local if it exists
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }

  const missing = [];
  const warnings = [];
  const present = [];

  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    if (!value || value.startsWith('your_')) {
      if (!strict && DEV_OPTIONAL.includes(varName)) {
        warnings.push(varName);
      } else {
        missing.push(varName);
      }
    } else {
      present.push(varName);
    }
  }

  return { present, missing, warnings, total: REQUIRED_VARS.length };
}

// Run if executed directly
if (require.main === module) {
  const strict = process.argv.includes('--strict');
  const result = checkEnvVars(strict);

  console.log(`\nEnvironment Variable Check${strict ? ' (strict mode)' : ''}:`);
  console.log('='.repeat(40));

  if (result.present.length > 0) {
    result.present.forEach((v) => console.log(`  [PASS] ${v}`));
  }

  if (result.warnings.length > 0) {
    result.warnings.forEach((v) => console.log(`  [WARN] ${v} (optional in dev)`));
  }

  if (result.missing.length > 0) {
    result.missing.forEach((v) => console.log(`  [FAIL] ${v} - MISSING`));
  }

  console.log('='.repeat(40));
  console.log(`  ${result.present.length}/${result.total} present, ${result.warnings.length} warnings, ${result.missing.length} missing`);

  if (result.missing.length > 0) {
    console.log('\n[FAIL] Missing required environment variables');
    process.exit(1);
  } else {
    console.log('\n[PASS] Environment variables OK');
    process.exit(0);
  }
}

module.exports = { checkEnvVars, REQUIRED_VARS, DEV_OPTIONAL };
