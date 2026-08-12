---
title: 'Fixed ÷3 month-bucket averages for budget baselines (epic-14 retro action 3)'
type: 'refactor'
created: '2026-07-02'
status: 'done'
baseline_commit: 'ef12fa9d1985d7605134c5c0e8cec537617a9b21'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-14-retro-2026-07-02.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every "3-month average" budget baseline (nudges, forecasts, what-if simulator) is a mean over months PRESENT, so one spike month reads as the user's "usual" monthly spend — inflating baselines and savings projections (14-4 review finding; decided at the epic-14 retro §5).

**Approach:** One shared helper — fixed-window monthly average (sum over the window ÷ 3) — consumed by exactly the three budget-baseline sites: the nudge helper, `forecastEngine`, and the `/api/what-if` averages. Users with <3 months of history get conservative (smaller) baselines — the retro-accepted trade-off.

## Boundaries & Constraints

**Always:**
- ONE helper in `src/lib/ai/spendingAnalysis.ts` (`AVERAGE_WINDOW_MONTHS = 3`); consumers never divide inline.
- Users with 3 full months of history see byte-identical values (sum/3 ≡ mean of 3).
- Empty input → 0 (preserves every "no baseline → no nudge/at-risk" guard).
- `calculateMean` itself is untouched — other consumers keep their semantics.

**Ask First:** extending the change to `recoveryPlanner` (ADR-025 marked recovery plans Ask-First; it also uses historical MIN), `insightRules` budget-recommendation (≥2-month self-guard, writes persisted insights), or seasonal/reengagement/patternDetection (different windows by design).

