/**
 * Environment Variable Checker Tests
 * Story 9-8: Create Deployment Checklist (AC-9.8.2, AC-9.8.8)
 */

export {};

const nodeFs = require('fs');
const { checkEnvVars, REQUIRED_VARS, DEV_OPTIONAL } = require('../check-env-vars');

// Mock fs.existsSync so checkEnvVars() doesn't load .env.local during tests
const originalExistsSync = nodeFs.existsSync;
jest.spyOn(nodeFs, 'existsSync').mockImplementation((...args: unknown[]) => {
  const p = args[0] as string;
  if (typeof p === 'string' && p.endsWith('.env.local')) return false;
  return originalExistsSync(...args);
});

describe('check-env-vars', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env to clean state
    process.env = { ...originalEnv };
    // Remove all required vars to start fresh
    REQUIRED_VARS.forEach((v: string) => delete process.env[v]);
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('REQUIRED_VARS', () => {
    it('includes all critical environment variables', () => {
      expect(REQUIRED_VARS).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(REQUIRED_VARS).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(REQUIRED_VARS).toContain('UPSTASH_REDIS_REST_URL');
      expect(REQUIRED_VARS).toContain('UPSTASH_REDIS_REST_TOKEN');
      expect(REQUIRED_VARS).toContain('CRON_SECRET');
      expect(REQUIRED_VARS).toContain('NEXT_PUBLIC_APP_URL');
    });

    it('includes OAuth variables', () => {
      expect(REQUIRED_VARS).toContain('GOOGLE_CLIENT_ID');
      expect(REQUIRED_VARS).toContain('GOOGLE_CLIENT_SECRET');
      expect(REQUIRED_VARS).toContain('GITHUB_CLIENT_ID');
      expect(REQUIRED_VARS).toContain('GITHUB_CLIENT_SECRET');
    });

    it('has 10 required variables', () => {
      expect(REQUIRED_VARS).toHaveLength(10);
    });
  });

  describe('DEV_OPTIONAL', () => {
    it('includes OAuth and Redis vars as dev-optional', () => {
      expect(DEV_OPTIONAL).toContain('GOOGLE_CLIENT_ID');
      expect(DEV_OPTIONAL).toContain('UPSTASH_REDIS_REST_URL');
      expect(DEV_OPTIONAL).toContain('CRON_SECRET');
    });

    it('does NOT include Supabase vars (always required)', () => {
      expect(DEV_OPTIONAL).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(DEV_OPTIONAL).not.toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    });
  });

  describe('checkEnvVars (non-strict)', () => {
    it('returns all missing when no vars are set', () => {
      const result = checkEnvVars(false);
      // Supabase vars are always required, so at least those should be missing
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    });

    it('treats dev-optional vars as warnings in non-strict mode', () => {
      // Set only required (non-optional) vars
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001';

      const result = checkEnvVars(false);
      expect(result.missing).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('GOOGLE_CLIENT_ID');
    });

    it('reports all present when all vars are set', () => {
      REQUIRED_VARS.forEach((v: string) => {
        process.env[v] = 'test-value';
      });

      const result = checkEnvVars(false);
      expect(result.missing).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.present).toHaveLength(REQUIRED_VARS.length);
    });

    it('treats placeholder values as missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'your_supabase_project_url';
      const result = checkEnvVars(false);
      expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
    });

    it('returns correct total count', () => {
      const result = checkEnvVars(false);
      expect(result.total).toBe(REQUIRED_VARS.length);
    });
  });

  describe('checkEnvVars (strict)', () => {
    it('reports dev-optional vars as missing in strict mode', () => {
      // Set only Supabase vars
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001';

      const result = checkEnvVars(true);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain('GOOGLE_CLIENT_ID');
      expect(result.warnings).toHaveLength(0);
    });

    it('passes when all vars are set in strict mode', () => {
      REQUIRED_VARS.forEach((v: string) => {
        process.env[v] = 'test-value';
      });

      const result = checkEnvVars(true);
      expect(result.missing).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
