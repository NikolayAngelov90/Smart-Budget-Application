---
baseline_commit: 5d81e73009d7b78a67c107f44381d3aff9be5ebe
---

# Story 12.5: Seasonal & Cyclical Spending Awareness

Status: done

> Sprint story 12-5 = plan Story 12.6 (see Epic 12 sprint-sequencing note in epics.md). Maps to **FR6**.

## Story

As a user planning ahead,
I want the system to identify seasonal and cyclical spending patterns,
So that I can anticipate and prepare for predictable expenses.

## Acceptance Criteria

1. **Given** a user has 6+ distinct months of expense transaction history, **When** they view the seasonal awareness section, **Then** the system analyzes monthly spending and identifies seasonal highs (months whose total is materially above the user's typical monthly spend).

2. **Given** seasonal patterns exist in history, **When** the analysis runs, **Then** upcoming predicted seasonal spikes are surfaced proactively — for each of the next 6 months, the system predicts spend from the same month-of-year in history and flags months that were historically elevated.

3. **Given** the prediction is computed, **When** the user views it, **Then** they see a timeline of the next 6 months with each month's predicted amount and a clear "seasonal high" indicator (text label + color, never color alone — NFR28).

4. **Given** a user has fewer than 6 distinct months of history, **When** they view the dashboard, **Then** the seasonal section renders nothing (progressive disclosure) — there isn't enough data to detect a yearly pattern.

5. **Given** the content is AI-generated, **When** it is displayed, **Then** the `FinancialDisclaimer` is shown (FR39, established in story 12-7).

## Tasks / Subtasks

- [x] Task 1: TypeScript types in `database.types.ts` (AC: #1-3)
  - [x] 1.1 Add domain types after `RecoveryPlanResponse`:
    ```typescript
    export interface SeasonalMonth {
      month: string;            // 'YYYY-MM' (upcoming month)
      month_label: string;      // 'YYYY-MM' month index basis — UI localizes
      month_index: number;      // 1-12 calendar month
      predicted_amount: number; // from same month-of-year in history (0 if none)
      is_seasonal_high: boolean;// predicted_amount >= baseline * 1.25
      historical_basis: string | null; // 'YYYY-MM' the prediction was drawn from
    }

    export interface SeasonalAwarenessResponse {
      timeline: SeasonalMonth[];        // next 6 months
      /** average monthly expense across analyzed history */
      baseline_monthly: number;
      months_analyzed: number;          // distinct historical months
      hasEnoughData: boolean;           // >= 6 distinct months
      generated_at: string;             // ISO timestamp
    }
    ```

- [x] Task 2: Create `src/lib/ai/seasonalAnalysis.ts` — pure computation (AC: #1, #2, #3)
  - [x] 2.1 `SeasonalAnalysisInput`: `{ transactions: Transaction[]; today: Date }` (expense-only history, up to ~13 months back).
  - [x] 2.2 `analyzeSeasonalPatterns(input): { timeline: SeasonalMonth[]; baseline_monthly: number; months_analyzed: number; hasEnoughData: boolean }`:
    - Group expense transactions by calendar month key `YYYY-MM` (`tx.date.substring(0,7)`, `tx.type === 'expense'`). Build `monthlyTotals: Map<'YYYY-MM', number>`.
    - `months_analyzed = monthlyTotals.size`; `hasEnoughData = months_analyzed >= 6`.
    - `baseline_monthly = calculateMean([...monthlyTotals.values()])` (rounded 2dp).
    - If `!hasEnoughData` → return empty `timeline`, the computed baseline/months, `hasEnoughData: false`.
    - Build a month-of-year lookup: for each `YYYY-MM` total, map `month_index (1-12)` → most recent matching `{ key, total }` (prefer the latest year if multiple).
    - For the next 6 months starting next month (today.month + 1 .. +6, rolling over year): compute the upcoming `YYYY-MM`, its `month_index`, look up the historical basis by `month_index`:
      - `predicted_amount = round(historicalTotalForThatMonthIndex ?? 0)`
      - `historical_basis = matched key or null`
      - `is_seasonal_high = predicted_amount >= baseline_monthly * 1.25 && baseline_monthly > 0`
    - Return the 6-entry timeline.
  - [x] 2.3 Import `calculateMean` from `./spendingAnalysis`; types from `@/types/database.types`. Pure — no Supabase, no side effects beyond passed `today`.

- [x] Task 3: Create `src/app/api/dashboard/seasonal/route.ts` (AC: #1, #4)
  - [x] 3.1 `GET` — auth-gate (401), `createClient()`. `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
  - [x] 3.2 Fetch up to ~13 months of expense transactions: `.eq('type','expense').gte('date', thirteenMonthsAgo)` where `thirteenMonthsAgo = toLocalISODate(new Date(y, m-13, 1))`.
  - [x] 3.3 Call `analyzeSeasonalPatterns({ transactions, today: new Date() })`; return `{ ...result, generated_at: new Date().toISOString() }` as `SeasonalAwarenessResponse`.
  - [x] 3.4 Error → `logger.error(...)` + `{ error: { message } }` 500. Mirror `budget-forecast/route.ts`.

- [x] Task 4: Create `src/lib/hooks/useSeasonalAwareness.ts` (AC: #3)
  - [x] 4.1 Mirror `useBudgetForecast.ts`: `useSWR<SeasonalAwarenessResponse>('/api/dashboard/seasonal', fetcher)`. Expose `timeline`, `baselineMonthly`, `monthsAnalyzed`, `hasEnoughData`, `isLoading`, `error`, `mutate`.

- [x] Task 5: Create `src/components/ai/SeasonalAwareness.tsx` (AC: #3, #4, #5)
  - [x] 5.1 `'use client'`. Uses `useSeasonalAwareness()` + `useUserPreferences()` (currency) + shared `formatAmount`.
  - [x] 5.2 Progressive disclosure: if `!hasEnoughData && !isLoading` → return `null`.
  - [x] 5.3 Loading: Chakra `Skeleton`.
  - [x] 5.4 Render a timeline list of the 6 upcoming months: localized month label (use `date-fns` `format` on a Date built from `month`), predicted amount, and a "Seasonal high" badge (orange, text label) when `is_seasonal_high`. Months with `predicted_amount === 0` show a muted "No history" hint.
  - [x] 5.5 Section heading + subtitle (e.g., "Based on {months} months of history"). ARIA labels on amounts.
  - [x] 5.6 Render `<FinancialDisclaimer />` (compact) inside the card (AC #5).

- [x] Task 6: Dashboard integration (AC: #3, #4)
  - [x] 6.1 In `src/app/dashboard/page.tsx`, import `SeasonalAwareness` and place it after `<RecoveryPlan />`, before `<WeeklyDigestCard />`.
  - [x] 6.2 Add `'/api/dashboard/seasonal'` to the pull-to-refresh `mutate(...)` block.

- [x] Task 7: i18n (AC: #3)
  - [x] 7.1 Add `seasonal` namespace to `messages/en.json`:
    ```json
    "seasonal": {
      "title": "Seasonal Spending Outlook",
      "subtitle": "Predicted from {months} months of history",
      "seasonalHigh": "Seasonal high",
      "predicted": "Predicted",
      "noHistory": "No history for this month yet"
    }
    ```
  - [x] 7.2 Add Bulgarian equivalents under `seasonal`.

- [x] Task 8: Tests (AC: all)
  - [x] 8.1 `src/lib/ai/__tests__/seasonalAnalysis.test.ts` (pure, no mocks):
    - returns `hasEnoughData=false` + empty timeline with < 6 distinct months
    - returns a 6-month timeline when ≥ 6 months of history
    - flags `is_seasonal_high` for an upcoming month whose historical month-of-year was ≥ 25% above baseline
    - does NOT flag a month at/below baseline
    - `predicted_amount = 0` + `historical_basis = null` when no matching month-of-year exists
    - ignores income transactions
  - [x] 8.2 `src/app/api/dashboard/seasonal/__tests__/route.test.ts` (mock `@/lib/supabase/server` + `@/lib/ai/seasonalAnalysis`, do NOT mock `next/server` per 12-3 lesson — or mock NextResponse.json like budget-forecast and pass no-arg GET):
    - 401 unauthenticated
    - returns analysis result with `generated_at`
  - [x] 8.3 `src/components/ai/__tests__/SeasonalAwareness.test.tsx`:
    - renders nothing when `!hasEnoughData`
    - renders skeleton while loading
    - renders the timeline + seasonal-high badge when data present
    - renders `FinancialDisclaimer` (AC #5)

## Dev Notes

### What Already Exists — Do NOT Re-Implement

- **`src/lib/ai/spendingAnalysis.ts`** — `calculateMean`. Import it (`calculateMean([])` = 0, safe).
- **`src/lib/ai/forecastEngine.ts` / `recoveryPlanner.ts`** — the month-grouping pattern (`tx.date.substring(0,7)`, expense-only). Reuse the approach; do not modify them.
- **`src/lib/utils/formatAmount.ts`** — shared currency formatter.
- **`src/lib/utils/date.ts`** — `toLocalISODate` for date boundaries (timezone-safe; never `.toISOString()` for calendar dates).
- **`src/components/ai/FinancialDisclaimer.tsx`** — render on the seasonal card (FR39).
- **`src/lib/services/projectionsService.ts`** — `getAnnualizedProjections` shows the multi-month aggregation + `months_analyzed`/`hasEnoughData` gating pattern. This story is on-demand compute (no new table), exactly like projections and budget-forecast.
- **`src/app/api/dashboard/budget-forecast/route.ts` + `src/lib/hooks/useBudgetForecast.ts`** — route + hook templates to mirror.
- **Dashboard** progressive-disclosure section pattern + pull-to-refresh `mutate` list.

### No New Table

Seasonal awareness is computed on demand from transaction history (like annualized projections and budget forecast). **No migration, no persistence.** Do not add a table.

### Seasonal Algorithm

```
monthlyTotals: Map<'YYYY-MM', expenseSum>
months_analyzed = monthlyTotals.size
hasEnoughData   = months_analyzed >= 6
baseline_monthly = mean(monthlyTotals.values())

monthOfYearLookup: Map<1..12, { key:'YYYY-MM', total }>  // latest year wins

for i in 1..6:
  upcoming     = addMonths(startOfThisMonth, i)   // next 6 months
  monthIndex   = upcoming.getMonth()+1
  basis        = monthOfYearLookup.get(monthIndex)
  predicted    = round(basis?.total ?? 0)
  seasonalHigh = baseline_monthly > 0 && predicted >= baseline_monthly * 1.25
```

Threshold 1.25 (25% above the user's typical month) marks a "seasonal high" — consistent with the project's other "materially elevated" cues. With 6–12 months of data each calendar month appears at most once, so the lookup is effectively "the same month last year (or the only occurrence)."

### Architecture Compliance

1. **`seasonalAnalysis.ts` = pure functions** — no Supabase, no side effects (matches forecastEngine/recoveryPlanner/patternDetection). [architecture.md AI Insight Flow]
2. **Expense-only** — `.eq('type','expense')` in the query AND `tx.type === 'expense'` guard in the engine.
3. **Timezone-safe dates** — `toLocalISODate` + `substring(0,7)`; never `.toISOString()` for calendar dates (Story 12.2 review fix).
4. **Progressive disclosure** — component returns `null` when `!hasEnoughData` (BudgetForecast/AnnualizedProjections pattern).
5. **Coaching tone** — neutral/forward-looking ("expected", "seasonal high"); never shaming.
6. **a11y** — seasonal-high uses a text badge + color, not color alone (NFR28); ARIA labels on amounts.
7. **FR39 disclaimer** on the AI-generated surface.

### File Structure

```
src/
├── types/database.types.ts                          ← MODIFY (SeasonalMonth, SeasonalAwarenessResponse)
├── lib/
│   ├── ai/
│   │   ├── seasonalAnalysis.ts                       ← CREATE (Task 2)
│   │   └── __tests__/seasonalAnalysis.test.ts        ← CREATE (Task 8.1)
│   └── hooks/useSeasonalAwareness.ts                 ← CREATE (Task 4)
├── components/ai/
│   ├── SeasonalAwareness.tsx                         ← CREATE (Task 5)
│   └── __tests__/SeasonalAwareness.test.tsx          ← CREATE (Task 8.3)
└── app/
    ├── api/dashboard/seasonal/
    │   ├── route.ts                                  ← CREATE (Task 3)
    │   └── __tests__/route.test.ts                   ← CREATE (Task 8.2)
    └── dashboard/page.tsx                            ← MODIFY (Task 6)
messages/{en,bg}.json                                 ← MODIFY (Task 7)
```

### Previous Story Learnings (12-1…12-4)

- **`tx.date.substring(0,7)`** for month keys — never `parseISO().toISOString()` (12-2 timezone bug).
- **Type-guard array access** (`arr[0]!`/length check) — strict mode + `noUncheckedIndexedAccess`.
- **Route tests in jsdom** — `jest.setup.js` needs `window`; do NOT use `@jest-environment node` (12-3 + 12-4 fix). Mock `next/server` `NextResponse.json` and call no-arg `GET()` (budget-forecast pattern).
- **Component "returns null" tests** — assert absence of heading/testid, not `container.firstChild` (12-2 fix).
- **`useMemo` capability checks**, error toasts on user actions, FR39 disclaimer on AI surfaces — established conventions.

### Git Intelligence

- `0221549` Story 12-4 recovery plans — `recoveryPlanner.ts`, recovery route/hook/component = the freshest templates (pure engine + on-demand route + dashboard card).
- `be6867f` Story 12-2 forecast — `formatAmount.ts`, budget-forecast route/hook, progressive-disclosure component.
- `07ea552` Story 12-7 — `FinancialDisclaimer` to reuse.

### References

- [Source: epics.md#Story 12.6 — Seasonal & Cyclical Spending Awareness] AC (sprint 12-5, FR6)
- [Source: prd.md#FR6] "seasonal and cyclical spending awareness by analyzing yearly patterns"
- [Source: architecture.md#Financial Intelligence & AI Coaching] seasonal awareness in the server-side AI engine group
- [Source: src/lib/services/projectionsService.ts] multi-month aggregation + hasEnoughData/months_analyzed gating
- [Source: src/lib/ai/forecastEngine.ts] month-grouping pattern to reuse
- [Source: src/app/api/dashboard/budget-forecast/route.ts + src/lib/hooks/useBudgetForecast.ts] route + hook templates
- [Source: src/components/ai/FinancialDisclaimer.tsx] FR39 disclaimer

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 8 tasks implemented; 13 new tests (6 engine + 3 route + 4 component) — 1300 tests total green (1287 prior + 13). TypeScript + ESLint clean. No regressions.
- `seasonalAnalysis.ts`: pure engine. Groups expense spend by `YYYY-MM`, baseline = mean monthly; month-of-year lookup (latest year wins); predicts next 6 months from same month-of-year; flags seasonal high at ≥125% of baseline. Returns empty timeline + hasEnoughData=false under 6 distinct months.
- On-demand compute — no table/migration (like projections & budget-forecast).
- `GET /api/dashboard/seasonal` (force-dynamic) fetches ~13 months expense history; income filtered in query + engine; timezone-safe dates.
- `SeasonalAwareness.tsx`: progressive disclosure (null < 6 months); localized month labels via date-fns; seasonal-high orange text badge (not color alone); "No history" hint for months with no basis; FR39 disclaimer. Wired into dashboard after RecoveryPlan + pull-to-refresh key.
- i18n `seasonal` namespace added to en.json + bg.json.

### File List

- src/types/database.types.ts — MODIFIED (SeasonalMonth + SeasonalAwarenessResponse)
- src/lib/ai/seasonalAnalysis.ts — CREATED (analyzeSeasonalPatterns pure engine)
- src/lib/ai/__tests__/seasonalAnalysis.test.ts — CREATED (6 tests)
- src/app/api/dashboard/seasonal/route.ts — CREATED (GET)
- src/app/api/dashboard/seasonal/__tests__/route.test.ts — CREATED (3 tests)
- src/lib/hooks/useSeasonalAwareness.ts — CREATED (SWR hook)
- src/components/ai/SeasonalAwareness.tsx — CREATED (progressive-disclosure timeline)
- src/components/ai/__tests__/SeasonalAwareness.test.tsx — CREATED (4 tests)
- src/app/dashboard/page.tsx — MODIFIED (import + placement after RecoveryPlan + pull-to-refresh key)
- messages/en.json — MODIFIED (seasonal namespace)
- messages/bg.json — MODIFIED (seasonal namespace)

## Senior Developer Review (AI)

**Date:** 2026-06-02 · **Reviewer:** bmad-code-review (three-lens) · **Outcome:** Approved

### Action Items

- [x] [MED] Current partial month polluted baseline + inflated months_analyzed. Fixed: seasonal route now bounds history to complete months only (`.lt('date', currentMonthStart)`), matching forecastEngine's current/historical split. Route test mock updated.
- [ ] [LOW] When 6+ months exist but none align to the upcoming 6 month-of-years, the timeline shows all "No history" rows — noisy but correct; left as-is.

Post-fix: 1300 tests green, TypeScript + ESLint clean.
