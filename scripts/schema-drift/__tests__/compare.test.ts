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
function run(prodLines: string[], migLines: string[]): { code: number; out: string } {
  const p = join(dir, 'production.tsv');
  const m = join(dir, 'migrations.tsv');
  writeFileSync(p, prodLines.join('\n') + '\n');
  writeFileSync(m, migLines.join('\n') + '\n');
  try {
    const out = execFileSync('node', [SCRIPT, p, m], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status: number; stdout?: string; stderr?: string };
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

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
