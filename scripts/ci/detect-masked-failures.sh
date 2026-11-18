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
PAT_TYPEERROR='is not a function'
PAT_SWALLOWED='(non-fatal)'

scan() { # scan <logfile> -> prints matches, returns 0 if any found
  local log=$1 found=0
  if grep -qF "$PAT_TYPEERROR" "$log"; then
    found=1
    grep -nF "$PAT_TYPEERROR" "$log" | sed 's/^/    MISSING-CHAIN-METHOD  /' | head -20
  fi
  if grep -qF "$PAT_SWALLOWED" "$log"; then
    found=1
    grep -nF "$PAT_SWALLOWED" "$log" | sed 's/^/    SWALLOWED-FAILURE     /' | head -20
  fi
  return $((1 - found))
}

# -----------------------------------------------------------------------------
# THE MUST-FIND CONTROL, first. Nothing below is admissible without it.
# -----------------------------------------------------------------------------
echo "=== must-find control: a fixture containing one of each shape ==="
if [ ! -f "$FIXTURE" ]; then
  echo "::error::NOT MEASURED - the control fixture $FIXTURE is missing, so this script cannot show it detects anything. A clean result from it would mean nothing."
  exit 1
fi

CONTROL_LOG=$(mktemp)
# --testPathIgnorePatterns OVERRIDES jest.config.js's ignore of this
# fixture, which is what lets the control run at all.
npx jest "$FIXTURE" --testPathIgnorePatterns '/node_modules/' --silent=false > "$CONTROL_LOG" 2>&1 || true

CONTROL_OK=1
grep -qF "$PAT_TYPEERROR" "$CONTROL_LOG" || { echo "  control did NOT contain '$PAT_TYPEERROR'"; CONTROL_OK=0; }
grep -qF "$PAT_SWALLOWED" "$CONTROL_LOG" || { echo "  control did NOT contain '$PAT_SWALLOWED'"; CONTROL_OK=0; }

if [ "$CONTROL_OK" != "1" ]; then
  echo "::error::NOT MEASURED - the control fixture did not produce both shapes, so this detector is not reading what it claims to read. Fix the detector or the fixture; do NOT treat a clean scan as clean."
  echo "--- control output ---"
  tail -40 "$CONTROL_LOG"
  rm -f "$CONTROL_LOG"
  exit 1
fi
echo "  ok: both shapes found in the control, so a clean scan below is meaningful"
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
if scan "$RUN_LOG"; then
  echo
  echo "::error::Masked failures found. These are PASSING tests whose production code hit a failure path nothing asserted on - the path the test claims to cover did not run. Diagnose each as a finding; do not silence the log."
  rm -f "$RUN_LOG"
  exit 1
fi

echo "  none found"
rm -f "$RUN_LOG"
exit 0
