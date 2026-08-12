---
baseline_commit: b1197b68cfae43e9ff2c6b4bb884f3cb7c13d429
---

# Story 12.8: Engagement Analytics Dashboard

Status: done

> Sprint story 12-8 = plan Story 12.8. Internal analytics (no FR — visualizes data collected since Stories 9-4/9-5). Final story of Epic 12.

## Story

As a product owner and power user,
I want to see how the app's AI insights and features are being used,
So that we can identify what's valuable and what to improve in future epics.

**Background:** Analytics events have been collected since Stories 9-4 (insight engagement) and 9-5 (export & PWA). The data exists but has never been visualized. Tracked events: `insight_viewed`, `insight_dismissed`, `insights_page_viewed`, `csv_exported`, `pdf_exported`, `pwa_installed`, `offline_mode_active`.

## Acceptance Criteria

1. **Given** an authenticated user **without** the `analytics_viewer` role, **When** they call `GET /api/analytics` or visit `/analytics`, **Then** access is denied server-side (403 from the API; access-denied state on the page). No analytics data is returned.

2. **Given** an authenticated user **with** the `analytics_viewer` role, **When** they visit `/analytics`, **Then** they see a read-only dashboard with: insight engagement (views vs dismissals per insight type over time), export usage (CSV vs PDF counts + volume), PWA installs (by platform + over time), and a weekly-active-users trend.

3. **Given** the dashboard is shown, **When** the user changes the date range (last 7 / 30 / 90 days), **Then** all charts refetch and reflect the selected window.

4. **Given** analytics aggregates are returned, **When** the response is built, **Then** it contains only aggregate counts/series — no user IDs, emails, or other PII.

5. **Given** the cross-user aggregation requires reading all users' events (RLS restricts users to their own rows), **When** aggregation runs, **Then** it uses the service-role client and only after the `analytics_viewer` check passes.

6. **Given** some funnel steps were never instrumented (insight "acted-on", PWA "prompt shown"/"retained"), **When** the dashboard renders, **Then** it shows the metrics that ARE tracked and does not fabricate untracked data (documented limitation).

## Tasks / Subtasks

