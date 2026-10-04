#!/usr/bin/env node
/**
 * PREFLIGHT FOR THE RLS INTEGRATION SUITE.
 *
 * WHY IT EXISTS. `src/lib/test-utils/rlsClient.ts` exports `rlsDescribe`, which is
 * `describe` when the three RLS_TEST_* vars are set and `describe.skip` when they
 * are not. That is deliberate — it keeps `npm test` green on a laptop with no
 * database. The consequence is that `npm run test:rls` EXITS ZERO WITH EVERY
 * SUITE SKIPPED when the credentials are missing. A green run and a run that
 * proved nothing are the same signal, which is the failure mode this repository
 * keeps finding: a job whose healthy state is indistinguishable from its dead
 * state cannot be monitored.
 *
 * So this runs first, inside `npm run test:rls`, and fails loudly instead.
 *
 * THE SECOND JOB IS THE SERIOUS ONE. These suites do not read a database, they
 * WRITE to it: `createTestUser` provisions real auth users, seeds rows, and
 * `deleteTestUser` cascades deletes. Pointed at production they would create and
 * destroy real records. So the host is checked against an allowlist of local
 * addresses, compared with `===` and never by substring — because
 * `127.0.0.1.evil.com` and `localhost.attacker.net` both CONTAIN an allowlisted
 * string while resolving somewhere else entirely. Both were used as fixtures when
 * this was written.
 *
 * SINGLE IMPLEMENTATION, TWO CALL SITES. `.github/workflows/rls.yml` previously
 * carried its own copy of the credentials check as a separate step. That step now
 * invokes THIS script instead. Two guards asserting the same precondition is
 * drift waiting to happen — and worse here than usual, because the weaker copy
 * ran first, so its less informative message is the one anybody would have seen.
 */

const REQUIRED = [
  'RLS_TEST_SUPABASE_URL',
  'RLS_TEST_SUPABASE_ANON_KEY',
  'RLS_TEST_SUPABASE_SERVICE_KEY',
];

/**
 * Local addresses only. `[::1]` carries its brackets because that is what
 * `new URL('http://[::1]:54321').hostname` returns — the allowlist is compared
 * against the PARSED hostname, so it has to match the parser's spelling.
 */
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

const START_HINT = 'Start the local stack and re-export them with: npx supabase start';

function fail(lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// JOB 1 — all three credentials present, and SAY WHICH ONE IS MISSING.
// "RLS_TEST_* credentials are empty" sends someone hunting through three names;
// naming the variable is the difference between a message and a diagnosis.
// ---------------------------------------------------------------------------
const missing = REQUIRED.filter((name) => !process.env[name]);

if (missing.length > 0) {
  fail([
    '',
    `RLS PREFLIGHT FAILED: ${missing.length} of ${REQUIRED.length} credential(s) are not set.`,
    '',
    ...missing.map((name) => `  MISSING  ${name}`),
    '',
    'Without all three, rlsDescribe degrades to describe.skip and this command',
    'would exit 0 with every isolation suite skipped — a pass that proved nothing.',
    '',
    START_HINT,
  ]);
}

// ---------------------------------------------------------------------------
// JOB 2 — the URL must resolve to a local host, compared with ===.
// ---------------------------------------------------------------------------
const rawUrl = process.env.RLS_TEST_SUPABASE_URL;

let hostname;
try {
  hostname = new URL(rawUrl).hostname;
} catch {
  fail([
    '',
    'RLS PREFLIGHT FAILED: RLS_TEST_SUPABASE_URL is not a parseable URL, so the',
    'host could not be checked against the local allowlist.',
    '',
    `  value: ${rawUrl}`,
    '',
    'An unparseable URL is treated as a failure rather than skipped: a host check',
    'that cannot run is not a host check.',
    '',
    START_HINT,
  ]);
}

// `===` against each entry, never `includes`. A substring test would accept
// 127.0.0.1.evil.com and localhost.attacker.net, both of which resolve off-box.
const isLocal = LOCAL_HOSTS.some((allowed) => hostname === allowed);

if (!isLocal) {
  fail([
    '',
    'RLS PREFLIGHT FAILED: RLS_TEST_SUPABASE_URL does not point at a local stack.',
    '',
    `  hostname : ${hostname}`,
    `  allowed  : ${LOCAL_HOSTS.join(', ')}`,
    '',
    'These suites WRITE: they provision real auth users, seed rows and cascade',
    'deletes on teardown. Against a remote project that is destructive, so a host',
    'outside the allowlist is refused rather than warned about.',
    '',
    'The comparison is exact. 127.0.0.1.evil.com and localhost.attacker.net both',
    'contain an allowlisted string and are both rejected here.',
  ]);
}

console.log(`RLS preflight ok — 3/3 credentials set, host ${hostname} is local.`);
