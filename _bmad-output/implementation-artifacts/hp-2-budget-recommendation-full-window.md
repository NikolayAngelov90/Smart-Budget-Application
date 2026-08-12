# HP-2 — Budget recommendations need a full 3-month window

**Type:** Hardening pass (post-Epic-16).
**Source:** `deferred-work.md` "Still open" item 3, plus Epic 16 retro action #4.
**Shipped:** PR #31, `fcf96c3`.
**Status:** done — see Review below.
**Written:** 2026-08-11, retroactively. This story was implemented without a
story file; that omission is recorded as a process finding rather than hidden.

---

## Why

`recommendBudgetLimit` accepted **two** months of history while its copy read
*"Based on your 3-month average"* — so it divided by 2 and called the result a
3-month figure.

It was also the last holdout from the Epic 14 ÷3 decision. Every other baseline
(nudge, `forecastEngine`, `recoveryPlanner`) uses `fixedWindowMonthlyAverage`, so
a category with two months of history showed **"typical 300"** on the insight
card and **"usual 200"** on the forecast card — same category, same dashboard.

## The deferred note proposed a fix that would have made it worse

`deferred-work.md` said "port the fixed window". Applied to a *recommendation*,
÷3 turns a steady `[300, 300]` spender into 200:

| History | Months-present (before) | Fixed ÷3 (proposed) |
|---|---|---|
| `[300, 300]` steady | 300 → budget 330 | 200 → budget **220** |
| `[900, 100]` one spike | 500 → budget 550 | 333 → budget 367 |

That would recommend a 220 budget to someone who reliably spends 300, then flag
them for overspending every month after. The ÷3 rule exists to stop one spike
posing as "usual" — right for **detection**, wrong for a **recommendation**.

## Decision

Settled with Nikit before building: **require the full window** (guard 2 → 3).

At exactly three buckets the two formulas are identical, so the disagreement
cannot occur by construction and the copy is finally true.

Rejected: keeping two months and only fixing the copy (leaves the two cards
disagreeing); porting ÷3 as written (under-budgets new users).

## Acceptance criteria

1. No recommendation is produced from fewer than `AVERAGE_WINDOW_MONTHS` months.
2. A month inside the window with no spend still counts as an incomplete window.
3. The quoted average equals the average actually used.
4. The recommendation never falls below what a steady spender actually spends.
5. Existing suppressions still hold — sub-20 recommendation, and a current
   budget already within 15%.
6. The fetch window, the loop bound and the guard all derive from
   `AVERAGE_WINDOW_MONTHS` so they cannot drift apart.

## Cost, accepted

A category with only two months of history waits one more month for its
recommendation. A budget inferred from two months is a guess anyway.

## Tests

First direct coverage for this rule — the only suite that referenced it mocked
it out. 14 tests. Non-vacuity checked by reverting the guard alone: exactly the
two window tests fail.

## Review

Post-merge adversarial review (Blind Hunter / Edge Case Hunter / Acceptance
Auditor) run 2026-08-11 over `84f6c8c..a7190ae`. Outcome recorded in
`hp-review-2026-08-11.md`.
