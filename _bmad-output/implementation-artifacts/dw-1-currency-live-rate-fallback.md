---
baseline_commit: 1515d55
source: deferred-work.md (14-3, 14-4, ADR-025 review — "fix all three together")
---

# Story DW-1: Currency live-rate fallback for budgets, wishlist and what-if

Status: done

## Story

As a person who has recorded transactions in more than one currency,
I want every screen to convert them the same way,
so that my budget, wishlist and what-if numbers agree with my dashboard.

## Problem

`/api/dashboard/stats` converts foreign-currency transactions using the stored
entry-time `exchange_rate`, and **falls back to a live rate** when a row has
none (`getExchangeRates`, cached via Redis, max one call per hour per currency).

Three other routes do only half of that — stored rate or nothing:

- `/api/budgets` — budget spend
- `/api/wishlist` — month totals
- `/api/what-if` — spending history and the 3-month averages

A row with `exchange_rate = NULL` is therefore **summed raw**, as if its amount
were already in the preferred currency. Those rows exist: anything entered
before the currency preference existed has no stored rate.

Two consequences:

1. **The same money reads differently on different screens.** The dashboard
   converts a 100 USD expense; the budget page counts it as 100 EUR. The user
   sees two numbers for one month and cannot tell which is right.
2. **The label is wrong, not just the value.** These routes present totals in
   the user's CURRENT preference while the underlying figures are a mix of
   currencies — so the € sign is asserting something untrue.

The deferred entries logged this three times and each said the same thing: fix
all three together, because fixing one makes the disagreement *worse* — there
would then be two conventions in play instead of one.

## Acceptance Criteria

1. **Given** a transaction in a non-preferred currency with a stored `exchange_rate` **When** any of the three routes aggregates it **Then** it converts using that stored rate (unchanged behaviour — the rate at entry time is the most accurate).
2. **Given** a transaction in a non-preferred currency with **no** stored rate **When** any of the three routes aggregates it **Then** it converts using a live rate fetched through `getExchangeRates`, exactly as `/api/dashboard/stats` does.
3. **Given** the live-rate lookup fails or returns no rate for the pair **Then** the route logs a warning and leaves that row unconverted rather than failing the request — matching the stats route, and consistent with the degradation policy (enrichment failure warns, it does not 500).
4. **Given** several rows share a currency **Then** the rate is fetched **once per currency per request**, not per row.
5. **Given** the same month and the same data **When** the dashboard and the budgets/wishlist/what-if screens are compared **Then** their converted totals agree.
6. **Given** a user with only preferred-currency transactions **Then** no exchange-rate lookup happens at all (no new latency for the common case).
7. **Given** verification **Then** `tsc`, `lint`, full `jest` (baseline 2276 — zero regressions) and `next build` pass.

## Tasks / Subtasks

- [x] **Task 1: Extract the conversion helper (AC: 1, 2, 3, 4)**
  - [x] Lift the stats route's two-step logic — collect currencies needing rates, fetch each once, then convert — into a shared helper (e.g. `src/lib/services/currencyConversion.ts`).
  - [x] Point `/api/dashboard/stats` at the helper so there is ONE implementation, not four.
- [x] **Task 2: Adopt it in the three routes (AC: 1-4, 6)**
  - [x] `/api/budgets` spend aggregation.
  - [x] `/api/wishlist` month totals.
  - [x] `/api/what-if` history + averages.
- [x] **Task 3: Prove agreement (AC: 5)**
  - [x] A test that feeds identical mixed-currency rows to the dashboard path and each of the three, and asserts the totals match.
- [x] **Task 4: Verify (AC: 7)**

## Dev Notes

- **Reference implementation** is in `src/app/api/dashboard/stats/route.ts`: the
  `currenciesNeedingRates` Set, the per-currency `getExchangeRates` loop that
  swallows failures with `logger.warn`, and `aggregateTransactions(rows,
  preferredCurrency, liveRateMap)`. Copy the SHAPE, do not duplicate the code —
  four copies of this is how the three routes drifted in the first place.
- `getExchangeRates` is Redis-cached at one call per hour per currency, so the
  per-currency fetch is cheap. Still respect AC4: do not call it per row.
- **Do not convert amounts that are already in the preferred currency**, and do
  not treat `currency = NULL` as foreign — the existing guard is
  `tx.currency && tx.currency !== preferredCurrency`.
- **Degradation policy** (`docs/api-conventions.md#Error-Handling`): a missing
  rate is an ENRICHMENT failure — warn and leave the row alone. Do not zero-fill
  and do not 500. A 500 here would poison the SWR localStorage cache.
- These three routes now also take `?today=` (see the cluster-B work in
  `1515d55`); do not disturb that.
- Watch for tests that mock `@/lib/services/exchangeRateService` — adding a call
  where there was none will surface as an undefined mock. Four route test files
  already spread `jest.requireActual('@/lib/utils/date')` for the same reason.

## Implementation notes

- **One helper, four callers.** `src/lib/services/currencyConversion.ts` is the
  dashboard's logic extracted, and `/api/dashboard/stats` now uses it too. Adding
  a fourth copy is how the three drifted in the first place.
- **Preferred currency is resolved server-side** from the profile, not from a
  query param. The bug is a label asserting something the numbers do not support,
  so the convert value and the label value must be the same one; a param can be
  stale by exactly one preference change.
- **A behaviour change, verified against production first.** Conversion is now
  gated on `currency` being present and different (matching the dashboard),
  whereas the three routes applied a stored rate whenever one existed. Zero of
  217 production rows have a rate without a currency, so nothing real changes.
  Two fixtures encoded that impossible combination and were corrected.

## Honest impact

Every foreign row in production currently DOES carry a stored rate, so the
live-rate fallback will not fire on today's data. This prevents the divergence
for pre-preference-era rows rather than fixing a mismatch a user can see right
now. AC5 (the surfaces agree) is satisfied structurally — they run the same
function — rather than by changing a number that was visibly wrong.
