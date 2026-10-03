/**
 * @jest-environment node
 */

/**
 * The drift check's own guard.
 *
 * WHY IT IS TESTED WITH FIXTURES RATHER THAN AGAINST A DATABASE. The real run in
 * CI proves the check works against the live pair. It cannot prove the check
 * FAILS when it should, because that would mean introducing real drift into
 * production. So the direction that matters — does it go red — is mutation-tested
 * here against synthetic catalogs, where a difference can be planted exactly.
 *
 * The three things a drift check can get wrong, each asserted:
 *   1. pass when production has something the migrations do not  (the direction
 *      both 2026-09-24 vulnerabilities arrived by)
 *   2. fail on an acknowledged difference (which gets the check disabled)
 *   3. pass while comparing nothing (a truncated or unauthenticated read)
 *
 * MUTATION RECORD — each planted, run, observed, reverted. These are not
 * hypothetical: every case below is produced by editing a fixture and asserting
 * the exit code, so a regression in the comparator turns this suite red.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts', 'schema-drift', 'compare.mjs');

/**
 * A catalog large enough to clear the allowlist's non-vacuity floors, so a test
 * about DRIFT is never accidentally a test about the floors.
 * Floors: tables 20, columns 180, policies 60, functions 20, triggers 10,
 *         TGRANT 300, CGRANT 1200.
 */
