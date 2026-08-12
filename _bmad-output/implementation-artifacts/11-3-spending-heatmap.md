# Story 11.3: Spending Heatmap

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user reviewing spending habits,
I want to view a calendar-style heatmap showing daily spending intensity,
So that I can quickly spot high-spend days and patterns at a glance.

## Acceptance Criteria

1. **Given** a user has 7+ days of transaction data, **When** they view the dashboard, **Then** a spending heatmap section appears below the Month-over-Month comparison, showing the current month's daily spending intensity using 5-level color gradients (from no-spend `#f7fafc` to peak-spend `#2b6cb0`).

2. **Given** the heatmap is displayed, **When** the user hovers over a day cell (desktop) or taps it (mobile), **Then** a tooltip/popover shows the total amount spent and transaction count for that day (e.g., "€142.50 spent, 5 transactions").

3. **Given** the heatmap is displayed, **When** the user clicks a day cell that has spending, **Then** they are navigated to the transactions list filtered to that specific date (use Next.js router push with `?date=YYYY-MM-DD` query param).

4. **Given** the heatmap is displayed, **When** the user clicks the previous month or next month navigation buttons, **Then** the heatmap data updates to show the selected month without a full page reload, and navigation to future months beyond the current month is disabled.

5. **Given** an accessible data table alternative is needed, **When** a user activates the "View as table" toggle button, **Then** the heatmap grid is replaced by a structured HTML table showing date, total amount, and transaction count for every day that has spending (screen reader accessible, with `<caption>` element).

6. **Given** a user has fewer than 7 distinct days with expense transactions, **When** they view the dashboard, **Then** the heatmap section is hidden entirely via progressive disclosure — no empty state is shown, the section simply does not render.

7. **Given** the heatmap grid is rendered, **When** a screen reader user navigates it, **Then** each day cell has `aria-label="[Month] [Day]: [Amount] spent, [Count] transaction(s)"` and cells with no spending have `aria-label="[Month] [Day]: No spending"`. The grid container has `role="grid"`, week rows have `role="row"`, and day cells have `role="gridcell"`.

8. **Given** the heatmap renders a month, **When** the month does not start on a Monday, **Then** the calendar correctly shows leading empty placeholder cells so days align with the correct weekday columns (Mon–Sun layout).

9. **Given** the heatmap section on the dashboard, **When** viewed on a mobile device (<768px), **Then** the calendar grid enables horizontal scroll so all 7 columns are visible without wrapping, and touch targets are at minimum 32×32px per cell.

## Tasks / Subtasks

