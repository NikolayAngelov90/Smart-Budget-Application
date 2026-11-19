#!/usr/bin/env node
// =============================================================================
// The scanning half of detect-masked-failures.sh: reads a jest log, attributes
// every swallowed failure to the TEST that produced it, and honours markers.
//
//   node masked-failures-scan.mjs --mode main|control <jest-log>
//
// ATTRIBUTION. Jest prints each console call as a block whose stack includes a
// frame inside the test file, with a line number:
//
//     at Object.<anonymous> (src/lib/services/__tests__/goalService.test.ts:284:20)
//
// That line falls inside exactly one it()/test() call, so one run attributes
// every swallow to its test with no re-runs. EVERY test-file frame in the
// stack counts, not just the first: a helper defined in the test file sits
// between the service and the it() body, and the first frame is then the
// helper - outside the test's range. (The must-find control caught exactly
// that on this script's first run.) A signature line with NO test-file
// frame (an async boundary can drop it) cannot be attributed and is reported as
// a finding: unattributable is never quietly explained.
//
// THE MARKER. A test that triggers a swallow ON PURPOSE, and asserts on it,
// says so directly above its it()/test():
//
//     // detector: expected-swallow — <why this swallow is the point of the test>
//
// A swallow attributed inside a marked test is EXPLAINED, not a finding.
//
// THE OBLIGATION RUNS BOTH WAYS. A marker in a file that ran but explained NO
// swallow is STALE, and a stale marker FAILS the run. Without this, fixing the
// deliberate swallow away would leave a marker behind - a permanent hiding place
// for the next real masked failure in that test. This is the drift allowlist's
// two-part non-vacuity applied per entry: an exemption must keep being USED.
// A marker without a reason, or not attached to a test, also fails.
// =============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const PAT_TYPEERROR = 'is not a function';
const PAT_SWALLOWED = '(non-fatal)';
const MARKER = /detector:\s*expected-swallow\b(.*)$/;
const ROOT = process.cwd();

const args = process.argv.slice(2);
const mode = args[args.indexOf('--mode') + 1];
const logPath = args[args.length - 1];
if (!['main', 'control'].includes(mode) || !existsSync(logPath)) {
  console.error('usage: masked-failures-scan.mjs --mode main|control <jest-log>');
  process.exit(2);
}

const norm = (p) => path.relative(ROOT, path.resolve(ROOT, p)).split(path.sep).join('/');

// ---------------------------------------------------------------- parse the log
const lines = readFileSync(logPath, 'utf8').split(/\r?\n/);
const ranFiles = new Set();
const blocks = []; // { start, kind: Set, frames: [{ file, line }] }
let cur = null;
const START = /^\s+console\.(error|warn|log|info|debug)\s*$/;
// A failure report (`  ● name`) is jest's own business, never part of a console
// block: without this boundary its text would be attributed to the block above.
const BOUNDARY = /^(PASS|FAIL) |^Test Suites:|^Tests:|^\s+● /;
const TESTFRAME = /\(([^()]*?__tests__[^()]*?\.test\.tsx?):(\d+):\d+\)/g;
const orphans = []; // signature lines outside any console block

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const pf = l.match(/^(PASS|FAIL) (\S+)/);
  if (pf) ranFiles.add(norm(pf[2]));
  if (START.test(l) || BOUNDARY.test(l)) {
    if (cur) blocks.push(cur);
    cur = START.test(l) ? { start: i + 1, kind: new Set(), frames: [] } : null;
    continue;
  }
  const sig = [];
  if (l.includes(PAT_TYPEERROR)) sig.push('MISSING-CHAIN-METHOD');
  if (l.includes(PAT_SWALLOWED)) sig.push('SWALLOWED-FAILURE');
  if (cur) {
    sig.forEach((s) => cur.kind.add(s));
    for (const m of l.matchAll(TESTFRAME))
      cur.frames.push({ file: norm(m[1]), line: Number(m[2]) });
  } else if (sig.length) {
    orphans.push({ line: i + 1, kind: sig.join('+'), text: l.trim() });
  }
}
if (cur) blocks.push(cur);
const hits = blocks.filter((b) => b.kind.size > 0);

