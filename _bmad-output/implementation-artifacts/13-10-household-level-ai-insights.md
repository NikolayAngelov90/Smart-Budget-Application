---
baseline_commit: 4d06843b31ae2cd7b59663665b8e581946e57bab
---

# Story 13.10: Household-Level AI Insights

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a household member,
I want the system to generate spending insights at the household level,
so that we get collective financial intelligence.

## Acceptance Criteria

1. **Given** a household has shared transaction data, **When** household insights are generated, **Then** they **aggregate shared data** (the household's shared + category_only spend) — not any one member's personal spend.
2. **And** they **respect transparency settings** — **private category data is never included** in household insights (enforced at the data layer).
3. **And** insights use **household context / framing** (e.g., "Your household spent 20% more on Groceries this month"), with a coaching, non-shaming tone.
4. **Given** the household dashboard (Story 13.8), **When** a member views it, **Then** household insights are shown there.
5. **Given** a user with no household (or no shared data / no meaningful change), **When** insights are requested, **Then** an empty result is returned gracefully (no error, no leaked data).

## Tasks / Subtasks

- [x] Task 1: Migration 028 — date-bounded household category totals RPC (AC: #1, #2)
  - [x] `household_category_period_totals(p_household_id UUID, p_start DATE, p_end DATE)` SECURITY DEFINER, membership-gated (`IF NOT is_household_member(...) THEN RETURN`). Returns `{ category_id, category_name, total }` = SUM of **expense** transactions in the household's **shared + category_only** categories where `date >= p_start AND date < p_end` (half-open). Mirrors `household_category_totals` (23) but date-bounded; **private excluded** by the same `visibility_level IN ('shared','category_only')` filter. LEFT JOIN so a category with zero in-window spend can still appear (filter zero rows in the engine).
  - [x] COMMENT documenting the privacy model (sums only, private excluded, membership-gated).
- [x] Task 2: Types (AC: #1, #3)
  - [x] `database.types.ts`: add `household_category_period_totals` to `Functions`; add domain types `HouseholdPeriodTotal { category_id; category_name; total }` and `HouseholdInsight { type; title; description; metadata: { category_id?; category_name?; current_amount?; previous_amount?; percent_change? } }`.
- [x] Task 3: Pure engine `householdInsightEngine.ts` (AC: #1, #3) — server-side deterministic, no external AI, mirrors `patternDetection.ts` conventions
  - [x] `generateHouseholdInsights(input: { currency; current: HouseholdPeriodTotal[]; previous: HouseholdPeriodTotal[]; currentMonth?: Date }): HouseholdInsight[]` composing:
    - `detectHouseholdCategoryChanges` — per shared category with a **baseline guard** (previous total ≥ a small floor, e.g. 20) and a **threshold** (|% change| ≥ 15%): emit "Your household spent {pct}% more/less on {category} this month ({formatAmount(current)})." Sort by |% change| desc, cap at 3.
    - `detectHouseholdSpendChange` — overall shared-pot total current vs previous; if |% change| ≥ 15% and previous ≥ floor: emit "Your household's shared spending is {pct}% higher/lower than last month."
  - [x] Coaching, non-shaming tone; `formatAmount(amount, currency)` for all money (ESLint currency rule). Deterministic + fully unit-testable (no DB, no dates beyond the injected `currentMonth`).
- [x] Task 4: `householdInsightService.ts` (AC: #1, #2, #5)
  - [x] `getHouseholdInsights(userId)` — resolve the caller's household (auth-scoped); if none → `[]`. Compute current-month `[start, nextMonthStart)` and previous-month `[prevStart, start)` windows; call `household_category_period_totals` (auth-scoped RPC, membership-gated) for each window; resolve the user's `currency_format`; run `generateHouseholdInsights`; return `HouseholdInsight[]`.
- [x] Task 5: API `GET /api/households/insights` (AC: #4, #5)
  - [x] Auth; `getHouseholdInsights`; `{ data: HouseholdInsight[] }`; 401; `export const dynamic = 'force-dynamic'`. (Computed on-demand — NOT persisted to the user-scoped `insights` table.)
- [x] Task 6: UI + i18n (AC: #3, #4, #5)
  - [x] `useHouseholdInsights` hook → `GET /api/households/insights`.
  - [x] `HouseholdInsightsCard` on the `/household` dashboard: lists insight title + description; empty state when none. Add it to the dashboard grid (full-width row, near the spending card). Revalidate it in the dashboard's realtime handler (a shared-category transaction can change the numbers).
  - [x] `messages/en.json` + `bg.json`: `householdInsights` namespace (heading, none). The insight title/description strings are generated **server-side in English** by the engine (consistent with the existing AI engines, which build text in code) — only the card chrome is translated. Note this in dev notes. en/bg parity (translations.test.ts).
- [x] Task 7: Tests (AC: #1, #2, #3, #5)
  - [x] `householdInsightEngine.test.ts` (pure): % more / % less framing; baseline-floor + threshold guards (no insight below threshold or below floor); previous=0 produces no divide-by-zero insight; overall spend-change insight; empty inputs → `[]`.
  - [x] `household-insights.rls.test.ts` (gated): `household_category_period_totals` excludes a **private** category's spend, includes shared + category_only within the window, respects the date window, and returns `[]` to an outsider.
  - [x] Mocked `householdInsightService.test.ts` + route test (200/401, no-household → []).
- [x] Task 8: Verification
  - [x] `npx tsc --noEmit`, `npx eslint`, full `npx jest` green (RLS suites skip without Docker). Finalize Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Architecture & data-model decisions

- **Reuse the Epic-12 pure-engine pattern.** Engines in `src/lib/ai/*` are deterministic functions over typed input that return insight objects with a coaching tone, formatting money via `formatAmount`. `householdInsightEngine` follows the exact same shape (input → `HouseholdInsight[]`), so it's fully unit-testable with no DB/dates. [Source: src/lib/ai/patternDetection.ts]
- **Transparency (AC#2) is enforced by the RPC, not the engine.** `household_category_period_totals` is `SECURITY DEFINER` + membership-gated and filters `visibility_level IN ('shared','category_only')` — identical to `household_category_totals` (23) — so **private categories never reach the engine**. Allowance/personal spend is excluded too (those transactions have `household_id NULL` / personal categories). The engine only sees aggregates (sums, never rows), so it structurally cannot leak. [Source: supabase/migrations/023_transparency.sql:45-65]
- **Date-bounded variant is needed** because `household_category_totals` sums all-time. The new RPC takes `[p_start, p_end)` so the service can compute current-month vs previous-month per-category totals (the "spent X% more this month" comparison). Mirror the existing per-month comparison approach. [Source: src/lib/ai/patternDetection.ts:67-98 (current vs prior month)]
- **On-demand, not persisted.** The `insights` table is user-scoped (`user_id`, owner-only RLS). Rather than schema-change it for household rows + a generation cron, household insights are computed on-demand by `GET /api/households/insights` and rendered live. This satisfies AC#4 (shown on the dashboard) and keeps scope tight; persistence/cron is deferred. [Source: supabase/migrations/001_initial_schema.sql — insights table is user-scoped]
- **Text is generated in English in the engine** (same as every existing AI engine — they build `title`/`description` strings in code, not via i18n). Only the card's chrome (heading/empty-state) is translated. Don't try to localize the generated insight sentences in this story.
- **Fills onto the 13.8 dashboard.** Add `HouseholdInsightsCard` to `/household`; wire it into the existing realtime revalidation (a shared transaction changes the numbers). [Source: src/app/household/page.tsx]

### Files to touch

- NEW `supabase/migrations/028_household_insights.sql`
- UPDATE `src/types/database.types.ts` (RPC fn + HouseholdPeriodTotal + HouseholdInsight)
- NEW `src/lib/ai/householdInsightEngine.ts` (+ `src/lib/ai/__tests__/householdInsightEngine.test.ts`)
- NEW `src/lib/services/householdInsightService.ts` (+ mocked test)
- NEW `src/app/api/households/insights/route.ts` (+ route test)
- NEW `src/lib/hooks/useHouseholdInsights.ts`
- NEW `src/components/household/HouseholdInsightsCard.tsx`
- UPDATE `src/app/household/page.tsx` (render the card + revalidate it on realtime)
- UPDATE `messages/en.json`, `messages/bg.json`
- NEW `src/lib/test-utils/__tests__/household-insights.rls.test.ts`

### Project Structure Notes

- Migration **028**. Apply 020→028 in order to the live DB. [Source: memory ops note]
- AI engines live in `src/lib/ai/` with matching tests in `src/lib/ai/__tests__/`. Coaching tone is mandatory (encouraging, never shaming). [Source: src/lib/ai/patternDetection.ts:9]
- Currency: always `formatAmount(amount, currency)`; never hard-code symbols/ISO. The currency rule (`no-restricted-syntax`) covers `src/lib/ai`. The household currency = the requesting user's `currency_format` (members may differ; that's acceptable — it's the viewer's formatting).
- RLS tests: `@jest-environment node` in the **first** docblock; `rlsDescribe`; Docker-gated.

### Testing standards summary

- Engine tests are pure (inject `current`/`previous`/`currentMonth`) — assert framing, thresholds, guards, and ordering.
- Mocked service/route tests: chainable Supabase mock; `@jest-environment node`, mock `next/server` + `@/lib/supabase/server` before imports.
- en/bg parity enforced by `translations.test.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.10 (lines 636-648)]
- [Source: src/lib/ai/patternDetection.ts] — pure-engine pattern to mirror (current vs prior month, coaching tone, formatAmount)
- [Source: supabase/migrations/023_transparency.sql] — household_category_totals (the aggregate to date-bound)
- [Source: src/app/household/page.tsx] — dashboard + realtime revalidation to extend
- [Source: src/lib/hooks/useHouseholdCategoryTotals.ts] — hook shape to mirror

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- 13.8 dashboard page test updated to mock `useHouseholdInsights` (dashboard now renders the insights card, which fetches).

### Completion Notes List

- All tasks implemented. **tsc 0, ESLint 0, full suite green: 1503 passed / 45 skipped** (9 env-gated RLS suites). No regressions.
- **Migration 028:** `household_category_period_totals(household, start, end)` — date-bounded variant of `household_category_totals`, membership-gated, shared + category_only only (**private excluded**), sums never rows.
- **Pure engine** `householdInsightEngine` (mirrors Epic-12 engines): `detectHouseholdCategoryChanges` (per shared category, baseline floor 20 + 15% threshold, top 3) + `detectHouseholdSpendChange` (overall). Household-framed, coaching tone, `formatAmount`. Fully unit-tested (framing, thresholds, divide-by-zero guard, ordering, empty).
- **Transparency (AC#2) is structural:** the engine only receives membership-gated aggregates with private excluded, so it cannot leak. RLS test proves the RPC excludes a private category, respects the date window, and returns nothing to outsiders.
- **On-demand, not persisted** (`insights` table is user-scoped): `householdInsightService` computes current vs previous month windows, calls the RPC twice, runs the engine; `GET /api/households/insights` exposes it. Insight text is English (generated in-engine like all AI engines); only card chrome is i18n'd.
- **UI:** `HouseholdInsightsCard` at the top of the `/household` dashboard; wired into the realtime revalidation. en/bg i18n.
- **Deploy:** migration 028 must be applied with 020–027.

### File List

- supabase/migrations/028_household_insights.sql — CREATED
- src/types/database.types.ts — MODIFIED (household_category_period_totals fn; HouseholdPeriodTotal; HouseholdInsight)
- src/lib/ai/householdInsightEngine.ts — CREATED
- src/lib/services/householdInsightService.ts — CREATED
- src/app/api/households/insights/route.ts — CREATED (GET)
- src/lib/hooks/useHouseholdInsights.ts — CREATED
- src/components/household/HouseholdInsightsCard.tsx — CREATED
- src/app/household/page.tsx — MODIFIED (render card + realtime revalidate insights)
- messages/en.json, messages/bg.json — MODIFIED (householdInsights namespace)
- src/lib/ai/__tests__/householdInsightEngine.test.ts — CREATED
- src/lib/test-utils/__tests__/household-insights.rls.test.ts — CREATED
- src/lib/services/__tests__/householdInsightService.test.ts — CREATED
- src/app/api/households/insights/__tests__/route.test.ts — CREATED
- src/app/household/__tests__/page.test.tsx — MODIFIED (mock useHouseholdInsights)

## Change Log

- 2026-06-07: Implemented Story 13.10 — household-level AI insights (migration 028 date-bounded membership-gated RPC; pure householdInsightEngine with household-framed coaching insights; on-demand GET /api/households/insights; HouseholdInsightsCard on the dashboard; private excluded by construction). Status → review.
- 2026-06-07: Code review (three-lens) — Approve. One MED applied (E1: compare equal-length windows — current MTD vs the previous month's same day span — instead of MTD vs full previous month, which biased insights toward "less" early in the month). Status → done.

## Senior Developer Review (AI)

Reviewer: claude-opus-4-8 · 2026-06-07 · Outcome: **Approve (1 MED fixed)**

- AC1–AC5 met. Transparency is structural: the engine only receives the membership-gated, private-excluded aggregate (`household_category_period_totals`); RLS test proves a private category's spend is excluded, the date window is respected, and outsiders get nothing.
- E1 (MED, FIXED): the service compared current month-to-date against the *full* previous month, biasing every category toward "X% less" early in the month. Now compares equal-length windows (current MTD vs the previous month's same day span, capped at the previous month end). Service test updated.
- Accepted LOWs: insight text is English (generated in-engine, like all AI engines — only chrome is i18n'd); currency is the viewer's preference; computed on-demand (not persisted) — two RPC calls per load, fine for few categories.

**Verification:** tsc 0, ESLint 0, full suite green (1503 pass / 45 skipped). Migration 028 applies with 020–027.