- [x] Task 1: API endpoint for heatmap data (AC: #1, #2, #4)
  - [x] 1.1 Create `src/app/api/heatmap/route.ts` with `export const dynamic = 'force-dynamic'` and `export const revalidate = 0`
  - [x] 1.2 GET handler: parse `year` and `month` query params (default to current year/month via `new Date()`)
  - [x] 1.3 Auth check pattern: `createClient()` → `supabase.auth.getUser()` → 401 if no session (match existing routes)
  - [x] 1.4 Call `getDailySpending(supabase, user.id, year, month)` and `hasEnoughDataForHeatmap(supabase, user.id)`
  - [x] 1.5 Return `{ data: DailySpendingEntry[], year: number, month: number, hasEnoughData: boolean }`
  - [x] 1.6 Return `{ error: { message } }` format on failure (match existing error format from subscriptions route)

- [x] Task 2: Heatmap service (AC: #1, #3, #6)
  - [x] 2.1 Create `src/lib/services/heatmapService.ts`
  - [x] 2.2 Implement `getDailySpending(supabase: SupabaseClient, userId: string, year: number, month: number): Promise<DailySpendingEntry[]>`
    - Query `transactions` table: `select('date, amount').eq('user_id', userId).eq('type', 'expense').gte('date', firstDay).lte('date', lastDay).order('date', { ascending: true })`
    - Use `YYYY-MM-01` / `YYYY-MM-[last]` date strings (transactions use `DATE` column, not TIMESTAMP — match existing pattern from spending-by-category route)
    - Aggregate in JavaScript: `Map<string, { total: number, count: number }>` keyed by date string
    - Round totals to 2 decimal places: `Math.round(sum * 100) / 100` (NEVER float drift)
    - Return array sorted by date ascending
  - [x] 2.3 Implement `hasEnoughDataForHeatmap(supabase: SupabaseClient, userId: string): Promise<boolean>`
    - Query: `select('date').eq('user_id', userId).eq('type', 'expense')` and count distinct date values in JS (Supabase doesn't support `COUNT(DISTINCT)` directly in JS client)
    - Returns `true` if distinct date count >= 7
  - [x] 2.4 Export `getIntensityLevel(amount: number, maxAmount: number): 0 | 1 | 2 | 3 | 4`
    - If `amount === 0` or `maxAmount === 0`: return 0
    - Otherwise: compute ratio = amount / maxAmount, map to 1–4 using quartile thresholds: ≤0.25 → 1, ≤0.5 → 2, ≤0.75 → 3, >0.75 → 4

- [x] Task 3: TypeScript types (AC: all)
  - [x] 3.1 Add to `src/types/database.types.ts` (in a dedicated section, do NOT break existing types):
    ```typescript
    export interface DailySpendingEntry {
      date: string;       // YYYY-MM-DD
      total: number;      // rounded to 2 decimal places
      count: number;      // number of expense transactions
    }

    export interface HeatmapResponse {
      data: DailySpendingEntry[];
      year: number;
      month: number;      // 1-12
      hasEnoughData: boolean;
    }

    export type IntensityLevel = 0 | 1 | 2 | 3 | 4;
    ```

- [x] Task 4: SWR hook for heatmap data (AC: #1, #4)
  - [x] 4.1 Create `src/lib/hooks/useSpendingHeatmap.ts`
  - [x] 4.2 Accept `year: number, month: number` parameters
  - [x] 4.3 SWR key: `/api/heatmap?year=${year}&month=${month}` (changes on navigation trigger refetch)
  - [x] 4.4 Return `{ data: DailySpendingEntry[], year, month, hasEnoughData, isLoading, error, mutate }`
  - [x] 4.5 Follow exact pattern of `useSubscriptions.ts`: fetcher function throws on non-ok response

- [x] Task 5: HeatmapGrid component — the calendar grid (AC: #1, #2, #5, #7, #8, #9)
  - [x] 5.1 Create `src/components/ai/HeatmapGrid.tsx`
  - [x] 5.2 Props: `{ entries: DailySpendingEntry[], year: number, month: number, currency: string, onDayClick?: (date: string) => void }`
  - [x] 5.3 Compute calendar layout:
    - `daysInMonth = new Date(year, month, 0).getDate()`
    - `firstDayOfWeek = new Date(year, month - 1, 1).getDay()` — convert from Sun=0 to Mon=0: `(firstDayOfWeek + 6) % 7`
    - Build array of `null` (empty) + day numbers 1..daysInMonth
  - [x] 5.4 Define `HEATMAP_COLORS = ['#f7fafc', '#bee3f8', '#63b3ed', '#4299e1', '#2b6cb0']` as a const outside the component
  - [x] 5.5 Compute `maxAmount = Math.max(...entries.map(e => e.total), 0)` for intensity scaling
  - [x] 5.6 Build `entryMap = new Map(entries.map(e => [e.date, e]))` for O(1) lookup
  - [x] 5.7 Weekday header row: Mon, Tue, Wed, Thu, Fri, Sat, Sun — use i18n short weekday names
  - [x] 5.8 Grid structure implemented with role="grid", aria-hidden empty cells, Tooltip on day cells
  - [x] 5.9 Cell `aria-label`: `"${monthName} ${day}: ${formattedAmount} spent, ${count} transaction(s)"` or `"${monthName} ${day}: No spending"`
  - [x] 5.10 Cell sizing: `w={{ base: '32px', md: '40px' }} h={{ base: '32px', md: '40px' }}` with `borderRadius="sm"`
  - [x] 5.11 Keyboard navigation: cells are focusable (`tabIndex={0}`), Enter/Space key fires onDayClick
  - [x] 5.12 Data table alternative: render `<VisuallyHidden as="table">` always (for screen readers), plus a visible `<TableContainer>` conditionally shown when `showTable` state is true

- [x] Task 6: SpendingHeatmap wrapper component (AC: #1, #4, #6)
  - [x] 6.1 Create `src/components/ai/SpendingHeatmap.tsx`
  - [x] 6.2 Internal state:
    - `selectedYear`, `selectedMonth` — initialized with current year/month via `new Date()`
    - `showTable` — boolean for data table toggle
  - [x] 6.3 Call `useSpendingHeatmap(selectedYear, selectedMonth)`
  - [x] 6.4 Progressive disclosure: `if (!hasEnoughData && !isLoading) return null;`
  - [x] 6.5 Loading state: render `<Skeleton height="160px" borderRadius="md" />` while `isLoading`
  - [x] 6.6 Month navigation:
    - Previous: `IconButton` with `ChevronLeftIcon`, `aria-label={t('heatmap.previousMonth')}`
    - Next: `IconButton` with `ChevronRightIcon`, `aria-label={t('heatmap.nextMonth')}`, disabled when `selectedYear === today.year && selectedMonth === today.month`
    - On click: decrement/increment month, handling year rollover (month 0 → year-1, month 12 → year+1)
  - [x] 6.7 "View as table" / "View as grid" toggle: `Button` with `variant="ghost"` and `size="sm"`
  - [x] 6.8 On cell click → use `useRouter()` to push `/transactions?date=${dateString}`
  - [x] 6.9 Display: `<Box as="section">` with `Heading` (month + year) and `HeatmapGrid`
  - [x] 6.10 Get currency from `useUserPreferences()` hook (already exists), pass to HeatmapGrid for amount formatting

- [x] Task 7: Dashboard integration (AC: #1, #6, #9)
  - [x] 7.1 Import `SpendingHeatmap` in `src/app/dashboard/page.tsx`
  - [x] 7.2 Add after the Month-over-Month section, wrapped in `<Box mb={{ base: 6, md: 8 }}>`
  - [x] 7.3 No conditional logic needed in dashboard page — `SpendingHeatmap` handles progressive disclosure internally by returning `null` when `hasEnoughData` is false
  - [x] 7.4 Add `/api/heatmap` to pull-to-refresh `mutate` calls in `usePullToRefresh` callback

- [x] Task 8: i18n strings (AC: all)
  - [x] 8.1 Add `heatmap` namespace to `messages/en.json`:
    ```json
    "heatmap": {
      "title": "Spending Heatmap",
      "subtitle": "Daily spending intensity for {month} {year}",
      "previousMonth": "Previous month",
      "nextMonth": "Next month",
      "viewAsTable": "View as table",
      "viewAsGrid": "View as grid",
      "noSpending": "No spending",
      "transactions": "{count} transaction(s)",
      "loading": "Loading heatmap...",
      "weekdays": {
        "mon": "Mon",
        "tue": "Tue",
        "wed": "Wed",
        "thu": "Thu",
        "fri": "Fri",
        "sat": "Sat",
        "sun": "Sun"
      }
    }
    ```
  - [x] 8.2 Add same keys to `messages/bg.json` with Bulgarian translations

- [x] Task 9: Tests (AC: all)
  - [x] 9.1 Unit tests for `heatmapService.ts` at `src/lib/services/__tests__/heatmapService.test.ts` — 25 tests passing
  - [x] 9.2 Integration test for `GET /api/heatmap` at `src/app/api/heatmap/__tests__/heatmap.test.ts` — 6 tests passing
  - [x] 9.3 Unit tests for `HeatmapGrid` at `src/components/ai/__tests__/HeatmapGrid.test.tsx` — 21 tests passing
  - [x] 9.4 Unit tests for `SpendingHeatmap` at `src/components/ai/__tests__/SpendingHeatmap.test.tsx` — 12 tests passing

## Dev Notes

### Current State (What Exists)

**Dashboard page** (`src/app/dashboard/page.tsx`):
- Uses `'use client'` directive with SWR hooks
- Current layout order: Stats → AIBudgetCoach → Charts Grid (2-col) → MonthOverMonth
- Has pull-to-refresh (`usePullToRefresh`) that mutates specific SWR keys — add `/api/heatmap` key
- Already has `FirstTransactionPrompt` for progressive disclosure pattern (shows when 0 transactions)
- **SpendingHeatmap goes after MonthOverMonth**, before the TransactionEntryModal

**Existing dashboard API routes** (reference for patterns):
- `src/app/api/dashboard/spending-by-category/route.ts` — best reference: uses `createClient()`, `export const dynamic = 'force-dynamic'`, date range queries, in-JS aggregation, same error format
- Key pattern: dates queried as ISO strings but `date` field in transactions is `DATE` type (stored as `YYYY-MM-DD`)

**Transactions table** (`src/types/database.types.ts`):
- `Transaction`: `{ id, user_id, category_id, amount (DECIMAL 12,2), type ('income'|'expense'), date (DATE as string 'YYYY-MM-DD'), notes, currency, exchange_rate, created_at, updated_at }`
- Indexed on: `user_id`, `date DESC`, `type` — query by `user_id + type + date range` is covered

**Progressive disclosure** (`user_feature_state` table from Story 11.1):
- Tracks `days_active`, `transactions_count`, `features_unlocked`
- BUT: for heatmap, count distinct transaction days directly in `hasEnoughDataForHeatmap` rather than relying on `days_active` (which counts login days, not transaction days)

**Existing Chakra patterns**:
- `src/components/dashboard/MonthOverMonth.tsx` — reference for compact card with navigation (prev/next)
- `src/components/subscriptions/SubscriptionGraveyard.tsx` — reference for Chakra Accordion + progressive disclosure
- Import from `@chakra-ui/react`: Grid, Box, Tooltip, Skeleton, Heading, Text, IconButton, Button, VStack, HStack
- Import icons from `@chakra-ui/icons`: ChevronLeftIcon, ChevronRightIcon
- `VisuallyHidden` from `@chakra-ui/react` for accessible but visually hidden elements

**SWR hook pattern** — match `useSubscriptions.ts` exactly:
```typescript
export function useSpendingHeatmap(year: number, month: number) {
  const { data, error, isLoading, mutate } = useSWR<HeatmapResponse>(
    `/api/heatmap?year=${year}&month=${month}`,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch heatmap data');
      return response.json();
    }
  );
  return {
    data: data?.data ?? [],
    year: data?.year ?? year,
    month: data?.month ?? month,
    hasEnoughData: data?.hasEnoughData ?? false,
    isLoading,
    error,
    mutate,
  };
}
```

### What Changes

1. **New API route: `src/app/api/heatmap/route.ts`** — GET endpoint returning daily spending data
2. **New service: `src/lib/services/heatmapService.ts`** — `getDailySpending`, `hasEnoughDataForHeatmap`, `getIntensityLevel`
3. **New types** in `src/types/database.types.ts`: `DailySpendingEntry`, `HeatmapResponse`, `IntensityLevel`
4. **New hook: `src/lib/hooks/useSpendingHeatmap.ts`** — SWR hook parameterized by year/month
5. **New components: `HeatmapGrid.tsx` + `SpendingHeatmap.tsx`** in `src/components/ai/` (new directory)
6. **Modified: `src/app/dashboard/page.tsx`** — add SpendingHeatmap section below MonthOverMonth
7. **Modified: `messages/en.json` + `messages/bg.json`** — add `heatmap` namespace

### Architecture Compliance

- **ADR-019 (Background Jobs):** No cron job needed — heatmap is a real-time query, not a background job. Data is aggregated on-demand from the transactions table.
- **ADR-024 (Database Indexes):** The query `WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?` is covered by the existing `idx_transactions_user_id` and `idx_transactions_date` indexes. No new migration required.
- **No database migration needed** — heatmap is a read-only aggregation of the existing `transactions` table. Zero schema changes.
- **RLS enforced** — service functions accept `supabase: SupabaseClient` (from the API route, which holds the user session). **NEVER** create a Supabase client inside a service function — this was the key H1/M1 correction from Story 11.2 code review.
- **Brownfield:** No breaking changes to any existing table or API. Purely additive.
- **NFR1 (Performance):** Heatmap query is bounded by one month of transactions — well within <300ms chart update target. Use `select('date, amount')` (minimal columns) rather than `select('*')`.
- **NFR26 (Accessibility):** Data table alternative with `role="grid"` satisfies the explicit accessibility requirement from the PRD.
- **NFR28 (Color independence):** Heatmap cells must show amount numbers in tooltip, not just color — color alone is never the only indicator of meaning.

### Library & Framework Requirements

- **Chakra UI v2.8+** — Use `Grid`, `Box`, `Tooltip`, `Skeleton`, `Heading`, `Text`, `IconButton`, `Button`, `VStack`, `HStack`, `VisuallyHidden`, `TableContainer`, `Table`, `Thead`, `Tbody`, `Tr`, `Th`, `Td`, `Caption`. All are in `@chakra-ui/react`. Icons from `@chakra-ui/icons`.
- **SWR** — `useSWR` parameterized by year/month string key. Same pattern as all other hooks.
- **next-intl** — `useTranslations('heatmap')`. All new strings must have translations in both `messages/en.json` and `messages/bg.json`.
- **next/navigation** — `useRouter()` for day-click navigation to filtered transactions list.
- **No new npm dependencies required** — Everything is already installed. Do NOT add Recharts or any chart library for this feature; the heatmap is built with Chakra Grid + Box, not a chart library.
- **Date arithmetic** — Use native `Date` API (no date-fns needed here):
  - `new Date(year, month - 1, 1).getDay()` → first day weekday
  - `new Date(year, month, 0).getDate()` → days in month
  - `String(day).padStart(2, '0')` → day string for date keys

### File Structure Requirements

```
src/
├── lib/
│   ├── services/
│   │   └── heatmapService.ts                    # NEW — aggregation + intensity logic
│   │   └── __tests__/
│   │       └── heatmapService.test.ts            # NEW — unit tests
│   └── hooks/
│       └── useSpendingHeatmap.ts                # NEW — SWR hook parameterized by year/month
├── components/
│   └── ai/                                      # NEW DIRECTORY
│       ├── HeatmapGrid.tsx                      # NEW — calendar grid with color cells
│       ├── SpendingHeatmap.tsx                  # NEW — wrapper with navigation + progressive disclosure
│       └── __tests__/
│           ├── HeatmapGrid.test.tsx             # NEW
│           └── SpendingHeatmap.test.tsx         # NEW
├── types/
│   └── database.types.ts                        # MODIFY — add DailySpendingEntry, HeatmapResponse, IntensityLevel
├── app/
│   ├── dashboard/
│   │   └── page.tsx                             # MODIFY — add SpendingHeatmap section
│   └── api/
│       └── heatmap/
│           ├── route.ts                         # NEW — GET /api/heatmap
│           └── __tests__/
│               └── heatmap.test.ts              # NEW — integration test
messages/
├── en.json                                      # MODIFY — add heatmap namespace
└── bg.json                                      # MODIFY — add Bulgarian heatmap translations
```

### Calendar Layout Algorithm

```typescript
// Computing the grid cells array for a month
function buildCalendarCells(year: number, month: number): (number | null)[] {
  const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-indexed
  const rawFirstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun, 1=Mon...
  const firstDayMon = (rawFirstDay + 6) % 7; // Convert to Mon=0, Tue=1, ..., Sun=6

  const cells: (number | null)[] = [];
  // Leading empty cells
  for (let i = 0; i < firstDayMon; i++) cells.push(null);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Trailing empty cells to complete last row (optional, for visual consistency)
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Color intensity scale — defined as const outside component
const HEATMAP_COLORS: Record<IntensityLevel, string> = {
  0: '#f7fafc', // No spending — lightest gray (Chakra gray.50)
  1: '#bee3f8', // Low (~0-25% of max) — light blue
  2: '#63b3ed', // Medium-low (~25-50%) — Chakra blue.300
  3: '#4299e1', // Medium-high (~50-75%) — Chakra blue.400
  4: '#2b6cb0', // High (~75-100%) — Trust Blue (primary brand color)
};
```

### Date String Handling

- The `transactions.date` column is a PostgreSQL `DATE` type stored as `YYYY-MM-DD`
- Query the month with: `.gte('date', `${year}-${String(month).padStart(2, '0')}-01`).lte('date', `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`)`
- This is a simple string comparison (ISO date format sorts lexicographically correctly)
- Match the pattern from `spending-by-category` route: compute start/end dates before querying

### Testing Requirements

- **Test environment:** Component tests use default Jest environment (jsdom). API/service tests use `@jest-environment node`.
- **Supabase mocks:** Use chainable mock builder from `src/lib/test-utils/` (same as all other tests). For `getDailySpending`, mock `.select().eq().eq().gte().lte().order()` chain.
- **Integration test imports:** Mock `next/server` BEFORE any project imports (critical pattern from Story 11.2):
  ```typescript
  jest.mock('next/server', () => ({ NextResponse: { json: jest.fn(...) } }));
  ```
- **Type casts in mocks:** Use `as unknown as SomeType` double-cast pattern (established in 11.2 review) — avoid direct casts that fail TypeScript strict mode.
- **Non-null assertions:** Do NOT use `!` in source files. Guard with conditional checks or optional chaining instead (enforced from Story 11.2 review correction).
- **Component testing:** Wrap component renders in `ChakraProvider` via the existing test setup (`src/lib/test-utils/`).
- **Mock `useUserPreferences`** in component tests to provide a `currency_format` value.
- **Mock `useSpendingHeatmap`** in `SpendingHeatmap.test.tsx` — do not test the hook integration within component tests.
- **Test file naming:** `__tests__/` subdirectories mirroring source location (established pattern).

### Previous Story Intelligence (from Story 11.2 Code Review Corrections)

**HIGH PRIORITY — Apply these lessons to avoid repeat review failures:**

1. **M1 — Service functions must accept Supabase client as parameter (NOT create their own):**
   ```typescript
   // CORRECT (from 11.2 fix):
   export async function getDailySpending(supabase: SupabaseClient, userId: string, ...)
   // WRONG — do NOT do this:
   export async function getDailySpending(userId: string, ...) {
     const supabase = createClient(); // ← NEVER create client in service
   ```
   Why: Services called from API routes must inherit the user's session for RLS enforcement. A service-created client has no session and bypasses RLS.

2. **H1 — No hardcoded currency values:**
   - Do NOT hardcode `'EUR'` anywhere in heatmap components or service
   - Use `currency` from `useUserPreferences()` hook in components
   - The `amount` formatting should use the user's configured currency

3. **M4 — DB errors must throw, not silently return false:**
   ```typescript
   // CORRECT:
   const { data, error } = await supabase.from(...).select(...)
   if (error) throw error; // Let the API route catch this
   // WRONG:
   if (error) return []; // ← Silent failure masks real DB problems
   ```

4. **M3 — Consistent API response shapes:** Even the "no data" path (when `hasEnoughData === false`) must return a valid response object with all fields populated (not partial shapes).

5. **L issues from 11.2 to avoid:** Do not add unused i18n keys (added then removed the `perInterval` key). Plan all i18n keys before implementation and ensure every key is used.

**Patterns that worked well in 11.2:**
- `createDoubleOrderChainMock` helper for complex Supabase chain mocks — may need a similar helper for `.eq().eq().gte().lte().order()` chain
- `as unknown as ReturnType<...>` pattern for mock type casts — use this consistently
- Rebuilding chain objects imperatively (`const chain: any = {}; chain.select = jest.fn(()=>chain)`) when self-referencing chains cause `TS2448` errors

### Git Intelligence

**Recent commit patterns:**
- `853b7d0` feat: Implement Story 11.2 — Subscription Detection (Subscription Graveyard)
- `dccf8b2` feat: Implement Story 11.1 — Streamlined Onboarding Flow
- Conventional commits: `feat:` for story implementation, `fix:` for patches
- Single commit per story implementation: `feat: Implement Story 11.3 — Spending Heatmap`

**Code quality bar (from recent stories):**
- 920 tests existed after 11.2 — this story should add approximately 25-35 new tests
- TypeScript strict mode: zero `any` escapes in source files (test files may use `any` in mock builders)
- ESLint must pass with zero warnings
- `tsc --noEmit` must pass before considering implementation complete

### Project Structure Notes

- `src/components/ai/` does NOT yet exist — create it in this story (per architecture.md structure definition)
- This is the first component in the `ai/` directory; subsequent stories (12.x SmartNudge, WeeklyDigestCard) will add more
- Do NOT place `SpendingHeatmap.tsx` in `src/components/dashboard/` — the architecture explicitly specifies `src/components/ai/`
- The `(dashboard)` route group at `src/app/(dashboard)/` exists and has `settings/page.tsx`. A dedicated `/heatmap` page route is NOT in scope for this story — the heatmap lives as a section within the dashboard page. Add the dedicated page route in a future story if navigation requires it.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 11, Story 11.3 user story and acceptance criteria]
- [Source: _bmad-output/planning-artifacts/epics.md — FR10 Spending Heatmap requirement]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — HeatmapGrid custom component specification]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Heatmap intensity scale: 5 levels #f7fafc → #2b6cb0]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Progressive disclosure: appears after 7+ days of transactions]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Responsive layout: full grid desktop/tablet, horizontal scroll mobile]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Accessibility: role="grid", aria-labels, data table alternative toggle]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — GitHub contribution heatmap as direct design inspiration]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Dashboard placement: below charts, above AI Insights]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Empty state text: "Log a few transactions to see your spending patterns" with "Add Transaction" CTA]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-019 Background Job Strategy (no cron needed for heatmap)]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-024 Database Indexing (existing indexes cover heatmap query)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Component path: src/components/ai/SpendingHeatmap.tsx]
- [Source: _bmad-output/planning-artifacts/architecture.md — Route path: (dashboard)/heatmap/page.tsx (future)]
- [Source: src/app/api/dashboard/spending-by-category/route.ts — Date range query pattern and in-JS aggregation pattern]
- [Source: src/app/api/subscriptions/route.ts — API route auth + error format pattern]
- [Source: src/lib/hooks/useSubscriptions.ts — SWR hook pattern to follow exactly]
- [Source: src/app/dashboard/page.tsx — Dashboard layout for integration placement]
- [Source: _bmad-output/implementation-artifacts/11-2-subscription-detection.md — Code review corrections to apply]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed `HeatmapGrid.test.tsx`: empty cells are `aria-hidden="true"`, so accessible role query returns 31 cells; used `{ hidden: true }` to assert total 42 cells
- Fixed `translations.test.ts`: `heatmap.subtitle` template `{month} {year}` is identical in both locales — added to allowlist
- Fixed `SpendingHeatmap.test.tsx`: removed `updatePreferences: jest.fn()` from mock objects (field does not exist in `UseUserPreferencesResult`)

### Completion Notes List

- All 9 tasks and 31 subtasks completed
- 984 tests passing across 74 test suites (added 64 net new tests: 25 service + 6 API + 21 HeatmapGrid + 12 SpendingHeatmap)
- TypeScript strict mode: zero errors (`tsc --noEmit` clean)
- ESLint: zero warnings
- New `src/components/ai/` directory created as first AI visualization component directory per architecture.md
- Progressive disclosure implemented: component returns `null` when `hasEnoughData === false && !isLoading`
- Monday-first calendar layout: `(rawFirstDay + 6) % 7` converts Sun=0 to Mon=0
- All service functions accept `supabase: SupabaseClient` parameter (RLS enforced, M1 lesson from 11.2)
- No hardcoded currency — `Intl.NumberFormat` with user-preference currency (H1 lesson from 11.2)

### File List

- `src/types/database.types.ts` — added `DailySpendingEntry`, `HeatmapResponse`, `IntensityLevel`
- `src/lib/services/heatmapService.ts` — NEW: `getDailySpending`, `hasEnoughDataForHeatmap`, `getIntensityLevel`
- `src/lib/services/__tests__/heatmapService.test.ts` — NEW: 25 unit tests
- `src/app/api/heatmap/route.ts` — NEW: GET endpoint
- `src/app/api/heatmap/__tests__/heatmap.test.ts` — NEW: 6 integration tests
- `src/lib/hooks/useSpendingHeatmap.ts` — NEW: SWR hook parameterized by year/month
- `src/components/ai/HeatmapGrid.tsx` — NEW: calendar grid component
- `src/components/ai/SpendingHeatmap.tsx` — NEW: wrapper with navigation + progressive disclosure
- `src/components/ai/__tests__/HeatmapGrid.test.tsx` — NEW: 21 unit tests
- `src/components/ai/__tests__/SpendingHeatmap.test.tsx` — NEW: 12 unit tests
- `src/app/dashboard/page.tsx` — MODIFIED: added SpendingHeatmap section + heatmap pull-to-refresh key
- `messages/en.json` — MODIFIED: added `heatmap` namespace (11 keys + weekdays object)
- `messages/bg.json` — MODIFIED: added Bulgarian `heatmap` namespace
- `src/i18n/__tests__/translations.test.ts` — MODIFIED: added `heatmap.subtitle` to allowlist
