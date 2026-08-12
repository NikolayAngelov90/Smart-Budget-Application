---
baseline_commit: 07ea5524aca8c2269ed4c1ce674dcdf17079102c
---

# Story 12.4: 30-Day Budget Recovery Plans

Status: done

> Sprint story 12-4 = plan Story 12.5 (see Epic 12 sprint-sequencing note in epics.md). Maps to **FR4**.

## Story

As a user who has overspent,
I want the system to generate a structured 30-day recovery plan,
So that I have a clear, realistic path back to healthy spending.

## Acceptance Criteria

1. **Given** a user has one or more categories where current-month spend exceeds that category's 3-month historical average (the budget proxy — no budget-limits table exists), **When** they open the recovery plan view or request a plan, **Then** the system generates a 30-day plan with a per-category target and derived daily and weekly spending targets.

2. **Given** a recovery plan is generated, **When** targets are computed, **Then** each category target is realistic — based on the user's **historical minimum** monthly spend for that category (the leanest month they've proven achievable), never below it.

3. **Given** a recovery plan is generated, **When** it is stored, **Then** it persists (one active plan per user) with a 30-day window so progress is trackable across sessions.

4. **Given** an active recovery plan exists, **When** the user views it, **Then** each category shows actual spend since the plan start vs. the monthly target with a progress indicator and on-track / over-target status (coaching tone — encouraging, never shaming).

5. **Given** an active recovery plan, **When** the user dismisses/abandons it or it reaches its end date, **Then** its status updates (`abandoned`/`completed`) and it no longer shows as the active plan.

6. **Given** the recovery plan is AI-generated financial content, **When** it is displayed, **Then** the `FinancialDisclaimer` is shown (FR39 compliance — established in story 12-7).

7. **Given** a user has no overspent categories, **When** they open the recovery plan view, **Then** a friendly empty state explains no recovery plan is needed right now (progressive disclosure — component returns null on the dashboard surface).

## Tasks / Subtasks

