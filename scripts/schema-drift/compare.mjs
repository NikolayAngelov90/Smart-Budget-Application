#!/usr/bin/env node
/**
 * Schema drift check — compares PRODUCTION's catalog against the catalog the
 * migrations produce, and fails on anything not acknowledged in
 * supabase/schema-drift-allowlist.json.
 *
 *   node scripts/schema-drift/compare.mjs <production.tsv> <migrations.tsv>
 *
 * Both files are produced by scripts/schema-drift/dump-catalog.sql — ONE query
 * file run against both databases, so a difference cannot originate in how each
 * side was read.
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * Nothing compared these two before. That is how both of the vulnerabilities
 * found on 2026-09-24 stayed invisible — one of them for six months:
 *
 *   household_members carried a policy that migration 020 explicitly DROPS,
 *   with the reason written in 020 itself: a blanket WITH CHECK (user_id =
 *   auth.uid()) lets any authenticated user insert themselves into ANY
 *   household_id and self-join as admin.
 *
 *   categories was MISSING the trg_category_visibility_owner trigger that
 *   migration 023 creates, whose whole purpose is to stop a household member
 *   changing a co-member's category visibility through the raw REST path.
 *
 * Neither is discoverable by reading the repository, because the repository is
 * correct in both cases. Only a comparison finds them.
 *
 * ============================================================================
 * STATED NON-GOAL: THIS NEVER CONSULTS supabase_migrations.schema_migrations
 * ============================================================================
 * The ledger is unreliable in BOTH directions in this project, so a "faster"
 * ledger comparison is not an available optimisation:
 *
 *   012_detected_subscriptions is RECORDED as applied and did NOTHING — it opens
 *   with CREATE TABLE IF NOT EXISTS against a table that already existed, so
 *   none of its columns landed, including a NOT NULL currency column the write
 *   path depends on.
 *
 *   20260924100000 (the security fix above) is EFFECTIVE in production and NOT
 *   RECORDED, because it was applied as raw SQL.
 *
 * Recorded and inert; effective and unrecorded. Catalogs only.
 *
 * ============================================================================
 * THE TWO DIRECTIONS ARE NOT EQUALLY SERIOUS
 * ============================================================================
 * PRODUCTION_ONLY — production has an object the migrations do not.
 *   HARD FAIL, always. Nothing in the repo explains it and nobody would find it
 *   by reading code. This is the direction both vulnerabilities arrived by.
 *
 * MIGRATIONS_ONLY — the migrations have an object production does not.
 *   PENDING, with an age. This is the normal state of every migration between
 *   being written and being applied, so failing on it would turn every migration
 *   PR red for doing exactly what a migration PR does — and a check that is red
 *   by design gets switched off. It becomes a FAILURE once it is older than
 *   PENDING_MAX_DAYS.
 *
 * MODIFIED — present on both sides and different. Hard fail unless allowlisted.
 */
import { readFileSync } from 'node:fs';

/**
 * How long an unapplied migration object may stay pending before it fails.
 *
 * SEVEN DAYS, and the reasoning matters more than the number. Migrations in this
 * project are supposed to deploy on merge (#39), so the honest expectation is
 * minutes — but in practice several have been applied by hand, including the two
 * on 2026-09-24. A day or two therefore has to be routine, or the check punishes
 * the normal path. Seven days is longer than any legitimate apply-after-merge gap
 * and shorter than the three weeks that actually elapsed while a dead cron went
 * unnoticed, so "unapplied and forgotten" surfaces inside one working week.
 *
 * Age is measured from the migration FILE's first commit on the current branch's
 * history, not from the check's run date — so a migration still in a PR is
 * simply pending and can never be overdue.
 */
const PENDING_MAX_DAYS = 7;

const [prodPath, migPath, newestMigrationEpoch] = process.argv.slice(2);
if (!prodPath || !migPath) {
  console.error('usage: compare.mjs <production.tsv> <migrations.tsv> [newest-migration-epoch-seconds]');
  process.exit(2);
}

const allowlist = JSON.parse(
  readFileSync(new URL('../../supabase/schema-drift-allowlist.json', import.meta.url), 'utf8')
);

/** Parse a dump into kind -> Map(key -> full record line). */
function parse(path) {
  const byKind = new Map();
  const text = readFileSync(path, 'utf8');
  let lines = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('\t');
    const kind = parts[0];
    if (!/^[A-Z-]+$/.test(kind)) continue; // psql noise, banners, NOTICEs
    lines++;
    if (!byKind.has(kind)) byKind.set(kind, new Map());
    // Key = everything that IDENTIFIES the object; value = the whole record, so a
    // same-key different-value pair is a MODIFIED rather than a pair of adds.
    const keyLen = { TABLE: 1, COLUMN: 1, RLS: 1, POLICY: 3, TGRANT: 3, 'TGRANT-DEFAULT': 1, CGRANT: 4, FUNCTION: 1, TRIGGER: 2 }[kind];
    const key = parts.slice(1, 1 + (keyLen ?? parts.length - 1)).join('\t');
    byKind.get(kind).set(key, parts.slice(1).join('\t'));
  }
  return { byKind, lines };
}