- [x] Task 1: DB migration — `analytics_viewer` role flag (AC: #1, #5)
  - [x] 1.1 Create `supabase/migrations/019_analytics_viewer_role.sql`:
    ```sql
    ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS analytics_viewer BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.user_profiles.analytics_viewer IS 'Grants read access to the engagement analytics dashboard (Story 12.8). Set manually by an admin.';
    ```
  - [x] 1.2 Note in the migration: grant via `UPDATE user_profiles SET analytics_viewer = true WHERE id = '<uuid>';`

- [x] Task 2: TypeScript types (AC: #2, #4)
  - [x] 2.1 In `src/types/database.types.ts`, add `analytics_viewer: boolean` to `user_profiles` Row, and `analytics_viewer?: boolean` to Insert/Update.
  - [x] 2.2 Add domain types (after the re-engagement types):
    ```typescript
    export type AnalyticsRange = 7 | 30 | 90;

    export interface InsightEngagementPoint {
      insight_type: string;
      views: number;
      dismissals: number;
    }
    export interface ExportUsage {
      csv_count: number;
      pdf_count: number;
      csv_total_transactions: number; // sum of transaction_count
      pdf_total_pages: number;        // sum of page_count
    }
    export interface PwaInstallsByPlatform {
      platform: string; // 'iOS' | 'Android' | 'Desktop' | 'Unknown'
      count: number;
    }
    export interface WauPoint {
      week_start: string; // 'YYYY-MM-DD' (Monday)
      active_users: number;
    }
    export interface AnalyticsDashboardData {
      range_days: number;
      insight_engagement: InsightEngagementPoint[];
      export_usage: ExportUsage;
      pwa_installs_by_platform: PwaInstallsByPlatform[];
      pwa_installs_total: number;
      wau_trend: WauPoint[];
      total_events: number;
      generated_at: string;
    }
    export interface AnalyticsDashboardResponse {
      data: AnalyticsDashboardData;
    }
    ```

- [x] Task 3: Pure aggregator `src/lib/analytics/aggregateAnalytics.ts` (AC: #2, #4, #6)
  - [x] 3.1 `AnalyticsEventRow` minimal shape: `{ user_id: string; event_name: string; event_properties: Record<string, unknown> | null; timestamp: string }`.
  - [x] 3.2 `aggregateAnalytics(events: AnalyticsEventRow[], rangeDays: number): AnalyticsDashboardData`:
    - **insight_engagement**: group by `event_properties.insight_type`; count `insight_viewed` → views, `insight_dismissed` → dismissals. Sort by views desc.
    - **export_usage**: count `csv_exported`/`pdf_exported`; sum `transaction_count` (CSV) and `page_count` (PDF).
    - **pwa_installs**: group `pwa_installed` by `event_properties.platform` (fallback 'Unknown'); also total.
    - **wau_trend**: bucket all events by ISO week (Monday start, `YYYY-MM-DD`); count DISTINCT `user_id` per week; sort ascending.
    - `total_events = events.length`; output is PII-free (no user_id in result — only distinct counts).
  - [x] 3.3 Pure module — no Supabase. Use `date-fns` `startOfWeek`/`format` (weekStartsOn: 1) for week bucketing.

- [x] Task 4: Service `src/lib/services/analyticsDashboardService.ts` (AC: #1, #5)
  - [x] 4.1 `isAnalyticsViewer(supabase, userId): Promise<boolean>` — reads `user_profiles.analytics_viewer` via the user-scoped client (RLS allows reading own profile).
  - [x] 4.2 `getAnalyticsDashboard(serviceClient, rangeDays, today): Promise<AnalyticsDashboardData>` — fetches `analytics_events` since `today - rangeDays` via the **service-role** client (cross-user), calls `aggregateAnalytics`. Accepts the client as a parameter.

- [x] Task 5: API route `src/app/api/analytics/route.ts` (AC: #1, #3, #5)
  - [x] 5.1 `GET` — auth-gate (401). Parse `?range=` (7|30|90, default 30; reject others → 400).
  - [x] 5.2 `isAnalyticsViewer(userClient, user.id)`; if false → 403 `{ error: { message: 'Forbidden' } }`.
  - [x] 5.3 `createServiceRoleClient()` → `getAnalyticsDashboard(serviceClient, range, new Date())` → return `{ data }`. `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
  - [x] 5.4 Error → `logger.error` + 500.

- [x] Task 6: Hook `src/lib/hooks/useAnalyticsDashboard.ts` (AC: #3)
  - [x] 6.1 `useAnalyticsDashboard(range: AnalyticsRange)` → `useSWR<AnalyticsDashboardResponse>('/api/analytics?range=' + range, fetcher)`. Surface `data`, `isLoading`, `error`, `isForbidden` (set when the fetch returns 403), `mutate`. The fetcher must distinguish 403 (set a flag) from other errors.

- [x] Task 7: Page + components (AC: #1, #2, #3, #6)
  - [x] 7.1 `src/app/analytics/page.tsx` — `'use client'`, wrapped in `AppLayout`. Date-range selector (7/30/90 segmented control). Renders the four chart sections. If `isForbidden` → access-denied card. If `isLoading` → skeletons.
  - [x] 7.2 `src/components/analytics/InsightEngagementChart.tsx` — Recharts grouped `BarChart` (views vs dismissals per insight_type).
  - [x] 7.3 `src/components/analytics/ExportUsageChart.tsx` — CSV vs PDF counts (BarChart or stat cards) + volume figures.
  - [x] 7.4 `src/components/analytics/PwaInstallsChart.tsx` — installs by platform (BarChart) + total.
  - [x] 7.5 `src/components/analytics/WauTrendChart.tsx` — Recharts `LineChart` of weekly active users.
  - [x] 7.6 A small note that "acted-on" and PWA prompt/retention funnel steps aren't yet instrumented (AC #6). Charts handle empty data gracefully ("No data in this range").
  - [x] 7.7 Follow existing Recharts usage in `src/components/dashboard/CategorySpendingChart.tsx` / `SpendingTrendsChart.tsx` (ResponsiveContainer, theme colors).

- [x] Task 8: Navigation/access (AC: #1)
  - [x] 8.1 Do NOT add `/analytics` to the main nav for all users (it's role-gated). The page self-gates via the API 403. (Optional: conditionally show a nav link only when the profile is an analytics_viewer — out of scope; the direct URL + server enforcement is sufficient.)

- [x] Task 9: i18n (AC: #2)
  - [x] 9.1 Add `analytics` namespace to `messages/en.json` (title, range labels, the four section headings, "noData", "accessDenied", "notInstrumented" note).
  - [x] 9.2 Add Bulgarian equivalents.

- [x] Task 10: Tests (AC: all)
  - [x] 10.1 `src/lib/analytics/__tests__/aggregateAnalytics.test.ts` (pure):
    - insight engagement groups views/dismissals by type
    - export usage counts + sums transaction_count/page_count
    - pwa installs group by platform (+ Unknown fallback) and total
    - wau_trend buckets distinct users per ISO week
    - empty events → zeroed structure
  - [x] 10.2 `src/lib/services/__tests__/analyticsDashboardService.test.ts`:
    - `isAnalyticsViewer` true/false from profile
    - `getAnalyticsDashboard` fetches + delegates to aggregator (mock aggregator)
  - [x] 10.3 `src/app/api/analytics/__tests__/route.test.ts`:
    - 401 unauthenticated
    - 403 when not analytics_viewer
    - 400 on invalid range
    - 200 with data when viewer
  - [x] 10.4 `src/components/analytics/__tests__/*` — at least the page access-denied state + one chart renders with data and with empty data.

## Dev Notes

### Tracked vs Untracked (AC #6 — be honest)

Instrumented today: `insight_viewed`, `insight_dismissed`, `insights_page_viewed`, `csv_exported` (`{transaction_count}`), `pdf_exported` (`{month, page_count}`), `pwa_installed` (`{platform}`), `offline_mode_active`. **Not** instrumented: insight "acted-on", PWA "prompt shown" / "retained after 7 days". Build engagement as **views vs dismissals**, exports as **CSV vs PDF counts + volume**, PWA as **installs by platform + over time**, and **WAU** from distinct users/week. Show a small "not yet instrumented" note rather than fabricating funnel steps. (The epics AC's full funnels are aspirational; record this gap honestly.)

### Role Enforcement (AC #1, #5)

- New `user_profiles.analytics_viewer` boolean (migration 019), default false; admin grants via SQL.
- API: read the caller's own `analytics_viewer` with the **user-scoped** client (RLS-safe), 403 if false.
- Only after the check, use **`createServiceRoleClient()`** to aggregate across all users' `analytics_events` (RLS otherwise restricts to own rows). This is the one place service-role cross-user reads are justified, and it's gated.

### PII (AC #4)

The response contains only counts and time-series — never `user_id`, email, or `event_properties` that could identify a person. WAU is a distinct-count per week, not a user list.

### Architecture Compliance

1. **Pure aggregator** (`aggregateAnalytics.ts`) — no Supabase; service fetches and delegates (engine+service pattern used across Epic 12). New folder `src/lib/analytics/` is fine (analytics isn't AI).
2. **Service accepts the client** (service-role for aggregation, user client for the role check).
3. **Recharts** per existing dashboard charts (ADR-006 charts). `ResponsiveContainer` + theme colors.
4. **Timezone-safe** week bucketing via `date-fns startOfWeek(weekStartsOn:1)` + `toLocalISODate`/`format`.
5. **Read-only** dashboard; no mutations.
6. **a11y** — charts get accessible titles; color not sole signal (legends/labels).

### File Structure

```
supabase/migrations/019_analytics_viewer_role.sql        ← CREATE
src/
├── types/database.types.ts                               ← MODIFY (analytics_viewer + Analytics* types)
├── lib/
│   ├── analytics/
│   │   ├── aggregateAnalytics.ts                          ← CREATE
│   │   └── __tests__/aggregateAnalytics.test.ts           ← CREATE
│   ├── services/
│   │   ├── analyticsDashboardService.ts                   ← CREATE
│   │   └── __tests__/analyticsDashboardService.test.ts    ← CREATE
│   └── hooks/useAnalyticsDashboard.ts                     ← CREATE
├── components/analytics/
│   ├── InsightEngagementChart.tsx                         ← CREATE
│   ├── ExportUsageChart.tsx                               ← CREATE
│   ├── PwaInstallsChart.tsx                               ← CREATE
│   ├── WauTrendChart.tsx                                  ← CREATE
│   └── __tests__/AnalyticsCharts.test.tsx                 ← CREATE
└── app/
    ├── api/analytics/
    │   ├── route.ts                                       ← CREATE
    │   └── __tests__/route.test.ts                        ← CREATE
    └── analytics/page.tsx                                 ← CREATE
messages/{en,bg}.json                                      ← MODIFY (analytics namespace)
```

### Previous Story Learnings (12-1…12-6)

- Pure module + service-with-client + on-demand route; `force-dynamic` on the route.
- Route tests in jsdom (no `@jest-environment node`); mock `next/server` `NextResponse.json`; for `?range=` parse, construct a `NextRequest`-like `{ nextUrl: { searchParams: new URLSearchParams(...) } }` OR import real `NextRequest` (don't mock it) and only mock supabase — prefer the latter to keep `request.nextUrl` working.
- Service tests: chainable Supabase mock keyed by terminal (Story 12.4/12.6 pattern). For the service-role aggregation query (`gte('timestamp', …)` awaited), make the chain thenable.
- Component "returns null"/empty tests: assert on text/testid.
- `createServiceRoleClient` is synchronous (returns a client); `createClient()` is async.

### Git Intelligence

- `b1197b6` 12-6 — service-with-client + route role/branch patterns.
- Dashboard charts: `src/components/dashboard/CategorySpendingChart.tsx`, `SpendingTrendsChart.tsx` — Recharts templates.
- `createServiceRoleClient` used in `insightService.ts` for cross-RLS writes — same client for cross-user reads here.

### References

- [Source: epics.md#Story 12.8 — Engagement Analytics Dashboard] AC
- [Source: supabase/migrations/005_analytics_events_table.sql] events table + RLS (own-rows only → service-role needed for aggregation)
- [Source: src/lib/services/analyticsService.ts] event names + properties (insight_type, transaction_count, page_count, platform)
- [Source: src/components/dashboard/SpendingTrendsChart.tsx] Recharts LineChart template
- [Source: src/components/dashboard/CategorySpendingChart.tsx] Recharts BarChart/legend template
- [Source: src/lib/supabase/server.ts] createServiceRoleClient (cross-user aggregation)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 10 tasks implemented; 24 new tests (7 aggregator + 5 service + 5 route + 8 component, incl. malformed-timestamp guard) — 1345 total green (1320 prior + 25). TypeScript + ESLint clean. No regressions.
- `aggregateAnalytics.ts`: pure, PII-free. Insight views/dismissals by type; export CSV/PDF counts + volume; PWA installs by platform + total; WAU distinct-users per ISO week. Test asserts no user_id leak.
- Role enforcement: `analytics_viewer` column (migration 019); API checks it via the user client (RLS-safe), then aggregates cross-user via `createServiceRoleClient()` ONLY after the check. 401/403/400/200 covered.
- Page `/analytics`: role-gated (403 → access-denied state), 7/30/90 range selector, 4 Recharts charts, "not instrumented" honesty note. en/bg i18n.
- Honest scope: insight "acted-on" and PWA prompt/retention funnel steps aren't instrumented — shown as a note, not fabricated. "custom" date range deferred (7/30/90 covers the need).

### Code review (three-lens) — Approved

- [x] [LOW] Malformed event timestamps could create a junk WAU bucket → guarded with `Number.isNaN` check (+ test).
- [ ] [LOW] "custom" date range (epics AC) deferred to 7/30/90 — documented scope reduction.
- [ ] [LOW] In-memory aggregation acceptable at MVP scale (1–10 users, per PRD); move to SQL aggregation if scale grows.

### File List

- supabase/migrations/019_analytics_viewer_role.sql — CREATED (analytics_viewer column)
- src/types/database.types.ts — MODIFIED (analytics_viewer on user_profiles + Analytics* domain types)
- src/lib/analytics/aggregateAnalytics.ts — CREATED (pure PII-free aggregator)
- src/lib/analytics/__tests__/aggregateAnalytics.test.ts — CREATED (7 tests)
- src/lib/services/analyticsDashboardService.ts — CREATED (isAnalyticsViewer + getAnalyticsDashboard)
- src/lib/services/__tests__/analyticsDashboardService.test.ts — CREATED (5 tests)
- src/app/api/analytics/route.ts — CREATED (GET, role-gated, service-role aggregation)
- src/app/api/analytics/__tests__/route.test.ts — CREATED (5 tests)
- src/lib/hooks/useAnalyticsDashboard.ts — CREATED (SWR hook + 403 detection)
- src/components/analytics/InsightEngagementChart.tsx — CREATED
- src/components/analytics/ExportUsageChart.tsx — CREATED
- src/components/analytics/PwaInstallsChart.tsx — CREATED
- src/components/analytics/WauTrendChart.tsx — CREATED
- src/components/analytics/__tests__/AnalyticsCharts.test.tsx — CREATED (8 tests)
- src/app/analytics/page.tsx — CREATED (role-gated dashboard page)
- messages/en.json — MODIFIED (analytics namespace)
- messages/bg.json — MODIFIED (analytics namespace)