function baseline(): string[] {
  const lines: string[] = [];
  for (let t = 0; t < 26; t++) {
    const tbl = `t${String(t).padStart(2, '0')}`;
    lines.push(`TABLE\t${tbl}`);
    lines.push(`RLS\t${tbl}\ttrue\tfalse`);
    for (let c = 0; c < 8; c++) {
      lines.push(`COLUMN\t${tbl}.c${c}\tuuid\tfalse\t-`);
    }
    for (let p = 0; p < 3; p++) {
      lines.push(`POLICY\t${tbl}\tpol${p}\tSELECT\tPUBLIC\t(uid = user_id)\tNULL`);
    }
    for (const role of ['anon', 'authenticated']) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER', 'TRUNCATE']) {
        lines.push(`TGRANT\t${tbl}\t${role}\t${priv}`);
      }
      for (let c = 0; c < 8; c++) {
        for (const priv of ['SELECT', 'INSERT', 'UPDATE']) {
          lines.push(`CGRANT\t${tbl}\tc${c}\t${role}\t${priv}`);
        }
      }
    }
  }
  for (let f = 0; f < 26; f++) {
    lines.push(`FUNCTION\tpublic.fn${f}()\traw${f}\tnorm${f}\tfalse\tsearch_path=public`);
  }
  for (let g = 0; g < 12; g++) {
    lines.push(`TRIGGER\tt00\ttrg${g}\ttrgmd5${g}`);
  }
  // Environment records. server_version_num is REQUIRED — the comparator treats
  // its absence as a hard failure, because an assertion that cannot run is not an
  // assertion. Values are production's real ones as of 2026-09-24.
  lines.push('SETTING\tserver_version_num\t170006');
  lines.push('SETTING\tserver_version\t17.6');
  lines.push('SETTING\tsearch_path\t"$user", public, extensions');
  lines.push('SETTING\tTimeZone\tUTC');
  lines.push('SETTING\trow_security\ton');
  lines.push('DBPROPS\tcollation\tencoding=UTF8 collate=en_US.UTF-8 ctype=en_US.UTF-8 locale_provider=i');
  lines.push('EXTENSION\tuuid-ossp\t1.1 schema=extensions');
  lines.push('EXTENSION\tpgcrypto\t1.3 schema=extensions');
  return lines;
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drift-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Run the comparator; returns { code, out }. Never throws on non-zero. */
function run(
  prodLines: string[],
  migLines: string[],
  newestMigrationEpoch?: number
): { code: number; out: string } {
  const p = join(dir, 'production.tsv');
  const m = join(dir, 'migrations.tsv');
  writeFileSync(p, prodLines.join('\n') + '\n');
  writeFileSync(m, migLines.join('\n') + '\n');
  const args = [SCRIPT, p, m];
  if (newestMigrationEpoch !== undefined) args.push(String(newestMigrationEpoch));
  try {
    const out = execFileSync('node', args, { encoding: 'utf8' });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status: number; stdout?: string; stderr?: string };
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('schema drift check — server version', () => {
  it('HARD FAILS on a Postgres major-version mismatch, naming both versions', () => {
    // THE ASSERTION THAT EXISTS BECAUSE THE FIRST MISMATCH WAS FOUND BY ACCIDENT.
    // Local 15 against production 17 surfaced only as 52 phantom grant
    // differences, because PG17 happened to add the MAINTAIN privilege and
    // aclexplode happened to show it. A version difference that changed behaviour
    // without changing the catalog's shape would have been invisible.
    const mig = baseline().map((l) =>
      l === 'SETTING\tserver_version_num\t170006' ? 'SETTING\tserver_version_num\t150008' : l
    );
    const { code, out } = run(baseline(), mig);
    expect(out).toContain('Postgres version mismatch');
    // Both values named: "local 15, production 17" is actionable, "versions
    // differ" sends someone hunting.
    expect(out).toContain('local 15');
    expect(out).toContain('production 17');
    expect(code).toBe(1);
  });

  it('HARD FAILS when the version record is missing, rather than skipping the check', () => {
    // Absence is as fatal as a mismatch. An assertion that silently does not run
    // is the failure mode this project hit three times in one week.
    const prod = baseline().filter((l) => !l.startsWith('SETTING\tserver_version_num'));
    const { code, out } = run(prod, baseline());
    expect(out).toContain('version assertion did not run');
    expect(code).toBe(1);
  });

  /**
   * Replace the version records on one side. The assertion reads ONLY the numeric
   * form, so `dotted` exists for fidelity with a real dump rather than for the
   * comparison — see the note on `pretty` in compare.mjs.
   */
  function withVersion(lines: string[], num: string, dotted: string): string[] {
    return lines.map((l) => {
      if (l === 'SETTING\tserver_version_num\t170006') return `SETTING\tserver_version_num\t${num}`;
      if (l === 'SETTING\tserver_version\t17.6') return `SETTING\tserver_version\t${dotted}`;
      return l;
    });
  }

  it('a MINOR mismatch still RUNS the comparison and reports what it found', () => {
    // THE REGRESSION THAT COST THREE DAYS. On 2026-10-01 the CLI's Postgres image
    // moved 17.6 -> 17.11 while production stayed on 17.6. The assertion sat
    // BEFORE the comparison and aborted, so three consecutive daily runs failed
    // without comparing a single catalog object: production could have grown an
    // open policy on every one of those days and the check would have said
    // nothing. An assertion placed before the work converts any false positive on
    // the assertion into total blindness.
    //
    // So the planted drift here is a PRODUCTION_ONLY policy — the dangerous
    // direction, the one both 2026-09-24 vulnerabilities arrived by — and it must
    // appear in the output DESPITE the version difference.
    const prod = [
      ...baseline(),
      'POLICY\tt00\tdanger_open_to_all\tSELECT\tPUBLIC\ttrue\tNULL',
    ];
    const mig = withVersion(baseline(), '170011', '17.11');

    const { code, out } = run(prod, mig);

    // The comparison ran...
    expect(out).toContain('================ RESULT ================');
    // ...and found the thing that matters.
    expect(out).toContain('danger_open_to_all');
    expect(out).toContain('PRODUCTION HAS OBJECTS THE MIGRATIONS DO NOT');
    expect(code).toBe(1);
  });

  it('BOTH results are stated when the schema and the version differ together', () => {
    // "Fail at the end with both results stated." A run that reported only the
    // first reason would get the version pinned, go green on the next run, and
    // the policy would still be there — fixed one surprise into another.
    const prod = [
      ...baseline(),
      'POLICY\tt00\tdanger_open_to_all\tSELECT\tPUBLIC\ttrue\tNULL',
    ];
    const mig = withVersion(baseline(), '170011', '17.11');

    const { code, out } = run(prod, mig);

    expect(out).toContain('unacknowledged difference(s)');
    expect(out).toContain('Postgres minor-version mismatch');
    expect(code).toBe(1);
  });

  it('a MINOR mismatch FAILS rather than passing with a warning', () => {
    // Identical catalogs, versions one patch apart. A green run with a warning in
    // it is a green run, and nobody reads one — this project's own rule about a
    // job whose healthy state is indistinguishable from its dead state.
    const { code, out } = run(baseline(), withVersion(baseline(), '170011', '17.11'));

    expect(out).toContain('MINOR MISMATCH');
    expect(out).toContain('local 17.11');
    expect(out).toContain('production 17.6');
    // Named consequence, not a bare mismatch: the reader must know which side to move.
    expect(out).toContain('production moved');
    expect(out).toContain('our pin moved');
    expect(out).not.toContain('DRIFT CHECK PASSED');
    expect(code).toBe(1);
  });

  it('a MAJOR mismatch aborts BEFORE the comparison, on purpose', () => {
    // The other half of the split, and it has to be asserted rather than assumed:
    // across majors the privilege sets and system views differ, so the comparison
    // would be garbage, and printing garbage is worse than printing nothing. If
    // this ever starts reaching the RESULT block, the abort has been lost.
    const { code, out } = run(baseline(), withVersion(baseline(), '150008', '15.8'));

    expect(out).toContain('Postgres version mismatch');
    expect(out).not.toContain('================ RESULT ================');
    expect(code).toBe(1);
  });

  it('reports other environment differences without failing', () => {
    // Classification, not remediation. Most of these cannot affect what the RLS
    // suite proves; the ones that can should be named rather than found by
    // accident a fourth time.
    const mig = baseline().map((l) =>
      l.startsWith('DBPROPS\tcollation')
        ? 'DBPROPS\tcollation\tencoding=UTF8 collate=C ctype=C locale_provider=c'
        : l
    );
    const { code, out } = run(baseline(), mig);
    expect(out).toContain('ENVIRONMENT AXES THAT DIFFER');
    expect(out).toContain('locale_provider');
    expect(out).toContain('DRIFT CHECK PASSED');
    expect(code).toBe(0);
  });
});

describe('schema drift check', () => {
  it('passes when the two catalogs agree', () => {
    // The acceptance condition. If this cannot be made to pass, the check is
    // red on the day it lands and gets disabled within a week.
    const { code, out } = run(baseline(), baseline());
    expect(out).toContain('DRIFT CHECK PASSED');
    expect(code).toBe(0);
  });

  it('FAILS when production has a policy the migrations do not', () => {
    // THE DIRECTION BOTH VULNERABILITIES ARRIVED BY. household_members carried
    // "Users can join as themselves", which migration 020 explicitly drops.
    const prod = baseline();
    prod.push('POLICY\tt00\tUsers can join as themselves\tINSERT\tPUBLIC\tNULL\t(user_id = uid)');
    const { code, out } = run(prod, baseline());
    expect(out).toContain('PRODUCTION HAS OBJECTS THE MIGRATIONS DO NOT');
    expect(out).toContain('Users can join as themselves');
    expect(code).toBe(1);
  });

  it('FAILS when production is missing a trigger the migrations create', () => {
    // The second one: categories lacked trg_category_visibility_owner entirely.
    // Missing-in-production is reported as PENDING by direction, so this asserts
    // the pending path is REACHED rather than the object being silently dropped.
    const mig = baseline();
    mig.push('TRIGGER\tcategories\ttrg_category_visibility_owner\tabc123');
    const { code, out } = run(baseline(), mig);
    expect(out).toContain('IN THE MIGRATIONS, NOT YET IN PRODUCTION');
    expect(out).toContain('trg_category_visibility_owner');
    // Pending is visible but not fatal — a migration between writing and
    // applying is the normal state, and failing on it turns every migration PR
    // red for doing its job.
    expect(code).toBe(0);
  });

  it('FAILS when a policy predicate differs on both sides', () => {
    const prod = baseline();
    const mig = baseline();
    const i = mig.findIndex((l) => l.startsWith('POLICY\tt00\tpol0'));
    mig[i] = 'POLICY\tt00\tpol0\tSELECT\tPUBLIC\t(true)\tNULL';
    const { code, out } = run(prod, mig);
    expect(out).toContain('PRESENT ON BOTH SIDES AND DIFFERENT');
    expect(code).toBe(1);
  });

  it('FAILS when RLS is switched off in production but on in the migrations', () => {
    // A table with perfect policies and RLS disabled has no protection, and the
    // policy list alone cannot show it.
    const prod = baseline().map((l) => (l === 'RLS\tt00\ttrue\tfalse' ? 'RLS\tt00\tfalse\tfalse' : l));
    const { code, out } = run(prod, baseline());
    expect(out).toContain('PRESENT ON BOTH SIDES AND DIFFERENT');
    expect(code).toBe(1);
  });

  it('classifies a comment-only function difference as COSMETIC, not a failure', () => {
    // raw hash differs, normalised matches, security properties match. This is
    // the real state of patch_user_preferences and record_feature_activity:
    // production's stored body lacks the migration file's inline comments.
    const prod = baseline().map((l) =>
      l.startsWith('FUNCTION\tpublic.fn0()') ? 'FUNCTION\tpublic.fn0()\tRAWDIFF\tnorm0\tfalse\tsearch_path=public' : l
    );
    const { code, out } = run(prod, baseline());
    expect(out).toContain('BEHAVIOUR DOES NOT');
    expect(code).toBe(0);
  });

  it('FAILS when a function body differs BEHAVIOURALLY', () => {
    // normalised hash differs — that is a real change, never cosmetic.
    const prod = baseline().map((l) =>
      l.startsWith('FUNCTION\tpublic.fn0()') ? 'FUNCTION\tpublic.fn0()\tRAWDIFF\tNORMDIFF\tfalse\tsearch_path=public' : l
    );
    const { code, out } = run(prod, baseline());
    expect(out).toContain('PRESENT ON BOTH SIDES AND DIFFERENT');
    expect(code).toBe(1);
  });

  it('FAILS when search_path is pinned on one side only', () => {
    // seed_user_categories' actual drift: production pins search_path, the
    // migrations do not, so applying forward would REGRESS 038's hardening. Same
    // body would not save it — proconfig is compared separately for this reason.
    const mig = baseline().map((l) =>
      l.startsWith('FUNCTION\tpublic.fn0()') ? 'FUNCTION\tpublic.fn0()\traw0\tnorm0\tfalse\t(none)' : l
    );
    const { code, out } = run(baseline(), mig);
    expect(out).toContain('PRESENT ON BOTH SIDES AND DIFFERENT');
    expect(code).toBe(1);
  });

  it('stays GREEN for a difference that is on the allowlist', () => {
    // The other half of the mutation. An acknowledged difference must not fail,
    // or the check is red by design and gets switched off.
    //
    // THIS TEST USED TO PASS FOR THE WRONG REASON. Its first version put the
    // difference on the MIGRATIONS side, which is PENDING and so exits 0 whatever
    // the allowlist says — it would have passed with the allowlist EMPTY and
    // proved nothing about matching. It now uses a MODIFIED case, fatal by
    // default, and asserts the word ALLOWED rather than inferring consent from a
    // zero exit code.
    //
    // The real entry: wishlist_items' UPDATE policy, whose WITH CHECK validates
    // category ownership in production and does not in the migrations.
    const prod = baseline();
    const mig = baseline();
    const head = 'POLICY\twishlist_items\tUsers can update their own wishlist items\tUPDATE';
    prod.push(`${head}\tPUBLIC\t(uid = user_id)\t(uid = user_id AND category_id IN (...))`);
    mig.push(`${head}\tPUBLIC\t(uid = user_id)\t(uid = user_id)`);
    const { code, out } = run(prod, mig);
    expect(out).toContain('ALLOWED');
    expect(out).toContain('wishlist-update-with-check');
    expect(out).toContain('DRIFT CHECK PASSED');
    expect(code).toBe(0);
  });

  it('that allowlist result is NOT automatic — the same shape fails with no matching entry', () => {
    // Non-vacuity for the allowlist path itself. An unacknowledged MODIFIED
    // policy on a table no entry mentions must be a hard fail, which is what
    // makes the ALLOWED above meaningful rather than a default.
    const prod = baseline();
    const mig = baseline();
    const head = 'POLICY\tsome_untracked_table\tsome policy\tUPDATE';
    prod.push(`${head}\tPUBLIC\t(uid = user_id)\t(strict)`);
    mig.push(`${head}\tPUBLIC\t(uid = user_id)\t(loose)`);
    const { code, out } = run(prod, mig);
    expect(out).toContain('PRESENT ON BOTH SIDES AND DIFFERENT');
    expect(code).toBe(1);
  });

  it('a COSMETIC difference is NOT counted as pending, so it cannot trip the age gate', () => {
    // FOUND 2026-10-03, on the first run of the comparison the version abort had
    // been skipping. COSMETIC shared the `pending` branch with MIGRATIONS_ONLY, so
    // a function present on BOTH sides with an identical normalised body was
    // counted as pending, printed as "not yet in production", and then reported by
    // the age gate as "absent from production" — three false statements about an
    // object that is fine. Real instances: patch_user_preferences and
    // record_feature_activity.
    //
    // The epoch here is 60 days old, so if cosmetic still fed `pending` the age
    // gate would fire and this run would be red.
    const sixtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 86400;
    const prod = baseline().map((l) =>
      l.startsWith('FUNCTION\tpublic.fn0()')
        ? 'FUNCTION\tpublic.fn0()\traw0-with-a-comment\tnorm0\tfalse\tsearch_path=public'
        : l
    );

    const { code, out } = run(prod, baseline(), sixtyDaysAgo);

    expect(out).toContain('FUNCTION TEXT DIFFERS, BEHAVIOUR DOES NOT');
    expect(out).toContain('cosmetic      : 1');
    expect(out).toContain('pending       : 0');
    // The age gate must not have run at all: it is gated on pending > 0.
    expect(out).not.toContain('=== pending age');
    expect(out).not.toContain('OVERDUE');
    expect(out).toContain('DRIFT CHECK PASSED');
    expect(code).toBe(0);
  });

  it('a genuinely pending object DOES trip the age gate, and the gate names its date', () => {
    // Non-vacuity for the test above: if nothing could trip the gate, "cosmetic
    // does not trip it" would prove nothing. A migrations-only POLICY is the real
    // pending shape.
    //
    // The date is asserted because the epoch itself was wrong in CI from the day
    // this check shipped until 2026-10-03 — a shallow checkout made every
    // `git log -1 -- <file>` return the tip commit — and an age in days alone
    // looked plausible throughout. A printed date names the wrong commit on sight.
    const sixtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 86400;
    const mig = [
      ...baseline(),
      'POLICY\tt00\tnot_deployed_yet\tSELECT\tPUBLIC\t(uid = user_id)\tNULL',
    ];

    const { code, out } = run(baseline(), mig, sixtyDaysAgo);

    expect(out).toContain('pending       : 1');
    expect(out).toContain('=== pending age');
    expect(out).toContain(`epoch given: ${sixtyDaysAgo}`);
    expect(out).toContain('OVERDUE');
    expect(code).toBe(1);
  });

  it('HARD FAILS on a truncated catalog rather than reporting no drift', () => {
    // THE FAILURE MODE THIS PROJECT HIT THREE TIMES IN ONE WEEK: an instrument
    // that reports agreement because it compared nothing. Bad credentials, a
    // half-finished migration run and a dropped connection all look like this.
    const truncated = baseline().slice(0, 40);
    const { code, out } = run(truncated, baseline());
    expect(out).toContain('BELOW FLOOR');
    expect(out).toContain('HARD FAILURE');
    expect(out).not.toContain('DRIFT CHECK PASSED');
    expect(code).toBe(1);
  });

  it('HARD FAILS when BOTH catalogs are empty', () => {
    // Two empty files agree perfectly. Without the floors this is a pass.
    const { code, out } = run([], []);
    expect(out).toContain('HARD FAILURE');
    expect(code).toBe(1);
  });

  it('reports an allowlist entry that no longer matches anything', () => {
    // Resolved drift left behind becomes permanent noise, and noise is how
    // allowlists stop being read. Not fatal — it is hygiene, not a breach.
    const { out } = run(baseline(), baseline());
    expect(out).toContain('allowlist hygiene');
    expect(out).toContain('UNMATCHED');
  });
});
