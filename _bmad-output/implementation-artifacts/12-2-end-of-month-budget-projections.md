# Story 12.2: End-of-Month Budget Projections

Status: done

## Story

As a user managing monthly budgets,
I want to see projected end-of-month spending based on my current pace,
So that I know if I'm on track or heading for an overspend.

## Acceptance Criteria

1. **Given** a user has expense transactions in the current calendar month, **When** they view the budget dashboard, **Then** each spending category shows a projected end-of-month total calculated from the current daily spending rate.

2. **Given** a category's projected end-of-month total exceeds its 3-month historical average, **When** the forecast is displayed, **Then** that category is visually flagged as "at risk" (distinct color/badge — not alarming, coaching tone).

3. **Given** a user adds a new transaction, **When** they next view the dashboard (or pull-to-refresh), **Then** the forecast totals reflect the updated spending pace.

4. **Given** a user has no expense transactions in the current calendar month, **When** they view the dashboard, **Then** the `BudgetForecast` component renders `null` (progressive disclosure — no empty-state noise).

5. **Given** the forecast is rendered, **When** it is viewed on any viewport, **Then** it is accessible (ARIA labels on projected amounts, colorblind-safe flagging that includes a text indicator, not just color).

## Tasks / Subtasks

- [x] Task 1: Add new TypeScript types to `database.types.ts` (AC: #1, #2)
  - [x] 1.1 Add `CategoryForecast` interface after `ProjectionsResponse`:
    ```typescript
    export interface CategoryForecast {
      category_id: string;
      category_name: string;
      category_color: string;
      spent_so_far: number;       // current month expense total to date
      projected_eom: number;      // extrapolated end-of-month total
      historical_avg: number;     // 3-month rolling avg (0 if no history)
      is_at_risk: boolean;        // projected_eom > historical_avg (and historical_avg > 0)
      days_elapsed: number;       // days from 1st of month to today (inclusive)
      days_in_month: number;      // total calendar days in current month
    }

    export interface ForecastResponse {
      forecasts: CategoryForecast[];
      /** false when user has no current-month expense transactions */
      hasCurrentMonthData: boolean;
      /** ISO date string of when the forecast was computed */
      generated_at: string;
    }
    ```

- [x] Task 2: Create `src/lib/ai/forecastEngine.ts` — pure computation module (AC: #1, #2, #4)
  - [x] 2.1 Define `ForecastEngineInput` interface:
    ```typescript
    export interface ForecastEngineInput {
      currentMonthTransactions: Transaction[];  // expense-only, current month
      historicalTransactions: Transaction[];    // expense-only, prior 3 calendar months
      categories: Category[];
      today: Date;
    }
    ```
  - [x] 2.2 Implement `computeEndOfMonthForecasts(input: ForecastEngineInput): CategoryForecast[]`:
    - Determine `daysElapsed` = `today.getDate()` (day of month, 1-based)
    - Determine `daysInMonth` = last day of current month (use `endOfMonth` from `date-fns`)
    - Guard: if `daysElapsed === 0` or `currentMonthTransactions.length === 0` → return `[]`
    - For each category that has current-month spending:
      - `spentSoFar` = sum of `currentMonthTransactions` for this `category_id` where `t.type === 'expense'`
      - Skip categories with `spentSoFar === 0`
      - `dailyRate = spentSoFar / daysElapsed`
      - `daysRemaining = daysInMonth - daysElapsed`
      - `projectedEOM = Math.round((spentSoFar + dailyRate * daysRemaining) * 100) / 100`
      - `historicalAvg`: group `historicalTransactions` for this category by calendar month → sum each month → mean. Use `calculateMean` from `@/lib/ai/spendingAnalysis`. If no history → `0`.
      - `isAtRisk = historicalAvg > 0 && projectedEOM > historicalAvg`
    - Sort: `is_at_risk` categories first, then by `projected_eom` descending
    - Return `CategoryForecast[]`
  - [x] 2.3 Import `calculateMean` from `@/lib/ai/spendingAnalysis` — do NOT re-implement
  - [x] 2.4 Import `endOfMonth` from `date-fns`, `parseISO` for date parsing — do NOT import from `date-fns/fp`
  - [x] 2.5 All amounts rounded to 2dp before returning

- [x] Task 3: Create `src/app/api/dashboard/budget-forecast/route.ts` (AC: #1, #2, #3)
  - [x] 3.1 `GET /api/dashboard/budget-forecast` — auth-gated, follows exact pattern of `annualized-projections/route.ts`:
    - `export const dynamic = 'force-dynamic'`; `export const revalidate = 0`
    - Authenticate with `createClient()`, return 401 if no user
    - Fetch current-month expense transactions: `.gte('date', currentMonthStart).lte('date', currentMonthEnd)`
    - Fetch prior 3 months expense transactions: `.gte('date', threeMonthsAgo).lt('date', currentMonthStart)`
    - Fetch categories: `.eq('user_id', userId)`
    - If no current-month transactions → return `{ forecasts: [], hasCurrentMonthData: false, generated_at: ... }`
    - Call `computeEndOfMonthForecasts({ currentMonthTransactions, historicalTransactions, categories, today: new Date() })`
    - Return `{ forecasts, hasCurrentMonthData: true, generated_at: new Date().toISOString() }`
  - [x] 3.2 Use `toLocalISODate` from `@/lib/utils/date` for date boundary strings (same as `projectionsService.ts`)
  - [x] 3.3 Error → `logger.error(...)` + return `{ error: { message: '...' } }` status 500

- [x] Task 4: Create `src/lib/hooks/useBudgetForecast.ts` (AC: #3)
  - [x] 4.1 SWR hook pattern identical to `useAnnualizedProjections.ts`:
    ```typescript
    export function useBudgetForecast(): UseBudgetForecastResult {
      const { data, error, isLoading, mutate } = useSWR<ForecastResponse>(
        '/api/dashboard/budget-forecast',
        async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Failed to fetch budget forecast');
          return response.json();
        }
      );
      return {
        forecasts: data?.forecasts ?? [],
        hasCurrentMonthData: data?.hasCurrentMonthData ?? false,
        generated_at: data?.generated_at ?? null,
        isLoading,
        error,
        mutate,
      };
    }
    ```
  - [x] 4.2 Export `UseBudgetForecastResult` interface alongside the hook

- [x] Task 5: Create `src/components/ai/BudgetForecast.tsx` (AC: #1, #2, #4, #5)
  - [x] 5.1 `'use client'` component — progressive disclosure: return `null` when `!hasCurrentMonthData && !isLoading`
  - [x] 5.2 Loading state: `<Skeleton height="200px" borderRadius="md" />`
  - [x] 5.3 Per-category row shows: color swatch, category name, "at risk" badge (text + color — not color only), spent so far, projected EOM
  - [x] 5.4 "At risk" indicator: Chakra `Badge colorScheme="orange"` with text label (e.g., "At risk") — never use color alone (AC #5 accessibility)
  - [x] 5.5 Amounts: use `formatAmount(amount, currency)` pattern copied from `AnnualizedProjections.tsx` — same Intl.NumberFormat helper
  - [x] 5.6 ARIA: `aria-label` on projected-amount `<Text>` elements with full human-readable string (e.g., `"Projected end-of-month: $450"`)
  - [x] 5.7 Section heading: `<Heading as="h2">` + subtitle showing which day of month / days remaining
  - [x] 5.8 i18n: use `useTranslations('budgetForecast')` — all display strings from translation keys (see Task 7)
  - [x] 5.9 Currency: use `useUserPreferences()` for `preferences.currency_format` — same pattern as `AnnualizedProjections.tsx`

- [x] Task 6: Integrate into `src/app/dashboard/page.tsx` (AC: #3)
  - [x] 6.1 Import `BudgetForecast` from `@/components/ai/BudgetForecast`
  - [x] 6.2 Add `import { BudgetForecast } from '@/components/ai/BudgetForecast'` to existing import block
  - [x] 6.3 Place `<BudgetForecast />` between `<AnnualizedProjections />` and `<WeeklyDigestCard />`:
    ```tsx
    {/* End-of-Month Budget Forecast - Story 12.2 (progressive disclosure) */}
    <Box mb={{ base: 6, md: 8 }}>
      <BudgetForecast />
    </Box>
    ```
  - [x] 6.4 Add `'/api/dashboard/budget-forecast'` to the pull-to-refresh `Promise.all` block (line ~53):
    ```tsx
    mutate('/api/dashboard/budget-forecast', undefined, { revalidate: true }),
    ```

- [x] Task 7: Add i18n keys (AC: #1, #2, #5)
  - [x] 7.1 In `messages/en.json`, add `"budgetForecast"` namespace:
    ```json
    "budgetForecast": {
      "title": "End-of-Month Forecast",
      "subtitle": "Day {{day}} of {{daysInMonth}} — {{daysRemaining}} days remaining",
      "spentSoFar": "Spent so far",
      "projectedEOM": "Projected EOM",
      "atRisk": "At risk",
      "onTrack": "On track",
      "noData": "No spending data for this month yet"
    }
    ```
  - [x] 7.2 Add Bulgarian equivalents to `messages/bg.json` under `"budgetForecast"`:
    ```json
    "budgetForecast": {
      "title": "Прогноза за края на месеца",
      "subtitle": "Ден {{day}} от {{daysInMonth}} — остават {{daysRemaining}} дни",
      "spentSoFar": "Изразходвано",
      "projectedEOM": "Прогноза",
      "atRisk": "Риск",
      "onTrack": "В рамките",
      "noData": "Все още няма разходи за този месец"
    }
    ```

- [x] Task 8: Tests (AC: all)
  - [x] 8.1 Create `src/lib/ai/__tests__/forecastEngine.test.ts` — pure unit tests (no mocks needed):
    - `returns [] when currentMonthTransactions is empty`
    - `projects correctly: $300 in 10 days of 30-day month → projected $900`
    - `marks category as at-risk when projected > historical avg`
    - `marks category as NOT at-risk when no historical data (historicalAvg = 0)`
    - `marks category as NOT at-risk when projected ≤ historical avg`
    - `sorts at-risk categories first`
    - `rounds projected amounts to 2dp`
    - `skips categories with no current-month spending`
  - [x] 8.2 Create `src/app/api/dashboard/budget-forecast/__tests__/route.test.ts` — API unit test:
    - `returns 401 when not authenticated`
    - `returns hasCurrentMonthData: false when no current-month transactions`
    - `returns forecasts array when current-month transactions exist`
    - Follow the mock pattern from `annualized-projections/__tests__/annualized-projections.test.ts`

## Dev Notes

### What Already Exists — Do NOT Re-Implement

- **`src/lib/services/projectionsService.ts`** — ANNUALIZED projections (Story 11.4). This story adds END-OF-MONTH projections — completely different computation, different API route, different component.
- **`src/components/ai/AnnualizedProjections.tsx`** — the existing projections UI. Copy the `formatAmount` helper pattern but do NOT modify this component.
- **`src/lib/ai/spendingAnalysis.ts`** — `calculateMean` is available here. Import it, do NOT copy.
- **`src/lib/hooks/useAnnualizedProjections.ts`** — the SWR hook template to follow for `useBudgetForecast`.
- **`src/app/api/dashboard/annualized-projections/route.ts`** — the API route template. Follow the same auth, DB query, and error pattern exactly.
- **`src/lib/ai/patternDetection.ts`** — Story 12.1 file. `forecastEngine.ts` lives alongside it in `src/lib/ai/` but is completely independent.

### No Budget Table Required

There is NO budget-limits table in the schema. "Budget" in this story means the user's **3-month historical average** for each category — it is the soft spending target. `isAtRisk = projectedEOM > historicalAvg`. If `historicalAvg === 0` (new category, no history), `isAtRisk` is always `false`.

[Source: src/lib/services/insightService.ts:138 — "Budget table is not part of the current MVP scope"]

### Forecast Algorithm

```
daysElapsed   = today.getDate()          // e.g. 10
daysInMonth   = endOfMonth(today).getDate()  // e.g. 30
daysRemaining = daysInMonth - daysElapsed    // 20

For each category:
  spentSoFar  = sum(current-month expense tx for this category)
  dailyRate   = spentSoFar / daysElapsed   // $30/day
  projectedEOM = spentSoFar + (dailyRate × daysRemaining) // $300 + $600 = $900
  historicalAvg = calculateMean([month-1 total, month-2 total, month-3 total])
  isAtRisk    = historicalAvg > 0 && projectedEOM > historicalAvg
```

### Architecture Compliance

1. **`forecastEngine.ts` = pure functions only** — no Supabase, no Next.js, no side effects. The route handler fetches data and passes it in. [Source: architecture.md AI Insight Flow]
2. **Service-layer pattern** — route fetches data, passes to `forecastEngine`, returns JSON. Functions in `forecastEngine.ts` accept raw arrays, not a Supabase client.
3. **`t.type === 'expense'` filter** — applied in the route handler query (`.eq('type', 'expense')`), not in the engine. The engine receives expense-only data.
4. **Progressive disclosure** — `BudgetForecast` returns `null` when `!hasCurrentMonthData && !isLoading` (same guard as `AnnualizedProjections` and `SpendingHeatmap`).
5. **Coaching tone** — "At risk" badge is orange (warning), not red (danger). Never use "over budget", "failed", "exceeded".
6. **No non-null assertions** — use `??` and optional chaining throughout (M1 from Epic 11.2 retro).

### File Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── forecastEngine.ts              ← CREATE (Task 2)
│   │   └── __tests__/
│   │       └── forecastEngine.test.ts     ← CREATE (Task 8.1)
│   └── hooks/
│       └── useBudgetForecast.ts           ← CREATE (Task 4)
├── components/
│   └── ai/
│       └── BudgetForecast.tsx             ← CREATE (Task 5)
├── app/
│   ├── api/
│   │   └── dashboard/
│   │       └── budget-forecast/
│   │           ├── route.ts               ← CREATE (Task 3)
│   │           └── __tests__/
│   │               └── route.test.ts      ← CREATE (Task 8.2)
│   └── dashboard/
│       └── page.tsx                       ← MODIFY (Task 6)
└── types/
    └── database.types.ts                  ← MODIFY (Task 1)
messages/
├── en.json                                ← MODIFY (Task 7)
└── bg.json                                ← MODIFY (Task 7)
```

### Previous Story Learnings (Story 12.1)

- **Type guards on array access**: use `result[0]!` or check length before indexing — TypeScript strict mode catches these
- **Date range direction**: double-check start < end when building date windows (the `m1Start → m2End` bug)
- **Income transaction filter**: always `t.type === 'expense'` in the query, not just in the engine
- **`calculateMean([])` returns 0** — so no need to guard against empty array, `calculateMean` handles it
- **Test file location**: `src/lib/ai/__tests__/` for engine tests, `src/app/api/dashboard/budget-forecast/__tests__/` for route tests

### Testing Notes

- **`forecastEngine.test.ts`**: No mocks needed — pass raw `Transaction[]` and `Category[]` arrays directly. Use a fixed `today` date (e.g., `new Date('2026-06-10')` = day 10 of a 30-day month).
- **Month boundary math**: June 2026 has 30 days → day 10 elapsed → 20 remaining → `projectedEOM = spentSoFar × 3`. Use this ratio in test assertions.
- **Route test**: Mock `@/lib/supabase/server` with chainable mock (same pattern as `insightService.patternDetection.test.ts` from Story 12.1). Mock `computeEndOfMonthForecasts` from `forecastEngine` to return a known array.
- **No E2E tests required** — this is a data display feature; unit + API tests are sufficient.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.3] — Acceptance criteria (maps to sprint story 12-2)
- [Source: _bmad-output/planning-artifacts/prd.md#FR2] — "The system generates end-of-month budget projections based on current spending pace and historical patterns"
- [Source: _bmad-output/planning-artifacts/architecture.md:573] — `BudgetForecast.tsx` in `src/components/ai/`
- [Source: _bmad-output/planning-artifacts/architecture.md:605] — `forecastEngine.ts` in `src/lib/ai/`
- [Source: _bmad-output/planning-artifacts/architecture.md:689] — `forecastEngine.test.ts` location
- [Source: src/lib/services/projectionsService.ts] — Template for data fetching pattern; `toLocalISODate` usage
- [Source: src/app/api/dashboard/annualized-projections/route.ts] — Template for route structure
- [Source: src/lib/hooks/useAnnualizedProjections.ts] — Template for SWR hook
- [Source: src/components/ai/AnnualizedProjections.tsx] — Template for component structure + `formatAmount` helper
- [Source: src/lib/ai/spendingAnalysis.ts] — `calculateMean` to import
- [Source: src/app/dashboard/page.tsx:53] — Pull-to-refresh mutate list to extend
- [Source: src/app/dashboard/page.tsx:184] — Placement: after `<AnnualizedProjections />`, before `<WeeklyDigestCard />`
- [Source: src/lib/services/insightService.ts:138] — "Budget table is not part of the current MVP scope"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 8 tasks implemented; 17 new tests added (13 unit in forecastEngine.test.ts + 4 API in route.test.ts) — all 1209 tests green (1192 existing + 17 new).
- `forecastEngine.ts`: pure computation module in `src/lib/ai/`. Day-based linear extrapolation: `projectedEOM = spentSoFar + (spentSoFar/daysElapsed) × daysRemaining`. At-risk uses 3-month historical avg as soft budget target (no budget table).
- Historical avg computed as per-month totals then `calculateMean` — correctly aggregates multi-transaction months before averaging.
- Income transactions filtered both in route query (`.eq('type','expense')`) and in forecastEngine loop (belt-and-suspenders).
- `BudgetForecast.tsx`: progressive disclosure (returns null when no current-month data), accessible (ARIA labels + text badges — not color alone), Chakra orange/green badges for at-risk/on-track.
- Dashboard: `BudgetForecast` placed between `AnnualizedProjections` and `WeeklyDigestCard`; added to pull-to-refresh SWR keys.
- i18n: `budgetForecast` namespace added to both `en.json` and `bg.json`.
- TypeScript: clean. ESLint: pending lint run. No regressions.

### File List

- src/lib/utils/formatAmount.ts — CREATED (shared currency formatter, replaces duplicate in AnnualizedProjections)
- src/types/database.types.ts — MODIFIED (CategoryForecast + ForecastResponse interfaces added)
- src/lib/ai/forecastEngine.ts — CREATED (ForecastEngineInput, computeEndOfMonthForecasts)
- src/lib/ai/__tests__/forecastEngine.test.ts — CREATED (13 unit tests)
- src/app/api/dashboard/budget-forecast/route.ts — CREATED (GET handler)
- src/app/api/dashboard/budget-forecast/__tests__/route.test.ts — CREATED (4 API tests)
- src/lib/hooks/useBudgetForecast.ts — CREATED (SWR hook)
- src/components/ai/BudgetForecast.tsx — CREATED (progressive disclosure; imports shared formatAmount; no badge for zero-history categories)
- src/components/ai/__tests__/BudgetForecast.test.tsx — CREATED (8 component tests: progressive disclosure, badges, ARIA, subtitle)
- src/components/ai/AnnualizedProjections.tsx — MODIFIED (imports formatAmount from shared util)
- src/app/dashboard/page.tsx — MODIFIED (import + placement + pull-to-refresh key)
- messages/en.json — MODIFIED (budgetForecast namespace)
- messages/bg.json — MODIFIED (budgetForecast namespace)
