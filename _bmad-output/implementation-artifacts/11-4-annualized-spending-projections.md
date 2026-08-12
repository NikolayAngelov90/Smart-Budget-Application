# Story 11.4: Annualized Spending Projections

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user planning finances,
I want to see annualized projections of my spending patterns broken down by category,
So that I understand the yearly cost of my current habits and can identify recurring vs one-time expenses.

## Acceptance Criteria

1. **Given** a user has fewer than 1 complete past calendar month of expense transactions, **When** they view the dashboard, **Then** the Spending Forecast section is hidden entirely (progressive disclosure — no empty state shown, section simply does not render).

2. **Given** a user has at least 1 complete past calendar month of expense data, **When** they view the dashboard, **Then** a "Spending Forecast" section appears below the Spending Heatmap (Story 11.3) showing each expense category with: monthly average, annualized projection (monthly avg × 12), and transaction count for the analysis period.

3. **Given** the Spending Forecast is displayed, **When** a user's detected subscriptions (Story 11.2) contain categories that match projection entries, **Then** those categories are visually marked as "Recurring" to distinguish known fixed costs from variable expenses.

4. **Given** the Spending Forecast is displayed and the user has 4+ complete past months of data, **When** they view the projections, **Then** each category shows a trend indicator (↑ increasing, ↓ decreasing, or stable) comparing the most recent 3-month period to the prior 3-month period, expressed as a percentage change.

5. **Given** the Spending Forecast is displayed, **When** the section renders, **Then** a total annual projection row is shown at the bottom, summing all category projections.

6. **Given** the Spending Forecast is displayed, **When** amounts are formatted, **Then** they use the user's configured currency (from `useUserPreferences()`) — no hardcoded currency symbols.

7. **Given** data is loading, **When** `isLoading` is true, **Then** a skeleton placeholder (`<Skeleton>`) is shown for the section instead of the projection content.

8. **Given** the Spending Forecast section is rendered, **When** a screen reader user navigates it, **Then** the section has `aria-label`, heading level h2, and each category row amount is readable as text (not just visual formatting).

## Tasks / Subtasks

- [x] Task 1: TypeScript types (AC: all)
  - [x] 1.1 Add to `src/types/database.types.ts` in a dedicated `// PROJECTIONS TYPES (Story 11.4)` section:
    ```typescript
    export interface CategoryProjection {
      category_id: string;
      category_name: string;
      category_color: string;
      monthly_avg: number;           // Average monthly spend over analysis window, rounded 2dp
      annual_projection: number;     // monthly_avg × 12, rounded 2dp
      transaction_count: number;     // Total transactions in analysis period
      is_recurring: boolean;         // True if category matches a detected active/unused subscription
      trend: 'up' | 'down' | 'stable' | 'new';  // 'new' = no prior period data
      trend_percentage: number | null;            // % change vs prior period (null if 'new' or prior unavailable)
    }

    export interface ProjectionsResponse {
      projections: CategoryProjection[];
      hasEnoughData: boolean;        // true when ≥1 complete past month of expense transactions
      months_analyzed: number;       // Number of complete months used (1-3)
    }
    ```