const prod = parse(prodPath);
const mig = parse(migPath);

// ============================================================================
// NON-VACUITY — FIRST-CLASS, CHECKED BEFORE ANY COMPARISON
// ============================================================================
// A diff over two empty catalogs reports "no drift". That is the exact failure
// mode this project hit three times in one week: a lint rule reporting 0
// violations because nothing invoked it, an RLS mutation that would have passed
// against the wrong database, and a clock parameter no caller passed. So the
// floors are data in the allowlist, and falling below one is a HARD RED — never
// a pass, and never merely a warning.
const FLOOR_KINDS = {
  tables: 'TABLE',
  columns: 'COLUMN',
  policies: 'POLICY',
  functions: 'FUNCTION',
  triggers: 'TRIGGER',
  table_grant_entries: 'TGRANT',
  column_grant_entries: 'CGRANT',
};
const floors = allowlist.non_vacuity_floors ?? {};
let vacuous = false;
const floorReport = [];
for (const [name, kind] of Object.entries(FLOOR_KINDS)) {
  const min = floors[name];
  if (typeof min !== 'number') continue;
  const p = prod.byKind.get(kind)?.size ?? 0;
  const m = mig.byKind.get(kind)?.size ?? 0;
  const bad = p < min || m < min;
  if (bad) vacuous = true;
  floorReport.push(`  ${bad ? 'BELOW FLOOR' : 'ok         '} ${kind.padEnd(16)} floor=${String(min).padEnd(5)} production=${String(p).padEnd(5)} migrations=${m}`);
}

console.log('=== non-vacuity floors ===');
console.log(floorReport.join('\n'));
if (vacuous) {
  console.error('');
  console.error('HARD FAILURE: a catalog returned fewer objects than its floor.');
  console.error('This is NOT "no drift" — it means one side was read incompletely');
  console.error('(bad credentials, a truncated dump, a stack that did not finish');
  console.error('migrating) and any comparison over it is meaningless.');
  process.exit(1);
}

// ============================================================================
// THE COMPARISON
// ============================================================================
const allowed = new Map((allowlist.allowed_drift ?? []).map((e) => [e.id, e]));
const matchedAllowlistIds = new Set();

/** An allowlist entry matches a finding when its `object` names the same thing. */
function findAllowance(kind, key, record) {
  const hay = `${kind} ${key} ${record}`.toLowerCase();
  for (const e of allowed.values()) {
    // `match` is an EXPLICIT list of required substrings, stated by whoever wrote
    // the entry. It is deliberately NOT derived from the prose `object` field: an
    // earlier version tokenised that, so words like "predicate" and "differs"
    // became requirements no catalog row could satisfy - every entry matched
    // nothing, and the test asserting "an allowlisted item stays green" passed
    // because the finding was non-fatal anyway rather than because it matched.
    const needles = Array.isArray(e.match) ? e.match : null;
    if (!needles || !needles.length) continue;
    if (needles.every((t) => hay.includes(String(t).toLowerCase()))) {
      matchedAllowlistIds.add(e.id);
      return e;
    }
  }
  return null;
}

const findings = { PRODUCTION_ONLY: [], MIGRATIONS_ONLY: [], MODIFIED: [], COSMETIC: [] };

const kinds = new Set([...prod.byKind.keys(), ...mig.byKind.keys()]);
for (const kind of [...kinds].sort()) {
  const p = prod.byKind.get(kind) ?? new Map();
  const m = mig.byKind.get(kind) ?? new Map();
  for (const [key, rec] of p) {
    if (!m.has(key)) findings.PRODUCTION_ONLY.push({ kind, key, rec });
    else if (m.get(key) !== rec) {
      // FUNCTION carries raw and normalised hashes; the pair classifies.
      if (kind === 'FUNCTION') {
        const pf = rec.split('\t');
        const mf = m.get(key).split('\t');
        const rawDiffers = pf[1] !== mf[1];
        const normDiffers = pf[2] !== mf[2];
        const secDiffers = pf[3] !== mf[3] || pf[4] !== mf[4];
        if (rawDiffers && !normDiffers && !secDiffers) {
          findings.COSMETIC.push({ kind, key, rec, other: m.get(key) });
          continue;
        }
      }
      findings.MODIFIED.push({ kind, key, rec, other: m.get(key) });
    }
  }
  for (const [key, rec] of m) if (!p.has(key)) findings.MIGRATIONS_ONLY.push({ kind, key, rec });
}

