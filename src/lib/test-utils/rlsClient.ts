/**
 * RLS Integration Test Harness — per-user Supabase clients
 *
 * Reference helper for Epic 13's Row-Level-Security tests. Unlike the mocked
 * integration tests (see docs/testing/integration-test-guide.md), these clients
 * talk to a REAL Postgres with the real policies applied, authenticated as a real
 * user — so `auth.uid()` is populated and RLS is genuinely exercised.
 *
 * Strategy: docs/testing/rls-integration-test-strategy.md
 *
 * Env-gated: when the RLS_TEST_* vars are absent (normal laptop / default CI job),
 * `isRlsHarnessConfigured()` is false and *.rls.test.ts suites describe.skip — so
 * `npm test` stays green without a database. Run the real thing with:
 *   npx supabase start && npm run test:rls
 */

// Import the RAW supabase-js client (not @/lib/supabase/server, which jest.setup.js
// globally mocks). RLS tests need a real client that carries a real user JWT.
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.RLS_TEST_SUPABASE_URL;
const ANON_KEY = process.env.RLS_TEST_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.RLS_TEST_SUPABASE_SERVICE_KEY;

/** True only when a real test database is wired up via env vars. */
export function isRlsHarnessConfigured(): boolean {
  return Boolean(URL && ANON_KEY && SERVICE_KEY);
}

/**
 * `describe` when the harness is configured, `describe.skip` otherwise.
 * Use as the top-level block of every *.rls.test.ts so the default suite
 * stays green on machines without a database.
 *
 * @example
 *   rlsDescribe('Household isolation', () => { ... });
 */
export const rlsDescribe: jest.Describe = isRlsHarnessConfigured()
  ? describe
  : describe.skip;

function requireConfig(): { url: string; anonKey: string; serviceKey: string } {
  if (!URL || !ANON_KEY || !SERVICE_KEY) {
    throw new Error(
      'RLS harness not configured. Set RLS_TEST_SUPABASE_URL, RLS_TEST_SUPABASE_ANON_KEY, ' +
        'RLS_TEST_SUPABASE_SERVICE_KEY (printed by `npx supabase start`).'
    );
  }
  return { url: URL, anonKey: ANON_KEY, serviceKey: SERVICE_KEY };
}

/**
 * Service-role client — bypasses RLS. Use ONLY for seeding and teardown.
 * NEVER assert reads through this client; it would defeat the test.
 */
export function createServiceClient(): SupabaseClient {
  const { url, serviceKey } = requireConfig();
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Returns an anon-key client authenticated as the given test user.
 * All RLS assertions must go through clients created here, so the request
 * carries the user's JWT and the database evaluates policies for `auth.uid()`.
 */
export async function signInAsTestUser(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const { url, anonKey } = requireConfig();
  const client = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`RLS harness sign-in failed for ${email}: ${error.message}`);
  }
  return client;
}

/**
 * Creates an auth user via the admin API (service role) for seeding.
 * Idempotent-ish: callers should use unique emails per run or clean up in afterAll.
 */
export async function createTestUser(email: string, password: string): Promise<string> {
  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`RLS harness createUser failed for ${email}: ${error?.message}`);
  }
  return data.user.id;
}

/** Deletes a seeded auth user (cascades app data via ON DELETE CASCADE). */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createServiceClient();
  await admin.auth.admin.deleteUser(userId);
}