- [x] Task 2: Projections service (AC: #1, #2, #3, #4, #5)
  - [x] 2.1 Create `src/lib/services/projectionsService.ts`
  - [x] 2.2 Implement `hasEnoughDataForProjections(supabase: SupabaseClient, userId: string): Promise<boolean>`
    - Compute `currentMonthStart = YYYY-MM-01` for the current month
    - Query: `.select('date').eq('user_id', userId).eq('type', 'expense').lt('date', currentMonthStart).limit(1)`
    - Return `true` if at least 1 expense transaction exists before the current month
    - Throw on DB error (do NOT return false silently)
  - [x] 2.3 Implement `getAnnualizedProjections(supabase: SupabaseClient, userId: string): Promise<ProjectionsResponse>`
    - **Date range setup:**
      - `currentMonthStart` = first day of current month (e.g., `2026-03-01`)
      - `currentPeriodEnd` = last day of the month before current (e.g., `2026-02-28`)
      - `currentPeriodStart` = first day of the month 3 months before current (e.g., `2025-12-01`)
      - `prevPeriodEnd` = `currentPeriodStart` - 1 day (e.g., `2025-11-30`)
      - `prevPeriodStart` = first day of the month 6 months before current (e.g., `2025-09-01`)
    - **Current period query:** transactions with category join for `currentPeriodStart` → `currentPeriodEnd`
      ```typescript
      supabase.from('transactions')
        .select('amount, category_id, date, categories(id, name, color)')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('date', currentPeriodStart)
        .lte('date', currentPeriodEnd)
        .order('date', { ascending: true })
      ```
    - **Previous period query:** same shape, different date range (`prevPeriodStart` → `prevPeriodEnd`)
    - **Months computation:** count distinct calendar months in current period data (e.g., if data only spans Dec-Jan, `months_analyzed = 2`)
    - **Aggregation (current period):** use `Map<string, { total: number, count: number, name, color }>` keyed by `category_id`
    - **Monthly average:** `Math.round((total / months_analyzed) * 100) / 100`
    - **Annual projection:** `Math.round(monthly_avg * 12 * 100) / 100`
    - **Trend computation:** for each category present in current period, compute previous period monthly average; compute `trend_percentage = Math.round(((curr - prev) / prev) * 100)`; classify: |change| < 5% → 'stable', > 0 → 'up', < 0 → 'down'; no prior data → 'new'
    - **Recurring flag:** query `detected_subscriptions` for user with `status IN ('active', 'unused')`; extract set of `category_id` values; set `is_recurring = true` for matching categories
    - **Sort:** descending by `annual_projection`
    - Return `{ projections, hasEnoughData: true, months_analyzed }`

- [x] Task 3: API route (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Create `src/app/api/dashboard/annualized-projections/route.ts`
  - [x] 3.2 Add `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
  - [x] 3.3 Auth pattern: `createClient()` → `supabase.auth.getUser()` → 401 if no session
  - [x] 3.4 Call `hasEnoughDataForProjections` first; if false return early with `{ projections: [], hasEnoughData: false, months_analyzed: 0 }` (always return complete shape)
    - If `hasEnoughData` is true: call `getAnnualizedProjections` and return full projections data
  - [x] 3.5 Catch block: `logger.error(...)`, return `{ error: { message: 'Failed to fetch projections' } }` with status 500
  - [x] 3.6 Match error shape `{ error: { message } }` (same as subscriptions route and heatmap route)

- [x] Task 4: SWR hook (AC: #1, #2, #7)
  - [x] 4.1 Create `src/lib/hooks/useAnnualizedProjections.ts`
  - [x] 4.2 SWR key: `/api/dashboard/annualized-projections` (static key, no params)
  - [x] 4.3 Fetcher throws on non-ok response (match `useSubscriptions.ts` pattern exactly)
  - [x] 4.4 Return `{ projections, hasEnoughData, months_analyzed, isLoading, error, mutate: KeyedMutator<ProjectionsResponse> }`
  - [x] 4.5 Safe defaults: `projections: data?.projections ?? []`, `hasEnoughData: data?.hasEnoughData ?? false`, `months_analyzed: data?.months_analyzed ?? 0`

- [x] Task 5: AnnualizedProjections component (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [x] 5.1 Create `src/components/ai/AnnualizedProjections.tsx` (`'use client'` directive)
  - [x] 5.2 Progressive disclosure: `if (!hasEnoughData && !isLoading) return null;`
  - [x] 5.3 Loading state: `<Skeleton height="200px" borderRadius="md" data-testid="projections-skeleton" />` while `isLoading`
  - [x] 5.4 Get currency: `const { preferences } = useUserPreferences(); const currency = preferences?.currency_format ?? '';`
  - [x] 5.5 Structure:
    ```tsx
    <Box as="section" aria-label={t('title')}>
      <VStack align="stretch" spacing={4}>
        <VStack align="start" spacing={0}>
          <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }}>
            {t('title')}
          </Heading>
          <Text fontSize="sm" color="gray.500">
            {t('subtitle', { count: months_analyzed })}
          </Text>
        </VStack>
        <Box borderRadius="md" border="1px solid" borderColor="gray.200" overflow="hidden">
          {/* Category rows */}
          {projections.map(p => <ProjectionRow key={p.category_id} projection={p} currency={currency} />)}
          {/* Total row */}
          <TotalRow total={totalAnnual} currency={currency} />
        </Box>
      </VStack>
    </Box>
    ```
  - [x] 5.6 `ProjectionRow` (internal component or inline): shows color swatch dot + category name, recurring badge if `is_recurring`, monthly avg, annual projection, trend badge
  - [x] 5.7 Trend badge: use Chakra `Badge` with `colorScheme`: 'red' for up, 'green' for down (spending less = green), 'gray' for stable/new; show `↑ +{pct}%` or `↓ -{pct}%` or "Stable" or "New"
  - [x] 5.8 Format amounts with `Intl.NumberFormat` (same `formatAmount` helper pattern as HeatmapGrid — extract to utility if desired, or inline with identical logic)
  - [x] 5.9 Total annual projection: sum all `p.annual_projection` values, displayed in a visually distinct footer row with `fontWeight="bold"`
  - [x] 5.10 Compute `totalAnnual = Math.round(projections.reduce((sum, p) => sum + p.annual_projection, 0) * 100) / 100`

- [x] Task 6: Dashboard integration (AC: #2)
  - [x] 6.1 Import `AnnualizedProjections` in `src/app/dashboard/page.tsx`
  - [x] 6.2 Add after the SpendingHeatmap section, wrapped in `<Box mb={{ base: 6, md: 8 }}>`
  - [x] 6.3 Add `/api/dashboard/annualized-projections` to pull-to-refresh `mutate` calls

- [x] Task 7: i18n strings (AC: all)
  - [x] 7.1 Add `projections` namespace to `messages/en.json`:
    ```json
    "projections": {
      "title": "Spending Forecast",
      "subtitle": "Based on last {count} months of data",
      "monthlyAvg": "Monthly avg",
      "annualProjection": "Annual",
      "recurring": "Recurring",
      "totalLabel": "Total annual forecast",
      "trendNew": "New",
      "trendStable": "Stable",
      "trendUp": "+{percentage}%",
      "trendDown": "-{percentage}%",
      "loading": "Loading spending forecast..."
    }
    ```
  - [x] 7.2 Add same keys to `messages/bg.json` with Bulgarian translations

- [x] Task 8: Tests (AC: all)
  - [x] 8.1 Unit tests at `src/lib/services/__tests__/projectionsService.test.ts`:
    - `hasEnoughDataForProjections`: returns true with expense before current month, false with no past expenses, false with only current-month expenses, throws on DB error
    - `getAnnualizedProjections`: aggregates correctly across multiple categories, computes monthly avg as total/months, annual projection = monthly_avg × 12, rounds to 2dp, trend 'new' when no prior period, trend 'up'/'down'/'stable' with correct % calculation, `is_recurring` set correctly when category matches detected subscription, sort order descending by annual_projection
    - Use `createOrderChainMock` and `createEqTerminalChainMock` patterns from `src/lib/services/__tests__/heatmapService.test.ts` as reference — adapt for `order()`, `eq()`, `lt()`, `in()` terminal calls as needed
  - [x] 8.2 Integration tests at `src/app/api/dashboard/annualized-projections/__tests__/annualized-projections.test.ts`:
    - Returns 401 without auth
    - Returns projections with `hasEnoughData: true` for authenticated user
    - Returns `{ projections: [], hasEnoughData: false }` when no past month data
    - Returns 500 on service error
    - Use `@jest-environment node`, mock `next/server` before imports (match heatmap.test.ts pattern exactly)
  - [x] 8.3 Unit tests at `src/components/ai/__tests__/AnnualizedProjections.test.tsx`:
    - Returns null when `hasEnoughData: false` and not loading
    - Shows skeleton when `isLoading: true`
    - Renders heading "Spending Forecast"
    - Renders category row with name, monthly avg, annual projection
    - Shows "Recurring" badge for `is_recurring: true` category
    - Shows trend badge for 'up', 'down', 'stable', 'new'
    - Renders total row with sum of annual projections
    - Mock `useAnnualizedProjections`, `useUserPreferences`, `next-intl`

## Dev Notes

### Current State (What Exists)

**Dashboard layout** (`src/app/dashboard/page.tsx`):
- Current section order: Stats → AIBudgetCoach → Charts Grid (Pie + Line, 2-column) → MonthOverMonth → SpendingHeatmap → TransactionEntryModal
- **AnnualizedProjections goes after SpendingHeatmap**, before TransactionEntryModal
- Pull-to-refresh: add `/api/dashboard/annualized-projections` to the `mutate` list

**Existing API routes for reference:**
- `src/app/api/dashboard/spending-by-category/route.ts` — **PRIMARY REFERENCE**: uses `createClient()`, `export const dynamic = 'force-dynamic'`, date range queries with category join, in-JS Map aggregation. Use as exact template for the projections route.
- `src/app/api/heatmap/route.ts` — reference for `Promise.all` pattern for parallel service calls
- `src/app/api/subscriptions/route.ts` — reference for error response shape: `{ error: { message } }`

**Existing service for recurring cross-reference (`src/lib/services/subscriptionService.ts`):**
- The `detected_subscriptions` table (Story 11.2) stores detected recurring charges
- Fields include: `user_id`, `category_id`, `name`, `amount`, `frequency`, `status`
- Query for user's active recurring categories:
  ```typescript
  supabase.from('detected_subscriptions')
    .select('category_id')
    .eq('user_id', userId)
    .in('status', ['active', 'unused'])
  ```
- Use resulting `Set<string>` of category_ids to flag `is_recurring`

**Existing hooks for reference:**
- `src/lib/hooks/useSubscriptions.ts` — exact SWR pattern to replicate
- `src/lib/hooks/useSpendingHeatmap.ts` — for `KeyedMutator<T>` return type on mutate

**Existing component for reference:**
- `src/components/ai/SpendingHeatmap.tsx` — progressive disclosure pattern, skeleton loading, currency via `useUserPreferences`, `Box as="section"` + heading structure
- `src/components/ai/HeatmapGrid.tsx` — `formatAmount` with `Intl.NumberFormat` and empty-currency guard

**Transactions table schema** (from `src/types/database.types.ts`):
- `date` column is `DATE` type stored as `YYYY-MM-DD` string
- `amount` is `DECIMAL 12,2`
- `type` is `'income' | 'expense'`
- `category_id` FK to categories table
- Indexed on `user_id`, `date DESC`, `type` — date range queries by user+type are efficient

### What Changes

1. **New types** in `src/types/database.types.ts`: `CategoryProjection`, `ProjectionsResponse`
2. **New service**: `src/lib/services/projectionsService.ts`
3. **New API route**: `src/app/api/dashboard/annualized-projections/route.ts`
4. **New hook**: `src/lib/hooks/useAnnualizedProjections.ts`
5. **New component**: `src/components/ai/AnnualizedProjections.tsx`
6. **Modified**: `src/app/dashboard/page.tsx` — add AnnualizedProjections section + pull-to-refresh key
7. **Modified**: `messages/en.json` + `messages/bg.json` — add `projections` namespace

### Projection Algorithm Detail

```typescript
// Step 1: Date range setup
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth(); // 0-indexed

