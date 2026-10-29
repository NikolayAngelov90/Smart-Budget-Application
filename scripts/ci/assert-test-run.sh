#!/usr/bin/env bash
# =============================================================================
# Asserts that a jest run ACTUALLY RAN, and optionally that it ran in a PINNED
# ORDER. One definition, consumed by every CI job that needs it.
#
#   assert-test-run.sh <log> <floor> [expected-seed]
#
# WHY THIS IS NOT INLINE IN THE WORKFLOW. Two jobs need it — the blocking
# pinned-order check and the nightly random-seed one — and the second must NOT
# assert a seed. Duplicating thirty lines of parse logic across two jobs in the
# same file is how the two drift apart; this repo already made that argument for
# the shared local-supabase action and for parseDecimalInput.
#
# =============================================================================
# WHAT IT CHECKS, AND WHY EACH CHECK EXISTS
# =============================================================================
# 1. THAT TESTS RAN AT ALL. A jest invocation matching nothing EXITS 0.
#    Measured, not assumed:
#
#      -t with a pattern matching no test name
#          exit 0,  "Tests: 2776 skipped, 2776 total"   — and NO passed count
#      a path pattern matching one file
#          exit 0,  "Tests: 24 passed, 24 total"        — 24 of 2711
#      a path pattern matching nothing
#          exit 1 — this one jest already protects
#
#    The first is the jest -t class this repo has been bitten by: a run matching
#    nothing is green and silent, which is also how a GoalCard measurement
#    reported 15 of 15 passing minutes before it reported 10 of 10 failing. The
#    second is the shape of an over-narrow testMatch or testPathIgnorePatterns.
#
# 2. THAT THE SUMMARY WAS READ, NOT GUESSED. "The summary could not be parsed"
#    is a DIFFERENT CLAIM from "zero tests passed", and a parser that defaults
#    to zero conflates them: both trip the floor today and they diverge the
#    first time jest changes its format, at which point the floor silently
#    becomes a format check. So the parse ANCHOR is the total count, never the
#    passed count — jest OMITS the passed clause at zero, so
#    "Tests: 2776 skipped, 2776 total" is a WELL-FORMED summary meaning zero,
#    but a total is always printed.
#
#      no Tests: line, or no "N total" in it   ->  NOT MEASURED, its own red
#      "N total" present, "N passed" absent    ->  genuinely zero passed
#      "N passed" present                      ->  that number, floored
#
# 3. THAT THE ORDER WAS THE PINNED ONE, when an expected seed is given. Jest
#    prints a Seed: line whenever a seed is in effect, in CI as well as a
#    terminal. This asserts what the RUN REPORTED, which is a different claim
#    from what --showConfig resolved to.
#
# A NOTE ON A FLAG THAT IS NOT USED: --showSeed is unnecessary. It was in the
# npm script for about an hour; mutation-testing showed the Seed: line prints
# without it under CI=true, so no mutation could redden the flag. By this repo's
# rule an unfalsifiable component is removed rather than kept as reassurance —
# keeping it would imply this check DEPENDS on it, which is a false claim about
# what the guard rests on.
#
# THE FLOOR IS DELIBERATELY LOW. The TGRANT floor is the reason: a tight floor
# needs maintenance every time the count legitimately moves, goes stale upward,
# and eventually fires on a legitimate change — which is how the drift check
# spent 21 days red. A low floor catches catastrophe, never needs touching, and
# makes no claim to catch small regressions. Coverage drift is codecov's job.
#
# A RUN THAT HAPPENED AND FAILED PASSES THESE CHECKS, deliberately. The test
# step owns that failure; a guard that also fails on a genuine failure is a
# second opinion on something already red.
# =============================================================================
set -euo pipefail

LOG=${1:?usage: assert-test-run.sh <log> <floor> [expected-seed]}
FLOOR=${2:?usage: assert-test-run.sh <log> <floor> [expected-seed]}
EXPECTED_SEED=${3:-}

if [ ! -f "$LOG" ]; then
  echo "::error::NOT MEASURED - the log file $LOG does not exist, so nothing can be asserted about the run."
  exit 1
fi

# ---------------------------------------------------------------- the summary
TALLY=$(grep -E '^Tests:' "$LOG" | tail -1 || true)

if [ -z "$TALLY" ]; then
  echo "::error::NOT MEASURED - no Tests: summary line in the run output at all. The floor cannot be evaluated, which is not the same as a floor of zero. Last 20 lines:"
  tail -20 "$LOG"
  exit 1
fi

TOTAL=$(printf '%s' "$TALLY" | grep -oE '[0-9]+ total' | grep -oE '[0-9]+' || true)
if [ -z "$TOTAL" ]; then
  echo "tally : $TALLY"
  echo "::error::NOT MEASURED - the Tests: line carries no 'N total', so jest has changed its summary format and this parser no longer reads it. Fix the parser; do NOT lower the floor."
  exit 1
fi

PASSED=$(printf '%s' "$TALLY" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' || true)
PASSED=${PASSED:-0}

echo "tally : $TALLY"
echo "parsed: $PASSED passed of $TOTAL total  (floor $FLOOR)"

if [ "$PASSED" -lt "$FLOOR" ]; then
  echo "::error::Only $PASSED tests passed, against a floor of $FLOOR. This is NOT a pass: a jest run that matches nothing exits 0 and reports no passed count, so a green check here would mean the suite never ran. Check for a stray -t, a narrowed testMatch, or a testPathIgnorePatterns change."
  exit 1
fi

# ------------------------------------------------------------------- the seed
SEED_LINE=$(grep -E '^Seed:' "$LOG" | tail -1 || true)
ACTUAL_SEED=$(printf '%s' "$SEED_LINE" | grep -oE '\-?[0-9]+' || true)

if [ -n "$EXPECTED_SEED" ]; then
  if [ -z "$ACTUAL_SEED" ]; then
    echo "::error::NOT MEASURED - no Seed: line in the output, so the order the suite ran in cannot be confirmed."
    exit 1
  fi
  if [ "$ACTUAL_SEED" != "$EXPECTED_SEED" ]; then
    echo "::error::The run reported seed $ACTUAL_SEED, expected $EXPECTED_SEED - so the suite did not run in the pinned order, whatever the config resolved to."
    exit 1
  fi
  echo "ok: $PASSED tests ran, in the pinned order $ACTUAL_SEED"
else
  echo "ok: $PASSED tests ran, in order ${ACTUAL_SEED:-<no seed reported>}"
fi
