---
title: 'Category Budgets — ADR-025 implementation (optional limits + resolver)'
type: 'feature'
created: '2026-07-02'
status: 'done'
baseline_commit: '3d36e6333a2dd55215628ab9902dbc344ec179d0'
context:
  - '{project-root}/_bmad-output/planning-artifacts/adr-025-budget-limits-table.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Smart Budget has no way to set a budget — "budget" is a circular 3-month-average proxy baked into forecasts (12-2) and nudges (12-3). ADR-025 accepted an optional `category_budgets` table behind a single resolver but was never implemented.

**Approach:** Implement ADR-025 Option C: additive `category_budgets` table (personal budgets, owner-only RLS; `household_id` column present, household UI deferred), pure `resolveBudget` (`explicit` else `historical_average`), CRUD service + `/api/budgets`, budget editing on the categories page, a Budget Health dashboard card, and nudge/forecast wired through the resolver with honest "your budget" vs "your usual average" copy.

## Boundaries & Constraints

**Always:**
- Resolver is the ONLY place explicit-vs-average is chosen; engines/routes never reintroduce inline averages as "the budget".
- Zero-config preserved: with no limits set, forecasts/nudges behave exactly as today.
- Personal budgets use the AUTH-SCOPED client (owner-only RLS boundary — valuesService pattern).
- Migration `032_category_budgets.sql` is additive, follows 031's RLS style.
- All new UI strings in both `messages/en.json` and `messages/bg.json`.
- Expense categories only (income category → 400).

**Ask First:** changes to recovery plans (12-4) or insight rules; household-budget RLS branches; renaming existing `CategoryForecast` fields.

