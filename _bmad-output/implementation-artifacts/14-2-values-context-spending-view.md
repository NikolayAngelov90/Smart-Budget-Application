---
baseline_commit: 25ae0fe18d8e7028fb7465867209b76da9efbf4d
---

# Story 14.2: Values-Context Spending View

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user with a values-based plan,
I want to view my spending in the context of my stated values,
so that I can see whether my money flows toward or away from what matters.

## Acceptance Criteria

1. **Given** a user has defined values and mapped categories (Story 14.1), **When** they view the values spending view, **Then** spending is **grouped and visualized by value** (not just by category) — each value's spend is the sum of its mapped categories' expense for the current month.
2. **And** each value shows **total spend**, **percentage of overall spend**, and a **trend direction** (up / down / flat vs the previous month).
3. **And** **misalignment is highlighted** — a value ranked **low in priority** but receiving a **large share of spend** is flagged (e.g., "Fun" ranked #4 but receiving 35% of spend).
4. **And** spend in categories **not mapped to any value** is surfaced as an **"Unassigned"** bucket so the percentages stay honest (sum to 100%).
5. **Given** the user has **no values defined**, **When** the dashboard renders, **Then** the view renders **nothing** (progressive disclosure — no empty clutter), consistent with the other dashboard cards.
6. **Given** the plan is personal, **When** spending is read, **Then** it uses only the **caller's own** transactions/categories (owner-scoped) — no household data.

## Tasks / Subtasks

- [x] Task 1: Types (AC: #1, #2, #3, #4) — `ValueSpendRow` + `ValuesSpendingView` added near the 14.1 value types in `database.types.ts`.
- [x] Task 2: Pure engine `src/lib/ai/valuesSpendingEngine.ts` (AC: #1, #2, #3, #4) — `computeValuesSpending` (deduped totalSpend denominator, per-value share, trend up/down/flat w/ BASELINE_FLOOR 20 + THRESHOLD 15, misalignment via priorityRank−spendRank≥2 & share≥20, unassigned bucket, divide-by-zero guards).
- [x] Task 3: API `GET /api/values/spending` (AC: #1, #2, #4, #5, #6) — auth (401), no-plan short-circuit, single `[prevMonthStart, nextMonthStart)` query on `date` bucketed into current/previous, engine → view, 500 on DB error.
- [x] Task 4: Hook + UI (AC: #1, #2, #3, #4, #5) — `useValuesSpending` SWR hook; `ValuesSpendingCard` (null when no plan; #rank badge, name, amount, % bar, trend arrow, misalignment badge, Unassigned row); mounted after `<MonthOverMonth/>`; `/api/values/spending` added to both dashboard revalidation lists.
- [x] Task 5: i18n (AC: #1, #2, #3, #4) — extended `values` namespace en+bg (spendingHeading, thisMonth, trendUp/Down/Flat, misaligned, unassigned, unassignedHelp). Parity green.
- [x] Task 6: Tests (AC: #1, #2, #3, #4, #5, #6) — engine unit tests (grouping, deduped denominator, trend, misalignment fires/doesn't, unassigned, empty, zero-spend) + route tests (401, no-plan short-circuit + no aggregation, two-window aggregation, 500).
- [x] Task 7: Verification — `npx tsc --noEmit` clean; `npx eslint` clean; full `npx jest` green (1564 passed / 54 skipped Docker-gated RLS). Dev Agent Record + File List + Change Log finalized; status → review.

## Dev Notes

### Architecture & data-model decisions

- **No migration.** This story is pure read/aggregation over Story 14.1's `user_values` + `value_categories` and the existing `transactions`/`categories`. Do NOT add tables or columns. [Source: supabase/migrations/031_values_plan.sql]
- **Pure deterministic engine, Epic-12 style.** All math lives in `valuesSpendingEngine.ts` with no DB and no currency formatting (the card formats amounts). Mirror the structure of `householdInsightEngine.ts` (typed input → typed output, `BASELINE_FLOOR`/`THRESHOLD` consts, side-effect free). This keeps it trivially unit-testable. [Source: src/lib/ai/householdInsightEngine.ts]
- **Denominator is the deduped total, not the sum of per-value amounts.** A category can map to multiple values (14.1 is many-to-many), so summing per-value amounts double-counts. `totalSpend` must be the sum over the distinct `currentByCategory` entries. Percentages are each value's share of that honest total; they may sum to >100% across values when categories are shared — that's expected and why the **Unassigned** bucket is computed from the deduped total, not from leftover percentage. Call this out in a code comment.
- **Owner-scoped only.** Use the auth-scoped `@/lib/supabase/server` client and filter `user_id = caller`. No household_id, no service-role — this is personal (like the rest of the dashboard endpoints). [Source: src/app/api/dashboard/spending-by-category/route.ts]
- **Date window.** Reuse the month math from `spending-by-category/route.ts`: `monthStart = new Date(y, m, 1)`, previous month start = `new Date(y, m-1, 1)`, next month start = `new Date(y, m+1, 1)`. Query `.gte('date', prevStart.toISOString()).lt('date', nextStart.toISOString())` and bucket by `date < currentMonthStart`. Filtering on `date` (not `created_at`) matches that route. [Source: src/app/api/dashboard/spending-by-category/route.ts lines 52-83]
- **Progressive disclosure.** The card returns `null` when there's no plan, exactly like `AnnualizedProjections`/`BudgetForecast` render null without data — so users who don't use values see nothing new on the dashboard. [Source: src/app/dashboard/page.tsx lines 196-204]
- **Trend semantics for expense:** "up" = spending increased (render in red/warning), "down" = decreased (green/positive). Don't invert. Match the coaching, non-shaming tone elsewhere — the misalignment badge is a gentle nudge, not an alarm.
- **Currency** comes from `useUserPreferences().preferences?.currency_format || 'EUR'` in the card, formatted with `formatAmount`. The engine and API stay currency-agnostic (raw numbers). [Source: src/components/household/CombinedSpendingCard.tsx lines 14-21]

### Files to touch

- UPDATE `src/types/database.types.ts` (add `ValueSpendRow`, `ValuesSpendingView`)
- NEW `src/lib/ai/valuesSpendingEngine.ts`
- NEW `src/app/api/values/spending/route.ts` (GET)
- NEW `src/lib/hooks/useValuesSpending.ts`
- NEW `src/components/values/ValuesSpendingCard.tsx`
- UPDATE `src/app/dashboard/page.tsx` (mount card + revalidation key)
- UPDATE `messages/en.json`, `messages/bg.json` (extend `values` namespace)
- NEW `src/lib/ai/__tests__/valuesSpendingEngine.test.ts`
- NEW `src/app/api/values/__tests__/spending.route.test.ts`

### Project Structure Notes

- `getValuesPlan(userId)` returns `ValueWithCategories[]` already in **priority ASC** order (the input order IS the priority order). Don't re-sort by priority. [Source: src/lib/services/valuesService.ts getValuesPlan]
- `ValueWithCategories = { id; name; priority; category_ids: string[] }`. [Source: src/types/database.types.ts]
- API route tests: `@jest-environment node` in the FIRST docblock; mock `next/server` before imports; chainable Supabase mock; mock `@/lib/services/valuesService` and `@/lib/supabase/server`. [Source: src/app/api/values/__tests__/route.test.ts]
- The Supabase mock chain for the transactions query ends on `.lt(...)` (awaited) — make that terminal thenable in the mock (see the `then` trick in `valuesService.test.ts`). [Source: src/lib/services/__tests__/valuesService.test.ts]
- en/bg parity is enforced by `translations.test.ts` — add the same keys to both files.
- AI/engine text is English-in-engine; here the engine produces NO text (numbers/flags only), so all user-facing strings are i18n'd in the card. [Source: memory — AI engines generate English in-engine; only chrome i18n'd]
- Dashboard card mounts: see the `<Box mb={{ base: 6, md: 8 }}>` wrappers around each card in `src/app/dashboard/page.tsx`. [Source: src/app/dashboard/page.tsx lines 186-219]

### Testing standards summary

- Engine: pure unit tests, no mocks — feed inputs, assert the view. Cover the deduped-denominator case explicitly (a category in two values).
- Route: chainable Supabase mock + mocked `getValuesPlan`; assert 401, no-plan short-circuit, and a two-window aggregation producing the right per-value amounts/trend.
- Run `npx tsc --noEmit`, `npx eslint`, full `npx jest` (RLS suites skip without Docker).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 14.2 (lines 684-696)]
- [Source: src/lib/ai/householdInsightEngine.ts] — pure-engine shape to mirror
- [Source: src/app/api/dashboard/spending-by-category/route.ts] — per-category month aggregation + date-window math
- [Source: src/components/household/CombinedSpendingCard.tsx] — card styling, currency, Progress bars
- [Source: src/lib/services/valuesService.ts] — getValuesPlan (priority-ordered ValueWithCategories[])
- [Source: src/app/dashboard/page.tsx] — dashboard card composition + progressive disclosure + revalidation keys
- [Source: src/app/api/values/__tests__/route.test.ts] — route test pattern for /api/values

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- None — clean implementation. tsc/eslint clean first pass; engine + route tests green first run.

### Completion Notes List

- **No migration** — pure read/aggregation over the Story 14.1 `user_values`/`value_categories` plan + existing `transactions`/`categories`.
- **Pure engine** `computeValuesSpending` (Epic-12 style, no DB/no currency). The key correctness point: a category can map to multiple values (14.1 is many-to-many), so `totalSpend` is the sum over the DISTINCT current-month category totals (deduped), NOT the sum of per-value amounts — otherwise the denominator double-counts shared categories. Per-value percentages may sum to >100% when categories are shared; the **Unassigned** bucket is derived from the deduped total, never from leftover percentage. Covered by a dedicated test.
- **Misalignment** = `percentage ≥ 20` AND `(priorityRank − spendRank) ≥ 2` — a low-priority value taking a large share of spend. Gentle nudge (orange badge), never an alarm; the top-priority value is never flagged even when it's the biggest spender (test asserts both directions).
- **Trend** for expense: `up` (spending rose, red) / `down` (fell, green) / `flat`, with `BASELINE_FLOOR=20` so a tiny prior month can't manufacture a huge %.
- **API** `GET /api/values/spending`: auth-scoped (owner-only, `user_id = caller`, no household). Short-circuits to `hasPlan:false` (no transaction query) when the user has no values. One query over `[prevMonthStart, nextMonthStart)` on `date`, bucketed into current/previous by comparing to `currentMonthStart` — mirrors `spending-by-category/route.ts`.
- **UI** `ValuesSpendingCard` on the dashboard: progressive disclosure (renders `null` until there's a plan), so users not using values see nothing new. Added `/api/values/spending` to both dashboard revalidation lists (pull-to-refresh + TransactionEntryModal onSuccess).
- Verification: `npx tsc --noEmit` clean; `npx eslint` clean; full `npx jest` → 1564 passed / 54 skipped (Docker-gated RLS), 0 failed.

### File List

**New**
- `src/lib/ai/valuesSpendingEngine.ts`
- `src/app/api/values/spending/route.ts`
- `src/lib/hooks/useValuesSpending.ts`
- `src/components/values/ValuesSpendingCard.tsx`
- `src/lib/ai/__tests__/valuesSpendingEngine.test.ts`
- `src/app/api/values/__tests__/spending.route.test.ts`

**Updated**
- `src/types/database.types.ts` (ValueSpendRow, ValuesSpendingView)
- `src/app/dashboard/page.tsx` (mount ValuesSpendingCard + 2 revalidation keys)
- `messages/en.json`, `messages/bg.json` (extend `values` namespace)

### Change Log

- 2026-06-15: Story 14.2 implemented — values-context spending view (pure valuesSpendingEngine, GET /api/values/spending, ValuesSpendingCard on dashboard w/ progressive disclosure, en/bg i18n, engine + route tests). No migration. tsc/eslint clean; jest 1564 passed / 54 skipped. Status → review.
- 2026-06-15: Code review fix (MED) — month bucketing parsed the DATE-column string with `new Date()` (UTC midnight) and compared to a LOCAL month start, which misbuckets a transaction dated the 1st into the previous month in non-UTC timezones. Now buckets by the `YYYY-MM` month KEY (`String(date).slice(0,7)`), timezone-independent, and ignores any stray out-of-window row. Route test updated to use realistic `YYYY-MM-DD` dates.

## Senior Developer Review (AI)

**Outcome:** Approve (1 MED resolved in-session).

### Action Items

- [x] **[MED] Month boundary misbucketing across timezones.** `transactions.date` is a Postgres `DATE` → returned as `'YYYY-MM-DD'`. The bucketing used `new Date(tx.date).getTime()` (parsed as UTC midnight) vs a local `currentMonthStart`, so a transaction dated the 1st of the month could be counted in the wrong month for non-UTC users. Fixed by comparing the `YYYY-MM` month key string instead. [src/app/api/values/spending/route.ts]

Edge cases reviewed and OK: deduped denominator (category in multiple values doesn't double-count — dedicated engine test); divide-by-zero on a no-spend month; misalignment never flags the top-priority value; nullable `category_id` skipped; progressive disclosure hides the card when there's no plan; owner-scoped query (no household leakage).
