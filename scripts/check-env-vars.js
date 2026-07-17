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
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'CRON_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];

// Modern Supabase API key names satisfy the legacy requirement: either name
// present counts (publishable sb_publishable_... / secret sb_secret_...).
const VAR_ALIASES = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
  SUPABASE_SERVICE_ROLE_KEY: ['SUPABASE_SECRET_KEY'],
};

// Variables that are optional in development
const DEV_OPTIONAL = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'CRON_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];

// Env files to load (first-set wins; process.env always wins). The second is
// what `vercel pull` writes in the CI deploy job — without it the deploy-time
// check never saw the pulled production env at all.
const ENV_FILES = ['.env.local', path.join('.vercel', '.env.production.local')];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const envContent = fs.readFileSync(filePath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        // vercel pull quotes values; a quoted empty string must stay empty
        if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        if (!process.env[key] && value) {
          process.env[key] = value;
        }
      }
    }
  });
}

function checkEnvVars(strict = false) {
  for (const file of ENV_FILES) {
    loadEnvFile(path.join(process.cwd(), file));
  }

  const missing = [];
  const warnings = [];
  const present = [];

  const resolve = (varName) => {
    const names = [varName, ...(VAR_ALIASES[varName] || [])];
    for (const name of names) {
      const value = process.env[name];
      if (value && !value.startsWith('your_')) return value;
    }
    return undefined;
  };

  for (const varName of REQUIRED_VARS) {
    if (!resolve(varName)) {
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