- [x] Task 1: DB migration — `recovery_plans` table (AC: #3)
  - [x] 1.1 Create `supabase/migrations/018_recovery_plans.sql` following the goals-table pattern (migration 013):
    ```sql
    CREATE TABLE IF NOT EXISTS public.recovery_plans (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
      targets JSONB NOT NULL,   -- array of RecoveryTarget objects
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE public.recovery_plans ENABLE ROW LEVEL SECURITY;
    -- RLS: 4 policies (select/insert/update/delete) USING/ WITH CHECK auth.uid() = user_id
    CREATE INDEX IF NOT EXISTS idx_recovery_plans_user_id ON public.recovery_plans (user_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_plans_user_status ON public.recovery_plans (user_id, status);
    -- updated_at trigger (reuse the update_*_updated_at() pattern from migration 013)
    ```
  - [x] 1.2 Copy the exact 4-policy RLS block + `updated_at` trigger function/trigger from `013_goals.sql` (rename to `update_recovery_plans_updated_at`).

- [x] Task 2: TypeScript types in `database.types.ts` (AC: #1-4)
  - [x] 2.1 Add the `recovery_plans` table to the `Database['public']['Tables']` interface (Row/Insert/Update/Relationships) — follow the `goals` table shape; `targets` typed as `Json`.
  - [x] 2.2 Add domain types after `ForecastResponse`:
    ```typescript
    export type RecoveryPlanStatus = 'active' | 'completed' | 'abandoned';

    export interface RecoveryTarget {
      category_id: string;
      category_name: string;
      category_color: string;
      historical_avg: number;     // 3-month avg (the overspend threshold)
      historical_min: number;     // leanest historical month (the realistic floor / target)
      monthly_target: number;     // = historical_min, rounded 2dp
      weekly_target: number;      // monthly_target / (30/7), rounded 2dp
      daily_target: number;       // monthly_target / 30, rounded 2dp
      current_spend: number;      // spend in this category since plan start (filled at read time)
    }

    export interface RecoveryPlan {
      id: string;
      user_id: string;
      start_date: string;         // YYYY-MM-DD
      end_date: string;           // YYYY-MM-DD (start + 30 days)
      status: RecoveryPlanStatus;
      targets: RecoveryTarget[];
      created_at: string;
      updated_at: string;
    }

    export interface RecoveryPlanProgress {
      plan: RecoveryPlan;
      days_elapsed: number;
      days_remaining: number;
      /** per category: on_track when current_spend <= pro-rated target for days elapsed */
      categories: Array<RecoveryTarget & { on_track: boolean; pct_of_target: number }>;
    }

    export interface RecoveryPlanResponse {
      plan: RecoveryPlanProgress | null;
      /** true when the user has overspent categories and a plan can be generated */
      canGenerate: boolean;
    }
    ```

- [x] Task 3: Create `src/lib/ai/recoveryPlanner.ts` — pure computation (AC: #1, #2)
  - [x] 3.1 `RecoveryPlannerInput`: `{ currentMonthTransactions: Transaction[]; historicalTransactions: Transaction[]; categories: Category[]; today: Date }`
  - [x] 3.2 `identifyOverspentCategories(input): RecoveryTarget[]`:
    - Aggregate current-month expense per category (reuse pattern from `forecastEngine.ts`).
    - Build per-category map of historical monthly totals (group `historicalTransactions` by `YYYY-MM` via `tx.date.substring(0,7)`, expense-only — same as forecastEngine).
    - `historical_avg = calculateMean(monthlyTotals)`; `historical_min = Math.min(...monthlyTotals)` (only over months with spend; if <1 prior month of data → skip category).
    - A category is overspent (in scope) when `currentMonthSpend > historical_avg && historical_avg > 0`.
    - `monthly_target = round(historical_min)`, `weekly_target = round(historical_min / (30/7))`, `daily_target = round(historical_min / 30)` — all 2dp.
    - Return targets sorted by overspend severity (currentSpend − historical_avg desc).
  - [x] 3.3 `buildRecoveryPlanTargets(input): RecoveryTarget[]` returns the scoped targets (empty array = no plan needed).
  - [x] 3.4 Import `calculateMean` from `./spendingAnalysis`; import types from `@/types/database.types`. Pure module — no Supabase, no `Date.now()` side effects beyond the passed `today`.

- [x] Task 4: Create `src/lib/services/recoveryPlanService.ts` (AC: #2, #3, #4, #5)
  - [x] 4.1 Accepts a `SupabaseClient` parameter (service-layer pattern — M1 Epic 11 retro). Functions:
    - `getActivePlanWithProgress(supabase, userId, today): Promise<RecoveryPlanResponse>` — fetch active plan; if present, compute progress (sum expense tx per target category since `start_date`, set `current_spend`, `on_track`, `pct_of_target`, `days_elapsed/remaining`). Also compute `canGenerate` by running the planner on fresh data.
    - `generatePlan(supabase, userId, today): Promise<RecoveryPlan>` — fetch current-month + prior-3-month expense tx + categories, run `buildRecoveryPlanTargets`, abandon any existing active plan (`status='abandoned'`), insert new active plan with `start_date=today`, `end_date=today+30d`.
    - `updatePlanStatus(supabase, userId, planId, status): Promise<void>` — set status (abandoned/completed), scoped to the user.
  - [x] 4.2 Date helpers: use `toLocalISODate` from `@/lib/utils/date` (same as `projectionsService.ts` / budget-forecast route). `end_date = start + 30 days`.
  - [x] 4.3 DB errors throw (never silently return empty) — M4 Epic 11 retro pattern.

- [x] Task 5: API routes (AC: #1, #3, #4, #5)
  - [x] 5.1 `src/app/api/recovery-plan/route.ts`:
    - `GET` — auth-gate (401), `createClient()`, return `getActivePlanWithProgress(...)`. `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
    - `POST` — auth-gate, call `generatePlan(...)`, return `{ plan }`. 400 if no overspent categories (`canGenerate` false).
  - [x] 5.2 `src/app/api/recovery-plan/[id]/route.ts`:
    - `PATCH` — auth-gate, body `{ status: 'abandoned' | 'completed' }`, call `updatePlanStatus(...)`, return `{ success: true }`.
  - [x] 5.3 Error pattern: `logger.error(...)` + `{ error: { message } }` with proper status (mirror `budget-forecast/route.ts`).

- [x] Task 6: SWR hook `src/lib/hooks/useRecoveryPlan.ts` (AC: #4)
  - [x] 6.1 Mirror `useBudgetForecast.ts`: `useSWR<RecoveryPlanResponse>('/api/recovery-plan', fetcher)`. Expose `plan`, `canGenerate`, `isLoading`, `error`, `mutate`, plus `generate()` (POST then mutate) and `dismiss(planId)` (PATCH abandoned then mutate).

- [x] Task 7: Component `src/components/ai/RecoveryPlan.tsx` (AC: #4, #6, #7)
  - [x] 7.1 `'use client'`. Uses `useRecoveryPlan()` + `useUserPreferences()` for currency. Uses shared `formatAmount` from `@/lib/utils/formatAmount`.
  - [x] 7.2 Progressive disclosure: if `!plan && !canGenerate && !isLoading` → return `null` (dashboard stays clean when no recovery needed).
  - [x] 7.3 If `canGenerate && !plan` → show a coaching call-to-action card with a "Create my recovery plan" button (calls `generate()`).
  - [x] 7.4 If `plan` (active) → render per-category rows: color swatch, name, monthly target, current spend vs target, Chakra `Progress` bar, on-track (green) / over-target (orange) badge with **text label** (not color alone — NFR28/a11y). Header shows days elapsed/remaining and a dismiss ("I'm done with this plan") action.
  - [x] 7.5 Always render `<FinancialDisclaimer />` (compact) inside the plan card (AC #6).
  - [x] 7.6 Loading: Chakra `Skeleton`. Coaching tone in all copy — "Let's get back on track", never "you failed".
  - [x] 7.7 ARIA labels on target amounts and progress bars.

- [x] Task 8: Dashboard integration (AC: #1, #7)
  - [x] 8.1 In `src/app/dashboard/page.tsx`, import `RecoveryPlan` and place it after `<BudgetForecast />` (recovery naturally follows the EOM forecast that reveals overspend), before `<WeeklyDigestCard />`.
  - [x] 8.2 Add `'/api/recovery-plan'` to the pull-to-refresh `mutate(...)` `Promise.all` block.

- [x] Task 9: i18n (AC: #4, #7)
  - [x] 9.1 Add `recoveryPlan` namespace to `messages/en.json`:
    ```json
    "recoveryPlan": {
      "title": "30-Day Recovery Plan",
      "subtitle": "Day {day} of 30 — {daysRemaining} days left",
      "ctaTitle": "Spending ran high in {count} categories",
      "ctaBody": "Create a realistic 30-day plan to ease back to your usual pace.",
      "createButton": "Create my recovery plan",
      "monthlyTarget": "Target",
      "spentSoFar": "Spent",
      "onTrack": "On track",
      "overTarget": "Over target",
      "dismiss": "I'm done with this plan",
      "emptyState": "No recovery plan needed — your spending is on track. Nice work!"
    }
    ```
  - [x] 9.2 Add Bulgarian equivalents to `messages/bg.json` under `recoveryPlan`.

- [x] Task 10: Tests (AC: all)
  - [x] 10.1 `src/lib/ai/__tests__/recoveryPlanner.test.ts` (pure, no mocks):
    - returns `[]` when no category exceeds historical average
    - returns `[]` when <1 prior month of history (can't compute min)
    - identifies an overspent category (current > avg) and sets `monthly_target = historical_min`
    - daily/weekly/monthly targets derived correctly and rounded 2dp
    - sorts by overspend severity desc
    - ignores income transactions
  - [x] 10.2 `src/lib/services/__tests__/recoveryPlanService.test.ts` (chainable Supabase mock per Story 12.2/12.3 pattern):
    - `getActivePlanWithProgress` returns null plan + canGenerate flag when no active plan
    - progress computation: `current_spend` summed since `start_date`, `on_track` correct vs pro-rated target
    - `generatePlan` abandons prior active plan then inserts new one
    - `updatePlanStatus` scopes update to user
  - [x] 10.3 `src/app/api/recovery-plan/__tests__/route.test.ts`:
    - GET 401 unauthenticated; GET returns plan/canGenerate; POST 400 when nothing to recover; POST creates plan
  - [x] 10.4 `src/components/ai/__tests__/RecoveryPlan.test.tsx`:
    - returns nothing when no plan + cannot generate
    - shows CTA when `canGenerate`
    - renders targets + progress + on-track/over-target badges when plan active
    - renders `FinancialDisclaimer` (AC #6)

## Dev Notes

### What Already Exists — Do NOT Re-Implement

- **`src/lib/ai/forecastEngine.ts`** — the historical-average + per-category aggregation pattern. `recoveryPlanner.ts` reuses the SAME approach (group historical tx by `YYYY-MM`, expense-only, `calculateMean`). Add `Math.min` for the historical minimum. Do NOT modify forecastEngine.
- **`src/lib/ai/spendingAnalysis.ts`** — `calculateMean`. Import it. `calculateMean([])` returns 0 (safe).
- **`src/lib/utils/formatAmount.ts`** — shared currency formatter (created in Story 12.2 review). Use it; do not duplicate.
- **`src/lib/utils/date.ts`** — `toLocalISODate`. Use for all date-boundary strings (timezone-safe; see Story 12.2 review fix — never use `.toISOString()` for local calendar dates).
- **`src/components/ai/FinancialDisclaimer.tsx`** — render `<FinancialDisclaimer />` on the plan (FR39, Story 12-7). Recovery plans are explicitly named in the disclaimer copy.
- **`supabase/migrations/013_goals.sql`** — the canonical table+RLS+trigger pattern to copy for `recovery_plans`.
- **`src/lib/hooks/useBudgetForecast.ts`** + **`src/app/api/dashboard/budget-forecast/route.ts`** — the exact hook + route templates to mirror.
- **Dashboard** (`src/app/dashboard/page.tsx`) — progressive-disclosure section pattern (each AI card returns null when not applicable) and the pull-to-refresh `mutate` list.

### Budget Definition (Critical)

There is **no budget-limits table** in the MVP (confirmed in architecture and `insightService.ts:138`). "Exceeded budget" (AC #1) means **current-month spend > 3-month historical average** for the category — the same proxy used by `forecastEngine` (at-risk) and `nudgeEngine`. The recovery **target** is the **historical minimum** monthly spend (the leanest proven month), which is the "realistic based on historical minimum spending" requirement from the epic AC. Document this proxy in the migration comment and the engine docstring so a future real budget table can reconcile it (already flagged in the Epic 12 sprint note in epics.md).

### Progress / On-Track Math

```
days_elapsed   = clamp(today − start_date, 0..30)
prorated_target = monthly_target × (days_elapsed / 30)
on_track        = current_spend <= prorated_target
pct_of_target   = monthly_target > 0 ? round(current_spend / monthly_target × 100) : 0
```
`current_spend` = sum of expense transactions in that category with `date >= start_date` (and `<= today`).

### Architecture Compliance

1. **`recoveryPlanner.ts` = pure functions** — no Supabase, no side effects. The service fetches data and passes it in. [architecture.md AI Insight Flow; matches forecastEngine/nudgeEngine]
2. **Service layer accepts the Supabase client** — never creates its own (M1 Epic 11 retro). [Source: projectionsService.ts, pushService.ts]
3. **RLS** — `recovery_plans` is user-scoped with 4 policies (ADR-013 goals pattern). No household scope in this story.
4. **Expense-only filter** — `.eq('type','expense')` in queries AND `tx.type === 'expense'` guard in the engine (belt-and-suspenders, per Story 12.1/12.2 reviews).
5. **Timezone-safe dates** — `toLocalISODate` / `.substring(0,7)`, never `.toISOString()` for calendar dates (Story 12.2 review fix).
6. **Coaching tone** — encouraging, never shaming (UX spec "Coaching, never judging"; YNAB "overspending is adjustable, not failure"). Orange (not red) for over-target; text labels alongside color (NFR28).
7. **FR39 disclaimer** on the AI-generated plan surface (Story 12-7).

### File Structure

```
supabase/migrations/
└── 018_recovery_plans.sql                         ← CREATE (Task 1)
src/
├── types/database.types.ts                        ← MODIFY (recovery_plans table + domain types)
├── lib/
│   ├── ai/
│   │   ├── recoveryPlanner.ts                     ← CREATE (Task 3)
│   │   └── __tests__/recoveryPlanner.test.ts      ← CREATE (Task 10.1)
│   ├── services/
│   │   ├── recoveryPlanService.ts                 ← CREATE (Task 4)
│   │   └── __tests__/recoveryPlanService.test.ts  ← CREATE (Task 10.2)
│   └── hooks/useRecoveryPlan.ts                   ← CREATE (Task 6)
├── components/ai/
│   ├── RecoveryPlan.tsx                           ← CREATE (Task 7)
│   └── __tests__/RecoveryPlan.test.tsx            ← CREATE (Task 10.4)
└── app/
    ├── api/recovery-plan/
    │   ├── route.ts                               ← CREATE (Task 5.1)
    │   ├── [id]/route.ts                          ← CREATE (Task 5.2)
    │   └── __tests__/route.test.ts                ← CREATE (Task 10.3)
    └── dashboard/page.tsx                         ← MODIFY (Task 8)
messages/{en,bg}.json                              ← MODIFY (Task 9)
```

### Previous Story Learnings (12-1, 12-2, 12-3)

- **`tx.date.substring(0, 7)`** for month keys — never `parseISO().toISOString()` (timezone bug fixed in 12-2 review).
- **Type-guard array access** (`arr[0]!` or length check) — strict mode + `noUncheckedIndexedAccess`.
- **`select('*')`** is fine for transaction reads (12-2 review simplified explicit column lists).
- **Route tests**: do NOT `jest.mock('next/server')` (breaks `NextRequest`); import it real and mock only `@/lib/supabase/server` (12-3 review fix). For pure node-only handlers, the chainable Supabase mock pattern from `insightService.patternDetection.test.ts` / budget-forecast route test works well.
- **Component "returns null" tests**: assert absence of heading/testid, not `container.firstChild` (Chakra injects an env span) — 12-2 review fix.
- **Migrations are not auto-applied** — remind the user to run `018_recovery_plans.sql` in Supabase after merge.

### Git Intelligence (recent commits)

- `07ea552` Story 12-7 disclaimers — `FinancialDisclaimer` now exists and must be used here.
- `b656146` Story 12-3 nudges — established `web-push`, but recovery plans need NO push (in-app only).
- `be6867f` Story 12-2 forecast — `forecastEngine.ts`, `formatAmount.ts`, budget-forecast route/hook = the primary templates for this story.
- `acc4dd1` Story 12-1 anomalies — `patternDetection.ts` historical-window patterns.

### References

- [Source: epics.md#Story 12.5 — 30-Day Budget Recovery Plans] AC (sprint 12-4, FR4)
- [Source: prd.md#FR4] "structured 30-day budget recovery plans for unhealthy spending patterns"
- [Source: architecture.md:607] `recoveryPlanner.ts` in `src/lib/ai/`
- [Source: architecture.md:574] `RecoveryPlan.tsx` in `src/components/ai/`
- [Source: architecture.md AI Insight Flow] pure-engine + service + route layering
- [Source: supabase/migrations/013_goals.sql] table + RLS + trigger pattern for migration 018
- [Source: src/lib/ai/forecastEngine.ts] historical aggregation pattern to reuse
- [Source: src/lib/utils/formatAmount.ts] shared currency formatter
- [Source: src/components/ai/FinancialDisclaimer.tsx] FR39 disclaimer (render on plan)
- [Source: src/app/api/dashboard/budget-forecast/route.ts + src/lib/hooks/useBudgetForecast.ts] route + hook templates
- [Source: ux-design-specification.md — "Coaching, never judging"] tone requirement

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 10 tasks implemented; 27 new tests (8 recoveryPlanner + 6 recoveryPlanService + 8 API routes + 5 RecoveryPlan component) — 1286 tests total green (1259 prior + 27). TypeScript + ESLint clean. No regressions.
- `recoveryPlanner.ts`: pure engine. Overspent = current-month spend > 3-month historical avg (budget proxy). Target = historical MINIMUM monthly spend; daily/weekly derived (÷30, ÷(30/7)). Sorted by overspend severity. Income-filtered both in query and engine.
- `recoveryPlanService.ts`: accepts Supabase client (service-layer pattern). `getActivePlanWithProgress` returns active plan + computed progress (pro-rated on-track) + `canGenerate`; `generatePlan` abandons any active plan then inserts new 30-day plan; `updatePlanStatus` scoped to owner. DB errors throw. Timezone-safe dates via `toLocalISODate` + `substring(0,7)`.
- API: `GET/POST /api/recovery-plan` (force-dynamic), `PATCH /api/recovery-plan/[id]`. POST returns 400 when nothing to recover.
- `RecoveryPlan.tsx`: progressive disclosure (null when no plan + can't generate); coaching CTA when `canGenerate`; active plan shows per-category `Progress` bars + on-track(green)/over-target(orange) text badges (not color alone); dismiss action; renders `FinancialDisclaimer` (FR39). Wired into dashboard after BudgetForecast + pull-to-refresh key.
- i18n `recoveryPlan` namespace added to en.json + bg.json.
- **Migration 018 must be applied in Supabase** before this feature works in production.

### File List

- supabase/migrations/018_recovery_plans.sql — CREATED (recovery_plans table + RLS + trigger)
- src/types/database.types.ts — MODIFIED (recovery_plans table type + RecoveryPlan/RecoveryTarget/Progress/Response domain types)
- src/lib/ai/recoveryPlanner.ts — CREATED (buildRecoveryPlanTargets pure engine)
- src/lib/ai/__tests__/recoveryPlanner.test.ts — CREATED (8 tests)
- src/lib/services/recoveryPlanService.ts — CREATED (getActivePlanWithProgress, generatePlan, updatePlanStatus)
- src/lib/services/__tests__/recoveryPlanService.test.ts — CREATED (6 tests)
- src/app/api/recovery-plan/route.ts — CREATED (GET + POST)
- src/app/api/recovery-plan/[id]/route.ts — CREATED (PATCH)
- src/app/api/recovery-plan/__tests__/route.test.ts — CREATED (8 tests)
- src/lib/hooks/useRecoveryPlan.ts — CREATED (SWR hook + generate/dismiss)
- src/components/ai/RecoveryPlan.tsx — CREATED (progressive-disclosure component)
- src/components/ai/__tests__/RecoveryPlan.test.tsx — CREATED (5 tests)
- src/app/dashboard/page.tsx — MODIFIED (import + placement after BudgetForecast + pull-to-refresh key)
- messages/en.json — MODIFIED (recoveryPlan namespace)
- messages/bg.json — MODIFIED (recoveryPlan namespace)

## Senior Developer Review (AI)

**Date:** 2026-06-02 · **Reviewer:** bmad-code-review (three-lens: Blind Hunter / Edge Case Hunter / Acceptance Auditor) · **Outcome:** Approved (all High/Medium resolved)

### Action Items

- [x] [MED] AC5 gap — plans never auto-completed at end date. Fixed: `getActivePlanWithProgress` marks a plan `completed` and clears it once `end_date < today`, freeing the CTA to reappear. (recoveryPlanService.ts) + new test.
- [x] [MED] Silent generate/dismiss failures in the UI. Fixed: error toast on both actions in `RecoveryPlan.tsx` (new `recoveryPlan.actionFailed` i18n key).
- [x] [LOW] Unused `recoveryPlan.emptyState` i18n key removed (component uses progressive-disclosure null); replaced with the now-used `actionFailed`.
- [ ] [LOW] `getActivePlanWithProgress` runs the canGenerate dataset fetch even when a plan is active — acceptable minor extra DB work, left as-is.

Post-fix: 1287 tests green, TypeScript + ESLint clean.