**Never:** touching annualized projections (11-4 — discloses `months_analyzed` in copy); changing `budgetResolver` (it consumes whatever baseline it's handed); behavior changes for 3-full-month users.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Spike month | monthTotals `[900]` (1 of 3 months had spend) | average 300 — not 900 | N/A |
| Two months | `[300, 500]` | 266.67 (round2 at call sites) | N/A |
| Full window | `[a, b, c]` | identical to `calculateMean([a,b,c])` | N/A |
| No history | `[]` | 0 → downstream guards fire (no nudge, no at-risk, category excluded from simulator) | N/A |
| Nudge for a 1-month user | current spend near last month's total | nudge fires EARLIER (baseline ≈ ⅓) — accepted trade-off, copy still says "usual monthly average" | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/ai/spendingAnalysis.ts:34` -- `calculateMean` (helper lives beside it)
- `src/app/api/transactions/route.ts:511-517` -- nudge helper's monthMap → mean
- `src/lib/ai/forecastEngine.ts:74-80` -- per-category monthlyTotals → mean (feeds resolveBudget fallback)
- `src/app/api/what-if/route.ts:118-126` -- simulator averages
- `src/lib/ai/__tests__/forecastEngine.test.ts` -- expected averages/at-risk values change for <3-month fixtures
- `src/app/api/what-if/__tests__/route.test.ts` -- expected averages change (400→266.67, 90→30, 200→66.67)
- `src/lib/ai/__tests__/*spendingAnalysis*` -- home for new helper units (create if absent)

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/ai/spendingAnalysis.ts` -- add `AVERAGE_WINDOW_MONTHS = 3` + `fixedWindowMonthlyAverage(monthTotals, windowMonths = AVERAGE_WINDOW_MONTHS)` (sum ÷ window; [] or window ≤ 0 → 0), docblock citing the retro decision
- [x] `src/app/api/transactions/route.ts` -- nudge helper uses the new helper (drop `calculateMean` import if unused)
- [x] `src/lib/ai/forecastEngine.ts` -- `historicalAvg` uses the new helper; docblock notes fixed-window semantics
- [x] `src/app/api/what-if/route.ts` -- averages use the new helper; docblock comment updated ("mean over months present" wording)
- [x] Tests -- new helper units (spike/two-month/full/empty); update `forecastEngine.test.ts` + what-if `route.test.ts` expected values (recompute at-risk flags where the baseline shift flips them); full suite green
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- close the DECIDED item as implemented; note the Ask-First follow-ups (recoveryPlanner/insightRules)

**Acceptance Criteria:**
- Given monthly totals [900] from one month of history, when any of the three consumers computes the baseline, then it is 300.
- Given three full months [a,b,c], when baselines are computed, then values are identical to before this change.
- Given no history, when baselines are computed, then 0 — and no nudge fires, no at-risk flag, no simulator slider appears (existing guards).
- Given the full test suite, when run, then green with only the three consumers' fixtures updated (nudgeEngine/wishlist/budget suites untouched).

## Spec Change Log

- **2026-07-02 (review loop 1):** Acceptance Auditor subagent failed (session limit) — its checklist was executed inline by the facilitator: exactly three consumers migrated, `calculateMean` untouched, Never-list files diff-free, all ACs test-covered. Blind Hunter + Edge Case Hunter findings triaged: **Ask-First resolved by Nikit — recoveryPlanner NOW ADOPTS the fixed window** (a spike month otherwise produced "exceeded your usual $300" (nudge) and "nothing to recover, usual is $900" (recovery) on one dashboard); insightRules budget-recommendation remains the only months-present holdout (follow-up). Patches applied: helper divisor hardened to `max(window, bucketsPresent)` so an over-long fetch can never inflate ABOVE the true mean (the HIGH), `Number.isFinite` window guard, `AVERAGE_WINDOW_MONTHS` wired into all four fetch windows (nudge, what-if, budget-forecast, recoveryPlanService) so divisor and lookback can't drift, docstring reworded (smaller baselines = EARLIER nudges — an accepted trade-off, not "conservative safety"), float identity test → `toBeCloseTo`, duplicated rationale comments trimmed to pointers, what-if "same semantics" claim scoped to the divisor (currency summand unification stays deferred). Dismissed: minimum-months nudge gate (contradicts the frozen trade-off), sub-cent category dropout, dead null-guard style, constant-pin test. KEEP: the fixed-window semantics, the four wired fetch windows, and the recoveryPlanner min-based targets (only its avg changed).

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0, zero warnings
- `npm run type-check` -- expected: exit 0
- `npm test` -- expected: all pass; only forecast/what-if/spendingAnalysis fixtures changed
- `npm run build` -- expected: success

## Suggested Review Order

**The helper — semantics + hardening**

- Fixed ÷window divisor with the max(window, buckets) clamp and finite-window guard
  [`spendingAnalysis.ts:203`](../../src/lib/ai/spendingAnalysis.ts#L203)

**Consumers (divisor + wired fetch windows)**

- Nudge baseline + AVERAGE_WINDOW_MONTHS lookback
  [`transactions/route.ts:461`](../../src/app/api/transactions/route.ts#L461)

- Forecast baseline (feeds resolveBudget fallback)
  [`forecastEngine.ts:79`](../../src/lib/ai/forecastEngine.ts#L79)

- What-if averages + wired window
  [`what-if/route.ts:63`](../../src/app/api/what-if/route.ts#L63)

- Recovery planner adoption (Ask-First resolved; min-based targets unchanged)
  [`recoveryPlanner.ts:74`](../../src/lib/ai/recoveryPlanner.ts#L74)

- budget-forecast + recoveryPlanService lookbacks wired to the constant
  [`budget-forecast/route.ts:45`](../../src/app/api/dashboard/budget-forecast/route.ts#L45)

**Peripherals**

- Helper units incl. the over-long-input clamp and NaN window
  [`spendingAnalysis.fixedWindow.test.ts:15`](../../src/lib/ai/__tests__/spendingAnalysis.fixedWindow.test.ts#L15)

- Shifted fixtures: forecast 266.67/100/400, what-if 266.67/30/66.67, recovery 200
  [`forecastEngine.test.ts:169`](../../src/lib/ai/__tests__/forecastEngine.test.ts#L169)