// Current period: last 3 complete calendar months
const currentPeriodEnd = new Date(currentYear, currentMonth, 0); // last day of previous month
const currentPeriodStart = new Date(currentYear, currentMonth - 3, 1); // 3 months back

// Previous period: 3 months before current period (for trend)
const prevPeriodEnd = new Date(currentYear, currentMonth - 3, 0); // last day of 6 months ago
const prevPeriodStart = new Date(currentYear, currentMonth - 6, 1); // 6 months back

// Format to YYYY-MM-DD for Supabase DATE comparison
const fmt = (d: Date) => d.toISOString().split('T')[0];

// Step 2: Count distinct months in current period data
// After fetching transactions, count unique 'YYYY-MM' prefixes in dates
const distinctMonths = new Set(data.map(tx => tx.date.substring(0, 7)));
const months_analyzed = Math.max(1, distinctMonths.size); // at least 1

// Step 3: Aggregation
const catMap = new Map<string, { total, count, name, color }>();
for (const tx of data) {
  const entry = catMap.get(tx.category_id) ?? { total: 0, count: 0, name: tx.categories.name, color: tx.categories.color };
  entry.total += Number(tx.amount);
  entry.count += 1;
  catMap.set(tx.category_id, entry);
}

// Step 4: Projections
for (const [catId, { total, count, name, color }] of catMap) {
  const monthly_avg = Math.round((total / months_analyzed) * 100) / 100;
  const annual_projection = Math.round(monthly_avg * 12 * 100) / 100;
  // ...trend from prevCatMap...
}