// ============================================================================
// REPORT
// ============================================================================
let hardFailures = 0;
let pending = 0;

function emit(bucket, label, fatalByDefault) {
  const items = findings[bucket];
  console.log('');
  console.log(`=== ${label} (${items.length})`);
  if (!items.length) {
    console.log('  none');
    return;
  }
  for (const f of items) {
    const a = findAllowance(f.kind, f.key, f.rec);
    if (a) {
      console.log(`  ALLOWED  ${f.kind} ${f.key}`);
      console.log(`           allowlist id: ${a.id}`);
      console.log(`           resolves when: ${a.resolves_when}`);
      continue;
    }
    if (fatalByDefault) {
      hardFailures++;
      console.log(`  FAIL     ${f.kind} ${f.key}`);
      console.log(`           production : ${f.rec}`);
      if (f.other !== undefined) console.log(`           migrations : ${f.other}`);
      console.log(`           DIRECTION  : ${bucket}`);
    } else {
      pending++;
      console.log(`  PENDING  ${f.kind} ${f.key}`);
      console.log(`           in the migrations, not yet in production`);
    }
  }
}

emit('PRODUCTION_ONLY', 'PRODUCTION HAS OBJECTS THE MIGRATIONS DO NOT — hard fail', true);
emit('MODIFIED', 'PRESENT ON BOTH SIDES AND DIFFERENT — hard fail', true);
emit('MIGRATIONS_ONLY', 'IN THE MIGRATIONS, NOT YET IN PRODUCTION — pending', false);
emit('COSMETIC', 'FUNCTION TEXT DIFFERS, BEHAVIOUR DOES NOT — cosmetic', false);

// Stale allowlist entries: an entry that no longer matches anything is resolved
// drift left behind, and a resolved item in an allowlist becomes permanent noise.
const stale = [...allowed.keys()].filter((id) => !matchedAllowlistIds.has(id));
console.log('');
console.log(`=== allowlist hygiene`);
console.log(`  entries: ${allowed.size}   matched: ${matchedAllowlistIds.size}   unmatched: ${stale.length}`);
for (const id of stale) {
  console.log(`  UNMATCHED  ${id}`);
  console.log(`             This drift no longer exists. DELETE THE ENTRY — a resolved`);
  console.log(`             item left in an allowlist becomes permanent noise, and noise`);
  console.log(`             is how allowlists stop being read.`);
}

// ---------------------------------------------------------------------------
// THE PENDING AGE GATE
// ---------------------------------------------------------------------------
// Pending is routine; pending and FORGOTTEN is a finding. A catalog object cannot
// be traced back to the migration file that defines it, so age is measured from
// the NEWEST migration file's commit time: if the most recent migration is older
// than PENDING_MAX_DAYS and production still lacks objects the migrations define,
// this is not a deploy in flight.
let pendingOverdue = false;
if (pending > 0 && newestMigrationEpoch) {
  const ageDays = (Date.now() / 1000 - Number(newestMigrationEpoch)) / 86400;
  console.log('');
  console.log('=== pending age');
  console.log(`  newest migration file is ${ageDays.toFixed(1)} days old; threshold ${PENDING_MAX_DAYS}`);
  if (ageDays > PENDING_MAX_DAYS) {
    pendingOverdue = true;
    console.log(`  OVERDUE - ${pending} object(s) the migrations define are still absent`);
    console.log(`  from production, and no migration has landed in ${PENDING_MAX_DAYS} days.`);
    console.log('  Either apply them, or allowlist them with a resolves_when.');
  } else {
    console.log('  within threshold - a deploy in flight looks exactly like this');
  }
}

console.log('');
console.log('================ RESULT ================');
console.log(`hard failures : ${hardFailures}`);
console.log(`pending       : ${pending}   (fail once older than ${PENDING_MAX_DAYS} days — see PENDING_MAX_DAYS)`);
console.log(`unmatched allowlist entries: ${stale.length}`);

if (pendingOverdue) {
  console.error('');
  console.error(`DRIFT CHECK FAILED: pending objects are overdue (> ${PENDING_MAX_DAYS} days).`);
  process.exit(1);
}
if (hardFailures > 0) {
  console.error('');
  console.error(`DRIFT CHECK FAILED: ${hardFailures} unacknowledged difference(s).`);
  console.error('Either fix the difference, or add it to supabase/schema-drift-allowlist.json');
  console.error('WITH a resolves_when — an entry with no exit is a permanent exemption');
  console.error('pretending to be a temporary one.');
  process.exit(1);
}
console.log('');
console.log('DRIFT CHECK PASSED.');
process.exit(0);