**Never:** mandatory budgets; values plan writing caps (FR34 is cap-free); service-role writes for personal budgets.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Resolve explicit | `{ explicitLimit: 300, threeMonthAverage: 412 }` | `{ amount: 300, source: 'explicit' }` | N/A |
| Resolve fallback | `{ threeMonthAverage: 412 }` | `{ amount: 412, source: 'historical_average' }` | N/A |
| Resolve no data | `{ threeMonthAverage: 0 }` | `{ amount: 0, source: 'historical_average' }`; callers treat 0 = no baseline | N/A |
| Upsert budget | PUT `{ category_id, limit_amount: 250 }` on own expense category | 200; one row per user+category+period | 400 bad amount (<0, NaN, >2dp); 404 not own category; 400 income; 401 unauth |
| Delete budget | DELETE own budget id | 200; category reverts to fallback | 404 unknown/not-own; 401 |
| List budgets | GET `/api/budgets` | `{ budgets: [{ category_id, name, color, limit_amount, spent, remaining, pct_used, status }] }`, current-month spend; status ok `<80%`, warning `80–100%`, over `>100%` | 401 |
| Nudge w/ budget | Expense reaches 85% of set limit | 'approaching' nudge, "your budget" copy | nudge failure non-fatal |
| Forecast w/ budget | projected EOM > set limit | `is_at_risk: true` vs limit; `budget_source: 'explicit'` | N/A |
| Zero-config | No `category_budgets` rows | Forecast/nudge identical to today; BudgetHealth renders null | N/A |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/adr-025-budget-limits-table.md` -- schema + resolver contract
- `supabase/migrations/031_values_plan.sql` -- RLS/trigger template for 032
- `src/lib/ai/forecastEngine.ts` -- pure engine; `is_at_risk` vs historicalAvg today
- `src/app/api/dashboard/budget-forecast/route.ts` -- parallel fetch; add budgets query
- `src/app/api/transactions/route.ts:447` -- `evaluateNudgeForTransaction`; add budget fetch + resolve
- `src/lib/ai/nudgeEngine.ts` -- pure; copy lives here
- `src/lib/services/valuesService.ts` + `src/app/api/values/route.ts` -- service/route patterns to copy
- `src/app/categories/page.tsx` -- CategoryCard hosts budget display/editor
- `src/app/dashboard/page.tsx` -- mount card; pull-to-refresh + tx-success mutate lists
- `src/components/ai/BudgetForecast.tsx` -- row copy update
- `src/types/database.types.ts` -- `CategoryForecast`, nudge input types

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/032_category_budgets.sql` -- ADR schema, owner-only RLS, indexes, updated_at trigger; personal uniqueness via partial unique index `WHERE household_id IS NULL`
- [x] `src/lib/ai/budgetResolver.ts` -- pure `resolveBudget` + shared status helper (`ok|warning|over` at 80/100)
- [x] `src/lib/services/budgetService.ts` -- auth-scoped list/upsert/delete; upsert validates own expense category via RLS-visible lookup
- [x] `src/app/api/budgets/route.ts` -- GET (budgets + one current-month spend query + resolved status), PUT upsert (zod); `src/app/api/budgets/[id]/route.ts` -- DELETE
- [x] `src/lib/hooks/useBudgets.ts` -- SWR hook, key `/api/budgets`
- [x] `src/lib/ai/nudgeEngine.ts` -- input gains `budgetSource?`; explicit-copy variant
- [x] `src/app/api/transactions/route.ts` -- fetch budget in nudge helper, resolve, pass amount+source
- [x] `src/lib/ai/forecastEngine.ts` + types -- optional `budgets: Map<categoryId, number>`; `budget_amount`/`budget_source` on `CategoryForecast`; at-risk vs resolved
- [x] `src/app/api/dashboard/budget-forecast/route.ts` -- fetch budgets in parallel batch, pass map
- [x] `src/components/ai/BudgetForecast.tsx` -- "vs your budget of X" sub-line on explicitly budgeted rows ONLY (average-baseline rows keep today's copy verbatim, per frozen AC1 / zero-config matrix row)
- [x] `src/components/categories/BudgetEditor.tsx` -- popover set/edit/clear control; `src/app/categories/page.tsx` renders it + budget line on own expense categories
- [x] `src/components/dashboard/BudgetHealthCard.tsx` -- progress bars colored by status, overspend text, link to categories, null when no budgets; mount in `src/app/dashboard/page.tsx`
- [x] `messages/en.json` + `messages/bg.json` -- `budgets` namespace + nudge/forecast keys
- [x] Tests: resolver (I/O matrix), budgetService, budgets routes (chainable mock), nudgeEngine + forecastEngine extensions (explicit copy/at-risk + zero-config identity), BudgetHealthCard states

**Acceptance Criteria:**
- Given no budgets, when viewing dashboard/nudges/forecasts, then behavior/copy unchanged and BudgetHealth absent.
- Given a 300 limit on Dining, when month spend hits 240, then GET reports `warning` and the card shows an orange 80% bar.
- Given a set limit, when an expense crosses 100%, then the nudge says "your budget" (not "usual average").
- Given a limit below the 3-month average, when projection exceeds the limit, then the category is at-risk even though under average.
- Given a budget whose category is deleted, then the row cascades and GET omits it.
- Given another user's category id, when PUT is called, then 404 and no row.

## Design Notes

- GET computes spend with one `transactions` query (`type=expense`, `date >= monthStart`, `category_id IN (...)`) summed in JS — no N+1.
- Status thresholds (80/100) live beside the resolver so card, nudges, and forecast copy agree.
- BudgetEditor: Chakra Popover, single amount input, Enter=save, explicit Clear; ≥44px touch targets.

## Spec Change Log

- **2026-07-02 (review loop 1, acceptance auditor):** The task line for `BudgetForecast.tsx` ('"vs your budget" / "vs usual average" per row') contradicted the frozen zero-config matrix row ("Forecast/nudge identical to today") — implementing it added a new "vs usual average" line for users with no budgets. Amended the task to render the sub-line only for `budget_source === 'explicit'`; removed the `vsUsualAverage` i18n keys. Known-bad state avoided: zero-config forecast copy drift. KEEP: the explicit "vs your budget of X" sub-line, the at-risk-vs-resolved-budget logic, and the `budget_amount`/`budget_source` payload fields — all validated by review.
- **2026-07-02 (review loop 1, all reviewers):** Explicit 0 budgets split surface behavior (card said "over", nudges/forecasts stayed silent). Resolution: budgets are strictly positive — zod `.positive().max(9999999999.99)`, DB `CHECK (limit_amount > 0)`, editor validation; resolver docs now state "resolved amount 0 = no baseline everywhere". Known-bad state avoided: three surfaces disagreeing about the same budget. Also hardened per review: forecast route degrades to averages if `category_budgets` is unavailable (deploy-order safety); GET spend query month-bounded on both ends + converts via stored entry-time exchange rate; upsert recovers from the 23505 select-then-insert race; editor rejects locale/garbage input (accepts comma decimals), guards Enter double-submit, treats clear-404 as success, 44px mobile touch targets; BudgetHealthCard renders null while loading (no skeleton flash) and holds stale data through transient errors; budget saves revalidate the forecast SWR key; migration 032 INSERT/UPDATE `WITH CHECK` constrains category ownership/type + `household_id IS NULL`, and grants explicit table privileges (CLI ≥2.106 unpin-readiness).

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0, zero warnings
- `npm run type-check` -- expected: exit 0
- `npm test` -- expected: all pass; no forecast/nudge regressions
- `npm run build` -- expected: successful production build

**Manual checks (if no CLI):**
- Migration 032 noted for manual SQL-editor apply per ops checklist (Vercel doesn't run Supabase migrations).

## Suggested Review Order

**Budget resolution — the ADR-025 core invariant**

- Single source of truth: explicit limit else average; 0 = no baseline everywhere
  [`budgetResolver.ts:38`](../../src/lib/ai/budgetResolver.ts#L38)

- Shared 80/100 status thresholds so card, nudges, and forecasts agree
  [`budgetResolver.ts:55`](../../src/lib/ai/budgetResolver.ts#L55)

**Schema & RLS boundary**

- Additive table; strictly positive limits; partial unique index for the personal slot
  [`032_category_budgets.sql:9`](../../supabase/migrations/032_category_budgets.sql#L9)

- INSERT/UPDATE WITH CHECK mirrors app rules (own expense category, NULL household) — Epic-13 lesson
  [`032_category_budgets.sql:44`](../../supabase/migrations/032_category_budgets.sql#L44)

- Explicit grants for the CLI ≥2.106 unpin plan
  [`032_category_budgets.sql:70`](../../supabase/migrations/032_category_budgets.sql#L70)

**Engine wiring (zero-config identity preserved)**

- Forecast at-risk compares vs resolved budget; new payload fields, no renames
  [`forecastEngine.ts:94`](../../src/lib/ai/forecastEngine.ts#L94)

- Nudge copy honesty: "your budget" vs "usual average" via budgetSource
  [`nudgeEngine.ts:66`](../../src/lib/ai/nudgeEngine.ts#L66)

- Nudge helper resolves explicit budget; errors degrade to proxy (non-fatal)
  [`transactions/route.ts:509`](../../src/app/api/transactions/route.ts#L509)

- Forecast route degrades to averages if 032 isn't applied yet (deploy-order safety)
  [`budget-forecast/route.ts:75`](../../src/app/api/dashboard/budget-forecast/route.ts#L75)

**API surface**

- GET: month-bounded spend, stored-rate conversion, floored pct, urgency sort
  [`budgets/route.ts:36`](../../src/app/api/budgets/route.ts#L36)

- PUT validation: positive, ≤2dp, NUMERIC(12,2)-bounded; service errors → 404/400
  [`budgets/route.ts:25`](../../src/app/api/budgets/route.ts#L25)

- Upsert validates own expense category first; 23505 race converges to update
  [`budgetService.ts:48`](../../src/lib/services/budgetService.ts#L48)

**UI**

- Budget Health dashboard card: progressive disclosure, no skeleton flash, stale-data-over-error
  [`BudgetHealthCard.tsx:40`](../../src/components/dashboard/BudgetHealthCard.tsx#L40)

- BudgetEditor popover: locale-safe input, double-submit guard, idempotent clear, 44px targets
  [`BudgetEditor.tsx:66`](../../src/components/categories/BudgetEditor.tsx#L66)

- Categories page: editor gated until budgets load; saves revalidate the forecast key
  [`categories/page.tsx:88`](../../src/app/categories/page.tsx#L88)

- Forecast sub-line only on explicitly budgeted rows (frozen AC1)
  [`BudgetForecast.tsx:49`](../../src/components/ai/BudgetForecast.tsx#L49)

**Peripherals**

- Resolver I/O matrix tests incl. explicit-0 passthrough semantics
  [`budgetResolver.test.ts:11`](../../src/lib/ai/__tests__/budgetResolver.test.ts#L11)

- Zero-config identity + explicit at-risk engine tests
  [`forecastEngine.test.ts:190`](../../src/lib/ai/__tests__/forecastEngine.test.ts#L190)

- Route tests: validation matrix, currency conversion, urgency sort, 23505 recovery
  [`budgets/__tests__/route.test.ts:104`](../../src/app/api/budgets/__tests__/route.test.ts#L104)

- Typed schema entry + BudgetSummary/BudgetsResponse types
  [`database.types.ts:1186`](../../src/types/database.types.ts#L1186)