// Step 5: Trend
// For each category in current period:
// - If no data in prev period → 'new'
// - Otherwise: pct = (currMonthlyAvg - prevMonthlyAvg) / prevMonthlyAvg * 100
// - |pct| < 5 → 'stable', pct >= 5 → 'up', pct <= -5 → 'down'
```

### Architecture Compliance

- **RLS enforced**: All service functions accept `supabase: SupabaseClient` (never create client inside service — M1 lesson from Story 11.2)
- **No hardcoded currency**: Use `preferences?.currency_format ?? ''` with empty-string guard in format helper (H1 lesson from Story 11.2, reinforced in Story 11.3 code review)
- **No `!` non-null assertions** in source files (policy from Story 11.2, reinforced in Story 11.3 code review)
- **DB errors throw**: `if (error) throw error;` — never silently return empty (M4 lesson from Story 11.2)
- **KeyedMutator<T> return type**: use `import { type KeyedMutator } from 'swr'` in hook interface (L3 fix from Story 11.3 code review)
- **Consistent API response shape**: hasEnoughData:false path still returns complete shape `{ projections: [], hasEnoughData: false, months_analyzed: 0 }` (M3 lesson from Story 11.2)
- **No unused i18n keys**: plan all keys before implementation; every key in en.json/bg.json must be used in component (L lesson from Story 11.2)
- **ADR-024 indexes**: existing `idx_transactions_user_id` + `idx_transactions_date` cover `user_id + type + date` queries — no new migration needed
- **Additive only**: no schema changes to existing tables — purely reads `transactions`, `categories`, `detected_subscriptions`

### File Structure Requirements

```
src/
├── types/
│   └── database.types.ts              # MODIFY — add CategoryProjection, ProjectionsResponse
├── lib/
│   ├── services/
│   │   ├── projectionsService.ts      # NEW
│   │   └── __tests__/
│   │       └── projectionsService.test.ts  # NEW
│   └── hooks/
│       └── useAnnualizedProjections.ts     # NEW
├── components/
│   └── ai/
│       ├── AnnualizedProjections.tsx  # NEW
│       └── __tests__/
│           └── AnnualizedProjections.test.tsx  # NEW
└── app/
    ├── dashboard/
    │   └── page.tsx                   # MODIFY — add section + pull-to-refresh key
    └── api/
        └── dashboard/
            └── annualized-projections/
                ├── route.ts           # NEW — GET /api/dashboard/annualized-projections
                └── __tests__/
                    └── annualized-projections.test.ts  # NEW
