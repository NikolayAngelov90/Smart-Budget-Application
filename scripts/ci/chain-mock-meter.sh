#!/usr/bin/env bash
# =============================================================================
# The hand-rolled-chain lint rule, run as a METER: how many violations remain.
#
#   chain-mock-meter.sh [--files]
#
# Until the count reaches 0 the rule cannot be in the lint gate (it would fail
# it), so it runs here, from the SAME definition the gate will extend:
# scripts/ci/chain-mock-rule.json. The meter IS the census - every regex census
# of this class was wrong at least once, and these selectors found a file all of
# them missed.
#
# It is PAIRED: before counting the codebase it lints two fixtures and requires
# exactly 6 hits on the must-find (one per shape) and 0 on the must-not-find
# (look-alikes). A selector that matches nothing reads exactly like a codebase
# that has nothing, so a count without those two is NOT MEASURED.
# =============================================================================
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
CFG=scripts/ci/chain-mock-rule.json
FX=scripts/ci/__lint-fixtures__
MSG='Hand-rolled Supabase chain'

lint() {
  npx eslint --no-eslintrc -c "$CFG" --parser @typescript-eslint/parser \
    --ext .ts,.tsx -f unix "$@" 2>/dev/null | grep -F "$MSG"
}

mf=$(lint --no-ignore "$FX/chain-shapes.must-find.test.ts" | wc -l)
mnf=$(lint --no-ignore "$FX/chain-shapes.must-not-find.test.ts" | wc -l)
echo "must-find: $mf (want 6)   must-not-find: $mnf (want 0)"
if [ "$mf" != "6" ] || [ "$mnf" != "0" ]; then
  echo "::error::NOT MEASURED - the selectors do not discriminate; a count from them means nothing."
  exit 1
fi

OUT=$(mktemp)
# Scope: src/ AND the root __tests__/. The lint gate's src/-only scope cannot
# see the root suite; item 5 widens it.
lint src __tests__ > "$OUT"

# One repo-relative, forward-slash path per violation. (Windows unix-format
# lines start with a drive letter, so the path is everything before the
# LAST :line:col: pair.)
paths() {
  node -e '
    const lines = require("fs").readFileSync(process.argv[1], "utf8").split(/\r?\n/).filter(Boolean);
    for (const l of lines) {
      const m = l.match(/^(.*\.tsx?):\d+:\d+: /);
      if (!m) continue;
      const p = m[1].split(String.fromCharCode(92)).join("/");
      const i = p.indexOf("Smart-Budget-Application/");
      console.log(i >= 0 ? p.slice(i + "Smart-Budget-Application/".length) : p);
    }' "$OUT"
}

n=$(grep -c . "$OUT" || true)
nf=$(paths | sort -u | grep -c . || true)
echo "VIOLATIONS: $n in $nf files"
if [ "${1:-}" = "--files" ]; then
  paths | sort | uniq -c | sort -rn
fi
rm -f "$OUT"
