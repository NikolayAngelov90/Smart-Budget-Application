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

// Import the RAW supabase-js client: RLS tests need a real client that carries a
// real user JWT. (The comment here used to say @/lib/supabase/server is globally
// mocked by jest.setup.js; that mock was deleted on 2026-11-18. To run a REAL
// service function against the local stack, see pinAppServiceRoleToLocalStack.)
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
export const rlsDescribe: jest.Describe = isRlsHarnessConfigured() ? describe : describe.skip;

function requireConfig(): { url: string; anonKey: string; serviceKey: string } {
  if (!URL || !ANON_KEY || !SERVICE_KEY) {
    throw new Error(
      'RLS harness not configured. Set RLS_TEST_SUPABASE_URL, RLS_TEST_SUPABASE_ANON_KEY, ' +
        'RLS_TEST_SUPABASE_SERVICE_KEY (printed by `npx supabase start`).'
    );
  }
  return { url: URL, anonKey: ANON_KEY, serviceKey: SERVICE_KEY };
}

/** Same allowlist as scripts/rls-preflight.mjs, compared with === on the PARSED host. */
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

/**
 * Points the APP's service-role client (`createServiceRoleClient` in
 * @/lib/supabase/server) at the local test stack, so an RLS test can run a REAL
 * service function instead of a copy of its steps - a copy that can drift from
 * the service while every test stays green.
 *
 * SAFETY, because next/jest loads .env* files: SUPABASE_SECRET_KEY may hold
 * PRODUCTION's key when this runs. Both variables the app reads are overwritten
 * with the harness values, whose host rls-preflight.mjs has already checked; the
 * host is checked again here, and `assertAppPinnedToLocalStack` re-checks before
 * every real call. Returns a function that restores the previous values.
 */
export function pinAppServiceRoleToLocalStack(): () => void {
  const { url, serviceKey } = requireConfig();
  const host = new globalThis.URL(url).hostname;
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(`Refusing to point the app at a non-local host: ${host}`);
  }
  const saved = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SECRET_KEY = serviceKey;
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

/** Throws unless the app's service-role client would reach the local test stack. */
export function assertAppPinnedToLocalStack(): void {
  const { url, serviceKey } = requireConfig();
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL !== url ||
    process.env.SUPABASE_SECRET_KEY !== serviceKey ||
    !LOCAL_HOSTS.includes(new globalThis.URL(url).hostname)
  ) {
    throw new Error(
      'The app service-role client is not pinned to the local test stack - refusing to run a real service function'
    );
  }
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
export async function signInAsTestUser(email: string, password: string): Promise<SupabaseClient> {
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

/**
 * Awaits a seeding query that should return exactly one row and throws a LOUD,
 * labelled error if it doesn't. Use for service-role `insert(...).select(...).single()`
 * seeds so a broken stack surfaces the real PostgREST error instead of a cryptic
 * `Cannot read properties of null (reading 'id')` a line later.
 *
 * This caught us once: Supabase CLI v2.106.0 stopped auto-exposing new tables to the
 * Data API, so service-role inserts returned no row and every seed null-dereffed.
 *
 * @example
 *   const household = await seedSingle(
 *     svc.from('households').insert({ name: 'A', created_by: aId }).select('id').single(),
 *     'household A'
 *   );
 */
export async function seedSingle<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  label: string
): Promise<T> {
  const { data, error } = await query;
  if (error || !data) {
    throw new Error(
      `RLS seed "${label}" failed: ${error?.message ?? 'no row returned'} — is the table exposed to the Data API / granted to service_role?`
    );
  }
  return data;
}

/**
 * Deletes a seeded auth user, which cascades the user's app rows through the
 * ON DELETE CASCADE foreign keys - and THROWS if the delete fails.
 *
 * It used to discard the result. Every RLS suite's afterAll relies on this
 * cascade, so a foreign key that blocked it (transactions.category_id is
 * ON DELETE RESTRICT, for one) failed silently in the one place nobody reads,
 * while a unit test's name claimed the cascade was "verified through RLS and
 * FK constraints". With the throw, a blocked cascade fails the suite: a throwing
 * afterAll fails the run (checked 2026-11-18 - jest exit 1, "1 failed" suite,
 * with the test itself passing).
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(
      `RLS teardown could not delete test user ${userId}: ${error.message}. ` +
        'A foreign key blocked the account-deletion cascade - the same cascade production relies on.'
    );
  }
}