messages/
├── en.json                            # MODIFY — add projections namespace
└── bg.json                            # MODIFY — add Bulgarian projections namespace
```

### Testing Requirements

- **`@jest-environment node`** on API integration test — mock `next/server` before all project imports (same as `heatmap.test.ts`)
- **Supabase mock chains**: `projectionsService.ts` uses `.order()` as terminal on the main query → use `createOrderChainMock` pattern; for `detected_subscriptions` query which ends in `.in()` → build chain with `.select().eq().in()` as terminal
- **ChakraProvider wrap**: all component tests wrapped in `<ChakraProvider>`
- **Mock `useAnnualizedProjections`** in component tests — do not test hook integration inside component tests
- **Mock `useUserPreferences`** — return `{ preferences: { currency_format: 'EUR' }, isLoading: false, error: undefined }`
- **No non-null assertions** (`!`) in test file mocks — use `as unknown as ReturnType<...>` double-cast pattern
- **Skeleton testid**: use `data-testid="projections-skeleton"` for test targeting (same pattern as `heatmap-skeleton`)

### i18n Keys — Complete List

```json
"projections": {
  "title": "Spending Forecast",
  "subtitle": "Based on last {count} months of data",
  "monthlyAvg": "Monthly avg",
  "annualProjection": "Annual",
  "recurring": "Recurring",
  "totalLabel": "Total annual forecast",
  "trendNew": "New",
  "trendStable": "Stable",
  "trendUp": "+{percentage}%",
  "trendDown": "-{percentage}%",
  "loading": "Loading spending forecast..."
}
```

**Bulgarian translations:**
```json
"projections": {
  "title": "Прогноза за разходите",
  "subtitle": "Базирано на последните {count} месеца данни",
  "monthlyAvg": "Средно/месец",
  "annualProjection": "Годишно",
  "recurring": "Повтарящо се",
  "totalLabel": "Обща годишна прогноза",
  "trendNew": "Ново",
  "trendStable": "Стабилно",
  "trendUp": "+{percentage}%",
  "trendDown": "-{percentage}%",
  "loading": "Зареждане на прогноза за разходите..."
}
```

Note: `trendUp` and `trendDown` values are identical between locales (`+12%`/`-12%`) — add to translations test allowlist if flagged.

### Previous Story Intelligence (from Stories 11.2 and 11.3 Code Review)

**APPLY ALL OF THESE — each was a real finding:**

1. **Service functions accept Supabase client as parameter (NEVER create their own)** — M1 from 11.2, reconfirmed in 11.3
2. **No hardcoded currency fallback 'EUR'** — H1 from 11.2 code review, fixed in 11.3 post-review
3. **DB errors throw, not silently return empty** — M4 from 11.2
4. **Consistent API response shape on all code paths** — M3 from 11.2
5. **No unused i18n keys** — L from 11.2; count keys in en.json and verify each is `t()`'d
6. **No `!` non-null assertions in source files** — M1 from 11.3 code review; use `?.` optional chaining
7. **`KeyedMutator<T>` return type on mutate in hook interface** — L3 from 11.3 code review
8. **ARIA roles for grid/row/gridcell hierarchy** — H1 from 11.3 code review; for projections this is a list layout not a grid, so use `<table>` or `<dl>` semantics if applicable

**Patterns that worked well (keep doing these):**
- `createOrderChainMock` / `createEqTerminalChainMock` builder functions for Supabase mocks in tests
- `as unknown as ReturnType<...>` for mock type casts
- `data-testid` for skeleton elements in loading state tests
- `within(container).getAllByRole(...)` for scoped ARIA queries in component tests
- Progressive disclosure: `if (!hasEnoughData && !isLoading) return null;` at top of component

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 11, Story 11.4 user story and ACs]
- [Source: _bmad-output/planning-artifacts/epics.md — FR11 Annualized Spending Projections requirement]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Dashboard layout with "Charts (Pie + Line + Proj)" section]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Progressive disclosure: appears after 2+ weeks/1 month of spending data]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-024 Database Indexing (existing indexes cover projection queries)]
- [Source: _bmad-output/planning-artifacts/architecture.md — NFR1 performance targets (<300ms chart updates)]
- [Source: src/app/api/dashboard/spending-by-category/route.ts — PRIMARY: date range query + category join + Map aggregation pattern]
- [Source: src/app/api/heatmap/route.ts — Promise.all parallel service call pattern]
- [Source: src/app/api/subscriptions/route.ts — error response shape { error: { message } }]
- [Source: src/lib/services/subscriptionService.ts — detected_subscriptions table structure and category_id field]
- [Source: src/lib/hooks/useSubscriptions.ts — SWR hook pattern with KeyedMutator]
- [Source: src/lib/hooks/useSpendingHeatmap.ts — KeyedMutator<T> return type pattern]
- [Source: src/components/ai/SpendingHeatmap.tsx — progressive disclosure + skeleton + section structure]
- [Source: src/components/ai/HeatmapGrid.tsx — formatAmount with Intl.NumberFormat + empty-currency guard]
- [Source: _bmad-output/implementation-artifacts/11-3-spending-heatmap.md — Code review corrections to apply]
- [Source: _bmad-output/implementation-artifacts/11-2-subscription-detection.md — M1/M3/M4 lessons]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

1. **Component null test fix**: `container.firstChild` check failed because ChakraProvider renders `<span hidden id="__chakra_env" />` even when component returns null. Fixed by using `queryByRole('region', { name: /spending forecast/i })` instead.
2. **Translations allowlist**: `projections.trendUp` and `projections.trendDown` flagged as "untranslated" because `+{percentage}%`/`-{percentage}%` are identical in both locales (numeric format is language-agnostic). Added to allowlist in `translations.test.ts` as anticipated in story Dev Notes.
3. **Unused import lint warning**: `ProjectionsResponse` imported but not directly referenced in AnnualizedProjections.test.tsx. Removed the unused import.
4. **[Code Review H1] fmt() timezone bug**: `toISOString().split('T')[0]` returns UTC date. Fixed to use local date components (`getFullYear()`/`getMonth()`/`getDate()`) — matching heatmapService pattern.
5. **[Code Review M1] transaction_count not displayed**: AC #2 requires transaction count in the UI. Added `transaction_count` display in `ProjectionRow`, added `projections.transactions` i18n key in en.json/bg.json, added component test asserting count is rendered.
6. **[Code Review M2] Missing explicit test**: Added dedicated test for `hasEnoughDataForProjections` returning false for current-month-only scenario, verifying `lt()` is called with a `YYYY-MM-01` pattern.
7. **[Code Review L1] Unused i18n keys**: Removed `projections.loading` and `projections.trendNew` from en.json/bg.json — neither was used in the component.
8. **[Code Review L2] `_last` border never fired**: Removed `_last={{ borderBottom: 'none' }}` from `ProjectionRow` — `:last-child` targeted `TotalRow`, not the last category row. `TotalRow`'s gray background already provides visual separation.
9. **[Code Review L3] Missing subscriptions error test**: Added test asserting `getAnnualizedProjections` throws when `detected_subscriptions` query fails.
10. **[Code Review L4] Trend badge shown for new users**: `TrendBadge` now returns `null` for `trend === 'new'` (AC #4: trend only shown with 4+ months of history). Updated component test accordingly.

### Completion Notes List

- Implemented all 8 tasks covering TypeScript types, projections service, API route, SWR hook, component, dashboard integration, i18n (EN + BG), and tests
- 31 new tests added across 3 test files (service unit, API integration, component unit)
- Full regression suite: 1017 tests pass across 77 suites — zero regressions
- Linting: zero errors or warnings
- All previous story learnings applied: no ! assertions, no hardcoded currency, DB errors throw, consistent API shape, KeyedMutator<T> return type, progressive disclosure pattern
- Algorithm: parallel Promise.all for current period, previous period, and subscriptions queries; distinct months counting; trend % comparison with 5% threshold

### File List

- src/types/database.types.ts (modified — added CategoryProjection, ProjectionsResponse)
- src/lib/services/projectionsService.ts (new)
- src/lib/services/__tests__/projectionsService.test.ts (new)
- src/app/api/dashboard/annualized-projections/route.ts (new)
- src/app/api/dashboard/annualized-projections/__tests__/annualized-projections.test.ts (new)
- src/lib/hooks/useAnnualizedProjections.ts (new)
- src/components/ai/AnnualizedProjections.tsx (new)
- src/components/ai/__tests__/AnnualizedProjections.test.tsx (new)
- src/app/dashboard/page.tsx (modified — added AnnualizedProjections section + pull-to-refresh key)
- messages/en.json (modified — added projections namespace)
- messages/bg.json (modified — added Bulgarian projections namespace)
- src/i18n/__tests__/translations.test.ts (modified — added projections.trendUp/trendDown to allowlist)
- messages/en.json (modified again — added projections.transactions key)
- messages/bg.json (modified again — added projections.transactions Bulgarian translation)

## Change Log

- 2026-03-28: Story implemented by claude-sonnet-4-6 — added annualized spending projections feature with service, API route, SWR hook, AnnualizedProjections component, dashboard integration, EN+BG i18n, and full test suite (31 tests). Status: ready-for-dev → review.
- 2026-03-28: Code review corrections by claude-sonnet-4-6 — fixed fmt() UTC timezone bug (H1), added transaction_count display to ProjectionRow (M1), added explicit current-month-only test for hasEnoughDataForProjections (M2), removed unused i18n keys (L1), fixed _last border selector (L2), added subscriptions DB error test (L3), hidden trend badge for 'new' trend per AC #4 (L4). 1020 tests pass. Status: review → done.
