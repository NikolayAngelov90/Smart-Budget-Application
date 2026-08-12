# Story 12.1: Spending Anomaly & Trend Detection

Status: done

## Story

As a user tracking my budget,
I want the system to detect unusual spending patterns and surface actionable insights,
So that I'm alerted to problems before they become serious.

## Acceptance Criteria

1. **Given** a user has 2+ months of transaction history, **When** the AI analysis runs (triggered automatically or via manual refresh), **Then** spending anomalies — unusual spikes where a category's current month is ≥50% above its 2-month baseline average — are detected and persisted as insights.

2. **Given** anomaly detection runs, **When** new high-spend categories are found (a category newly appearing in the user's top-3 spenders that was not in their historical top-5), **Then** those are surfaced as `new_high_spend_category` insights.

3. **Given** anomaly or new-high-spend insights are generated, **When** they are stored, **Then** each insight includes the specific amount, category name, and a plain-language explanation in a coaching tone — encouraging, not judgmental.

4. **Given** a user has fewer than 2 complete months of prior transaction history, **When** anomaly detection runs, **Then** it returns zero anomaly/trend insights (graceful no-op — existing per-category rules still fire normally).

5. **Given** anomaly/trend insights are stored, **When** retrieved via `GET /api/insights`, **Then** the new types (`spending_anomaly`, `new_high_spend_category`) are returned and filterable like existing types.

## Tasks / Subtasks

- [x] Task 1: DB migration — extend `insight_type` enum (AC: #1, #2, #5)
  - [x] 1.1 Create `supabase/migrations/016_insight_type_expansion.sql`:
    ```sql
    -- Migration 016: Extend insight_type enum for Epic 12 pattern detection
    ALTER TYPE insight_type ADD VALUE IF NOT EXISTS 'spending_anomaly';
    ALTER TYPE insight_type ADD VALUE IF NOT EXISTS 'new_high_spend_category';
    ```
  - [x] 1.2 Note: `ALTER TYPE … ADD VALUE` cannot run inside a transaction block. In Supabase, this is fine — migrations run outside explicit transactions by default. The `IF NOT EXISTS` guard makes it idempotent.

- [x] Task 2: Update TypeScript types (AC: #1, #2, #5)
  - [x] 2.1 In `src/types/database.types.ts`, extend `InsightType`:
    ```typescript
    export type InsightType =
      | 'spending_increase'
      | 'budget_recommendation'
      | 'unusual_expense'
      | 'positive_reinforcement'
      | 'spending_anomaly'
      | 'new_high_spend_category';
    ```
  - [x] 2.2 In `src/app/api/insights/route.ts`, extend `VALID_INSIGHT_TYPES`:
    ```typescript
    const VALID_INSIGHT_TYPES: InsightType[] = [
      'spending_increase',
      'budget_recommendation',
      'unusual_expense',
      'positive_reinforcement',
      'spending_anomaly',
      'new_high_spend_category',
    ];
    ```

- [x] Task 3: Create `src/lib/ai/patternDetection.ts` (AC: #1, #2, #3, #4)
  - [x] 3.1 Define `PatternDetectionInput` interface (userId, transactions, categories, currentMonth)
  - [x] 3.2 Implement `detectSpendingAnomalies(input: PatternDetectionInput): InsightInsert[]`
    - Groups transactions by category ID
    - Computes totals for current month, month-1, month-2 using `startOfMonth`/`endOfMonth` + `subMonths` (already imported via `date-fns` in insightRules.ts)
    - Baseline = average of month-1 and month-2 totals
    - Guards: if month-1 OR month-2 has zero transactions for a category → skip (insufficient history)
    - Trigger: `currentTotal > baseline * 1.5` AND `baseline > 20` (avoids noise on tiny amounts)
    - Sorts results by percentage above baseline descending, returns top 3
    - Insight type: `'spending_anomaly'`, priority: 4
    - Message template: "Your {Category} spending ($X) is running Y% above your recent average ($Z). No panic needed — just something to keep in mind as the month wraps up."
    - Metadata fields: `category_id`, `category_name`, `current_amount`, `two_month_average`, `percent_above_baseline`, `current_month`
  - [x] 3.3 Implement `detectNewHighSpendCategories(input: PatternDetectionInput): InsightInsert[]`
    - Compute per-category totals for current month → sort desc → take top 3 IDs (currentTopIds)
    - Compute per-category totals for combined month-1 + month-2 → sort desc → take top 5 IDs (historicalTopIds)
    - New high-spend categories = currentTopIds.filter(id => !historicalTopIds.includes(id))
    - For each new high-spend category, return one insight (max 1 result total — surface the biggest new entrant)
    - Guard: if currentMonth has < 5 transactions across all categories → return [] (too early in month)
    - Insight type: `'new_high_spend_category'`, priority: 3
    - Message template: "{Category} has jumped into your top spending categories this month — $X spent so far. Worth keeping an eye on if you have budget targets in mind."
    - Metadata fields: `category_id`, `category_name`, `current_amount`, `current_month`, `previous_rank` (null = wasn't in top 5)
  - [x] 3.4 Import utilities from `@/lib/ai/spendingAnalysis` — do NOT re-implement `calculateMean`
  - [x] 3.5 Import `InsightInsert` from `@/types/database.types` — do NOT import from insightRules

- [x] Task 4: Integrate pattern detection into `insightService.ts` (AC: #1, #2)
  - [x] 4.1 Add imports at top of `src/lib/services/insightService.ts`:
    ```typescript
    import {
      detectSpendingAnomalies,
      detectNewHighSpendCategories,
    } from '@/lib/ai/patternDetection';
    ```
  - [x] 4.2 In `generateInsights()`, extend the data fetch: the existing 3-month lookback (`subMonths(currentMonth, 3)`) already covers the 2-month comparison window — no change to the query.
  - [x] 4.3 After the per-category `for` loop (after `allInsights.sort(...)` line), add pattern detection calls and re-sort.
  - [x] 4.4 Do NOT change the cache logic, the delete-and-reinsert logic, or the `shouldTriggerGeneration` function.

- [x] Task 5: Tests — `src/lib/ai/__tests__/patternDetection.test.ts` (AC: all)
  - [x] 5.1 Test `detectSpendingAnomalies` — insufficient data guards (3 tests)
  - [x] 5.2 Test `detectSpendingAnomalies` — anomaly detected (60% above baseline)
  - [x] 5.3 Test `detectSpendingAnomalies` — below threshold (10% above, no trigger)
  - [x] 5.4 Test `detectSpendingAnomalies` — baseline too small ($20 noise guard)
  - [x] 5.5 Test `detectSpendingAnomalies` — max 3 results cap + severity sort
  - [x] 5.6 Test `detectNewHighSpendCategories` — new entrant detected (Entertainment)
  - [x] 5.7 Test `detectNewHighSpendCategories` — stable top spenders → returns `[]`
  - [x] 5.8 Test `detectNewHighSpendCategories` — < 5 transactions → returns `[]`

## Dev Notes

### What Already Exists — Do NOT Re-Implement

- **`src/lib/ai/insightRules.ts`** — `detectSpendingIncrease` (month-over-month > 20%, per-category). Story 12-1 introduces DIFFERENT algorithms at a different scope — do NOT modify `insightRules.ts`.
- **`src/lib/ai/spendingAnalysis.ts`** — `calculateMean`, `calculateStdDev`, `calculateMonthOverMonth`, `isOutlier`. Import these; do NOT copy or rewrite.
- **`src/lib/services/insightService.ts`** — The `generateInsights` orchestrator, caching, delete-and-reinsert pattern. Only ADD the two import calls and the three lines after the category loop.
- **`src/app/api/cron/generate-insights/route.ts`** — Already runs daily (midnight UTC), calls `generateInsights`. No new cron route needed; pattern detection will execute automatically via the existing cron.
- **`src/app/api/insights/generate/route.ts`** — Manual POST trigger. No changes needed.
- **`vercel.json`** — Already has all three cron jobs. Do NOT add a new cron entry.
- **`POST /api/insights/generate`** — Manual refresh still works; no route changes needed.

### Distinction from Existing Rules

| Rule | Location | Algorithm | Scope | InsightType |
|------|----------|-----------|-------|-------------|
| `detectSpendingIncrease` | `insightRules.ts` | Current month vs prior month (>20%) | Per-category | `spending_increase` |
| `flagUnusualExpense` | `insightRules.ts` | Single transaction vs category mean (>2σ) | Per-category | `unusual_expense` |
| `detectSpendingAnomalies` (**NEW**) | `patternDetection.ts` | Current month vs 2-month average (>50%) | Cross-category, top-3 surfaced | `spending_anomaly` |
| `detectNewHighSpendCategories` (**NEW**) | `patternDetection.ts` | Rank shift (not in historical top-5, now in top-3) | Cross-category | `new_high_spend_category` |

### DB Migration Important Notes

- **PostgreSQL enum ordering**: `ALTER TYPE insight_type ADD VALUE` locks the type briefly. Must run outside a transaction. Supabase migrations are run outside explicit transactions by default — this is fine.
- **`IF NOT EXISTS`**: Use `ALTER TYPE insight_type ADD VALUE IF NOT EXISTS '...'` to make the migration safe to re-run (Supabase sometimes re-runs on schema push).
- **Migration number**: Check latest migration before creating. Current latest = `015_weekly_digests.sql` → next is `016_insight_type_expansion.sql`.

### Architecture Compliance

1. **Service layer pattern**: `patternDetection.ts` is a pure logic module (functions only, no Supabase calls). `insightService.ts` calls it and handles DB writes. [Source: _bmad-output/planning-artifacts/architecture.md#AI Insight Flow]
2. **No external AI APIs**: All detection is server-side deterministic rules (statistics). [Source: architecture.md line 73 — "No external AI APIs"]
3. **Coaching tone**: All insight messages must be encouraging, never shaming. Phrases to avoid: "you overspent", "you failed", "bad habit". Use: "worth keeping an eye on", "something to keep in mind", "no panic needed". [Source: _bmad-output/planning-artifacts/ux-design-specification.md — "Coaching, never judging"]
4. **InsightType as DB enum**: `insight_type` is a PostgreSQL enum (see `supabase/migrations/001_initial_schema.sql:16`). Adding new values requires a migration — a TypeScript-only change is NOT sufficient. [Source: migrations/001_initial_schema.sql]
5. **Folder for `patternDetection.ts`**: `src/lib/ai/patternDetection.ts` — same directory as `insightRules.ts` and `spendingAnalysis.ts`. [Source: architecture.md file tree — line 604]
6. **Test file path**: `src/lib/ai/__tests__/patternDetection.test.ts`. [Source: architecture.md — line 688]

### Project Structure Notes

```
src/
├── lib/
│   ├── ai/
│   │   ├── insightRules.ts          ← EXISTING — do NOT modify
│   │   ├── spendingAnalysis.ts      ← EXISTING — import from here
│   │   ├── patternDetection.ts      ← CREATE (Task 3)
│   │   └── __tests__/
│   │       └── patternDetection.test.ts  ← CREATE (Task 5)
│   └── services/
│       └── insightService.ts        ← MODIFY — add 3 import + 3 call lines (Task 4)
├── types/
│   └── database.types.ts            ← MODIFY — InsightType union (Task 2.1)
└── app/
    └── api/
        └── insights/
            └── route.ts             ← MODIFY — VALID_INSIGHT_TYPES (Task 2.2)
supabase/
└── migrations/
    └── 016_insight_type_expansion.sql  ← CREATE (Task 1)
```

Files NOT changed:
- `src/lib/ai/insightRules.ts`
- `src/lib/ai/spendingAnalysis.ts`
- `src/app/api/cron/generate-insights/route.ts`
- `src/app/api/insights/generate/route.ts`
- `vercel.json`
- All other API routes

### Testing Requirements

- **Test environment**: Pure unit tests — no `@jest-environment node` needed; `patternDetection.ts` has no Supabase or Next.js dependencies.
- **No mocking required**: `detectSpendingAnomalies` and `detectNewHighSpendCategories` are pure functions — pass in arrays of transactions/categories directly.
- **Transaction factory**: Build minimal transaction objects matching `Transaction` type from `@/types/database.types` — only `{ id, user_id, category_id, amount, date, type }` fields are needed.
- **Date arithmetic**: Use fixed reference dates (e.g., `new Date('2026-06-01')` as `currentMonth`) so tests are deterministic regardless of when they run.
- **Tone assertion**: At minimum assert the description does NOT contain words like "overspent" or "exceeded budget". Check that coaching words are present.

### Git Intelligence (Recent Commits)

- `2f84f08` — `chore: update dependencies and package versions` (non-feature, skip)
- `01f4a8d` — `chore: update Epic 12 scope with A1/A2 decisions` — expanded Story 12.4 scope (push notifications) + added Story 12.8 (engagement analytics). These are downstream stories; no impact on 12-1.
- `54e46e2` — `chore: implement Epic 11 retro action items and Epic 12 prep` — retro action items already applied to codebase; likely architecture/tooling prep for Epic 12.
- `17e683b` — `feat: Implement Story 11.8 — GDPR Account Deletion & weekly digest toggle` — established the weekly-digest toggle pattern in Settings. Follow the same `handleUpdatePreferences` extension pattern if any preference UI is needed in future stories.

### Previous Epic 11 Patterns to Carry Forward

From Story 11.8 (last completed story):
- Service-layer pattern: service functions accept the Supabase client OR have it injected; do NOT call Supabase from route handlers directly. `patternDetection.ts` follows the pure-function pattern (no client injection needed — it only does computation, not DB calls).
- `adminClient` (service-role) is used only for DB writes in `insightService.ts`. This pattern is already in place — Task 4 does not change the write path.
- Test count at end of Story 11.8: 1172 tests passing. Ensure no regressions.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.2] — Acceptance criteria (maps to sprint story 12-1)
- [Source: _bmad-output/planning-artifacts/prd.md#FR1] — "The system detects spending anomalies and trends from transaction history, surfacing specific, actionable insights"
- [Source: _bmad-output/planning-artifacts/architecture.md#AI Insight Flow] — Cron → insightService → ai/*.ts → Supabase pattern
- [Source: _bmad-output/planning-artifacts/architecture.md:604] — `patternDetection.ts` file location
- [Source: _bmad-output/planning-artifacts/architecture.md:688] — `patternDetection.test.ts` file location
- [Source: _bmad-output/planning-artifacts/architecture.md:73] — "No external AI APIs — all intelligence is server-side deterministic rules"
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-019] — Vercel Cron strategy; existing `/api/cron/generate-insights` covers this story
- [Source: supabase/migrations/001_initial_schema.sql:16] — `insight_type` is a PostgreSQL enum requiring migration for new values
- [Source: src/lib/services/insightService.ts] — `generateInsights` orchestrator — where to integrate calls
- [Source: src/lib/ai/insightRules.ts] — Existing rule patterns and `InsightInsert` shape to follow
- [Source: src/lib/ai/spendingAnalysis.ts] — Utility functions to import (`calculateMean`, `calculateMonthOverMonth`)
- [Source: src/types/database.types.ts:28] — `InsightType` union to extend
- [Source: src/types/database.types.ts:621] — `InsightMetadata` interface — add new fields with `[key: string]: Json | undefined` fallback already covers extensions
- [Source: src/app/api/insights/route.ts:21] — `VALID_INSIGHT_TYPES` array to extend
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md:99] — "Coaching, never judging" tone requirement

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 5 tasks implemented; 17 new tests added in `src/lib/ai/__tests__/patternDetection.test.ts` — all 1189 tests green (1172 existing + 17 new).
- Bug caught and fixed during TDD: historical date range in `detectNewHighSpendCategories` was inverted (`m1Start → m2End` = May 1 → April 30, which matched nothing). Fixed to `m2Start → m1End` (April 1 → May 31).
- `detectSpendingAnomalies`: triggers at ≥50% above 2-month average baseline; noise guard ($20 min baseline); max 3 insights sorted by severity.
- `detectNewHighSpendCategories`: early-month guard (≥5 current-month tx required); surfaces max 1 insight (biggest new entrant); correct historical window spans both prior months combined.
- Integration in `insightService.ts`: pattern detection added after per-category loop, results pushed and re-sorted before DB write. No changes to cache, delete, or trigger logic.
- TypeScript: clean (0 errors). ESLint: clean. No regressions.

### File List

- supabase/migrations/016_insight_type_expansion.sql — CREATED (extends insight_type enum with spending_anomaly and new_high_spend_category)
- src/types/database.types.ts — MODIFIED (InsightType union extended; InsightMetadata extended with two_month_average, percent_above_baseline)
- src/app/api/insights/route.ts — MODIFIED (VALID_INSIGHT_TYPES array extended)
- src/lib/ai/patternDetection.ts — CREATED (PatternDetectionInput, detectSpendingAnomalies, detectNewHighSpendCategories; type guard + history guard + income filter fixes applied)
- src/lib/services/insightService.ts — MODIFIED (import patternDetection; call both detection functions after category loop)
- src/lib/ai/__tests__/patternDetection.test.ts — CREATED (18 unit tests: guards, anomaly detection, new-entrant detection, new-user guard, coaching tone)
- src/lib/services/__tests__/insightService.patternDetection.test.ts — CREATED (2 integration smoke tests verifying pattern detection wiring in generateInsights)
