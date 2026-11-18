#!/usr/bin/env bash
# =============================================================================
# Finds failures that a PASSING test suite absorbed.
#
#   detect-masked-failures.sh [jest args...]
#
# WHY THIS EXISTS, AND WHY MIGRATION ALONE DOES NOT REPLACE IT
# =============================================================================
# A hand-rolled Supabase chain mock lists the methods the production code
# happened to call on the day it was written. When production later reaches for
# one more, the call throws `TypeError: ... is not a function` - and if that
# throw lands in a `catch` that logs and continues, NO ASSERTION EVER SEES IT.
# The test passes. The code path it claims to cover never ran.
#
# Migrating to the shared chain mock does NOT find these. Measured on
# goalService, the one confirmed instance: before migration the savings-logging
# path died on a missing `maybeSingle`; after migration the Proxy let execution
# continue, the path failed for a different reason, and production's non-fatal
# catch absorbed THAT just as completely. 23/23 passed both ways. The migration
# removes the hand-rolled SHAPE so the class cannot recur; it is not a detector.
#
# This is the detector, and it is the only thing that has ever found an instance.
#
# WHAT IT LOOKS FOR, two shapes:
#   1. `is not a function`  - a chain reaching a method the mock does not have.
#   2. `(non-fatal)`        - this codebase's marker for a deliberately
#                             swallowed best-effort failure. 30 occurrences in
#                             src, 6 files logging one. A non-fatal line in a
#                             PASSING suite means a best-effort path failed and
#                             nothing asserted on it.
#
# A SWALLOW THAT IS THE POINT OF A TEST is exempted by a marker directly above
# that it()/test():   // detector: expected-swallow — <reason>
# and the exemption must keep being USED: a marker whose test ran and produced
# no swallow is STALE and fails the run, so fixing the deliberate swallow away
# cannot leave a hiding place behind. Attribution and markers live in
# masked-failures-scan.mjs, which reads each swallow's test-file stack frame.
#
# ABSENCE ASSERTIONS FAIL OPEN, so this script is PAIRED WITH A MUST-FIND
# CONTROL. "0 masked failures" from a script that read nothing looks identical
# to "0 masked failures" from a script that worked. Before reporting a clean
# result it runs a FIXTURE that contains one of each shape and requires both to
# be found; if the fixture comes back clean the script fails instead, because at
# that point it cannot tell you anything.
#
# A RUN THAT FAILS ITS TESTS IS NOT THIS SCRIPT'S BUSINESS. Jest's own exit
# status covers that. This looks only at what a run ABSORBED.
# =============================================================================
set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="$SELF_DIR/__tests__/masked-failure-fixture.test.ts"
SCANNER="$SELF_DIR/masked-failures-scan.mjs"

# -----------------------------------------------------------------------------
# THE MUST-FIND CONTROL, first. Nothing below is admissible without it.
# -----------------------------------------------------------------------------
echo "=== must-find control: a fixture with one instance of every behaviour ==="
if [ ! -f "$FIXTURE" ]; then
  echo "::error::NOT MEASURED - the control fixture $FIXTURE is missing, so this script cannot show it detects anything. A clean result from it would mean nothing."
  exit 1
fi

CONTROL_LOG=$(mktemp)
# --testPathIgnorePatterns OVERRIDES jest.config.js's ignore of this
# fixture, which is what lets the control run at all.
npx jest "$FIXTURE" --testPathIgnorePatterns '/node_modules/' --silent=false > "$CONTROL_LOG" 2>&1 || true

# Four must-finds: an unmarked missing method, an unmarked swallow, a MARKED
# swallow explained, and a STALE marker caught. Any one missing and nothing
# below can be trusted.
if ! node "$SCANNER" --mode control "$CONTROL_LOG" | sed 's/^/  /'; then
  echo "::error::NOT MEASURED - the control fixture did not demonstrate every behaviour, so this detector is not reading what it claims to read. Fix the detector or the fixture; do NOT treat a clean scan as clean."
  echo "--- control output ---"
  tail -40 "$CONTROL_LOG"
  rm -f "$CONTROL_LOG"
  exit 1
fi
echo "  ok: all four behaviours demonstrated, so a clean scan below is meaningful"
rm -f "$CONTROL_LOG"

# -----------------------------------------------------------------------------
# THE REAL SCAN
# -----------------------------------------------------------------------------
echo
echo "=== scanning: npx jest ${*:-<whole suite>} ==="
RUN_LOG=$(mktemp)
# jest.config.js already ignores the fixture, so the real scan needs no
# exclusion of its own - one definition, in the config.
npx jest "$@" > "$RUN_LOG" 2>&1
JEST_EXIT=$?

TALLY=$(grep -E '^Tests:' "$RUN_LOG" | tail -1 || true)
echo "  jest exit : $JEST_EXIT"
echo "  ${TALLY:-<no Tests: line - the run did not summarise>}"

if [ -z "$TALLY" ]; then
  echo "::error::NOT MEASURED - the run produced no Tests: summary, so there is no run to scan."
  tail -20 "$RUN_LOG"
  rm -f "$RUN_LOG"
  exit 1
fi

echo
if ! node "$SCANNER" --mode main "$RUN_LOG"; then
  echo
  echo "::error::Masked failures, or a stale/misplaced marker. A finding is a PASSING test whose production code hit a failure path nothing asserted on - diagnose it; do not silence the log. If the swallow IS the point of the test, assert on it and mark the test (see the header)."
  rm -f "$RUN_LOG"
  exit 1
fi

echo "  none unexplained"
rm -f "$RUN_LOG"
exit 0