// -------------------------------------------------- markers in the files that ran
const markers = []; // { file, name, from, to, reason, explained }
const problems = [];
for (const file of ranFiles) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  const rawCount = text.split('\n').filter((l) => MARKER.test(l)).length;
  if (!rawCount) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let attached = 0;
  const visit = (node) => {
    if (
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      ['it', 'test'].includes(node.expression.expression.text)
    ) {
      for (const c of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
        const m = text.slice(c.pos, c.end).match(MARKER);
        if (!m) continue;
        attached++;
        const reason = m[1].replace(/^[\s—–-]+/, '').trim();
        const arg = node.expression.arguments[0];
        markers.push({
          file,
          name: arg && ts.isStringLiteralLike(arg) ? arg.text : '<unnamed>',
          from: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          to: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
          reason,
          explained: 0,
        });
        if (!reason) problems.push(`MARKER WITHOUT A REASON  ${file}: "${markers.at(-1).name}"`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (attached !== rawCount) {
    problems.push(
      `MISPLACED MARKER  ${file}: ${rawCount} marker line(s), ${attached} attached to an it()/test(). ` +
        'A marker must sit directly above the test it exempts.'
    );
  }
}

// -------------------------------------------------------------------- explain
const findings = [];
for (const h of hits) {
  const m = markers.find((k) =>
    h.frames.some((f) => f.file === k.file && f.line >= k.from && f.line <= k.to)
  );
  if (m) m.explained++;
  else findings.push(h);
}
const stale = markers.filter((m) => m.explained === 0);

// --------------------------------------------------------------------- report
const kinds = (b) => [...b.kind].join('+');
for (const f of findings) {
  // The LAST test-file frame is the outermost - the it() body itself.
  const o = f.frames.at(-1);
  const at = o ? `${o.file}:${o.line}` : 'UNATTRIBUTABLE (no test-file frame)';
  console.log(`    ${kinds(f).padEnd(40)} log:${f.start}  ${at}`);
}
for (const o of orphans)
  console.log(
    `    ${o.kind.padEnd(40)} log:${o.line}  OUTSIDE ANY CONSOLE BLOCK: ${o.text.slice(0, 120)}`
  );
for (const m of markers.filter((k) => k.explained)) {
  console.log(
    `    explained by marker (${m.explained})  ${m.file}:${m.from} "${m.name}" - ${m.reason}`
  );
}
for (const s of stale) {
  console.log(
    `    STALE MARKER  ${s.file}:${s.from} "${s.name}" ran and produced NO swallow. Remove the marker: an exemption nothing uses is a hiding place.`
  );
}
problems.forEach((p) => console.log(`    ${p}`));

const count = (k) =>
  findings.filter((f) => f.kind.has(k)).length + orphans.filter((o) => o.kind.includes(k)).length;
const summary = {
  ranFiles: ranFiles.size,
  missingChainMethod: count('MISSING-CHAIN-METHOD'),
  swallowedFailure: count('SWALLOWED-FAILURE'),
  explained: markers.reduce((n, m) => n + m.explained, 0),
  markers: markers.length,
  stale: stale.length,
  problems: problems.length,
};
console.log(`SUMMARY ${JSON.stringify(summary)}`);

if (mode === 'control') {
  // Every behaviour of this script is a MUST-FIND here. The fixture contains one
  // instance of each; if any count comes back zero the script cannot be trusted.
  const want = {
    missingChainMethod: summary.missingChainMethod >= 1,
    swallowedFailure: summary.swallowedFailure >= 1,
    explained: summary.explained >= 1,
    stale: summary.stale === 1,
  };
  const bad = Object.entries(want)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  if (bad.length) {
    console.log(`CONTROL FAILED: ${bad.join(', ')} not demonstrated`);
    process.exit(1);
  }
  process.exit(0);
}
process.exit(findings.length || orphans.length || stale.length || problems.length ? 1 : 0);
