---
baseline_commit: a616385fd97e5e5abe2da73e296b0a2a8f41e5eb
---

# Story 13.9: Shared Household Savings Goals

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a household member,
I want to create shared savings goals with per-member contribution tracking,
so that we can save together toward common targets.

## Acceptance Criteria

1. **Given** a household exists, **When** a member creates a shared savings goal, **Then** the goal is created with a name, target amount, and optional deadline, tagged to the household.
2. **And** the goal is **visible to all household members** (not just the creator).
3. **Given** a shared goal, **When** any member contributes, **Then** their contribution is **tracked individually** (who gave how much) and the goal's accumulated total increases.
4. **Given** a shared goal with contributions, **When** a member views it, **Then** it shows **total progress** (current vs target) **and a per-member breakdown** (each member's contributed total).
5. **Given** transparency, **When** the breakdown is shown, **Then** it exposes **aggregate per-member totals only** (never individual contribution rows of other members) and is **membership-gated** (outsiders get nothing).
6. **Given** the household dashboard (Story 13.8), **When** shared goals exist, **Then** the `SharedGoalsCard` seam renders them (this story fills that placeholder).

## Tasks / Subtasks

- [x] Task 1: Migration 027 — shared goals + per-member breakdown RPC (AC: #1, #2, #4, #5)
  - [x] `ALTER TABLE goals ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE SET NULL`; index it.
  - [x] Extend `goals` **SELECT** RLS to dual-path: `auth.uid() = user_id OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))`. **Leave INSERT/UPDATE/DELETE owner-only** — shared writes go through the service-role (matches the established Epic-13 pattern: all household writes service-role, RLS SELECT-only). This avoids the cross-household-injection class (13.5) since no member-writable RLS path is opened.
  - [x] `household_goal_breakdown(p_goal_id UUID)` SECURITY DEFINER, membership-gated on the goal's household (`SELECT household_id FROM goals WHERE id = p_goal_id` → `IF NOT is_household_member(...) THEN RETURN`). Returns per member `{ user_id, email, contributed }` = SUM of that member's `goal_contributions` for the goal (sums only, never rows). LEFT JOIN members so a member with zero shows 0. (Restrict EXECUTE to `authenticated`? It self-gates; keep default like `household_contributions`.)
  - [x] **Savings-link column:** `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS goal_contribution_id UUID REFERENCES goal_contributions(id) ON DELETE SET NULL`; index it. Links a "Savings" expense to the contribution that created it (SET NULL keeps the historical expense if the contribution/goal is later deleted).
  - [x] COMMENTs documenting the model.
- [x] Task 2: Types (AC: #1, #4)
  - [x] `database.types.ts`: add `household_id: string | null` to `goals` Row/Insert/Update; add `household_goal_breakdown` to `Functions`; add domain types `GoalMemberBreakdown { user_id; email; contributed }`, `HouseholdGoal` (= Goal & { household_id }), and `HouseholdGoalWithBreakdown { goal: HouseholdGoal; breakdown: GoalMemberBreakdown[] }`.
- [x] Task 2b: Savings-transaction helper + retrofit personal goals (revised decision)
  - [x] `src/lib/services/savingsTransactionService.ts` → `logSavingsContribution(adminOrAuthedClient, { userId, amount, goalName, goalContributionId, currency })`: resolve the user's `Savings` expense category (find by `user_id` + name `Savings` + type `expense`; create if missing, `is_predefined: false`, a colour); insert a transaction `{ user_id, type:'expense', category_id, amount, date: today, notes: 'Savings: <goal>', currency, household_id: null, goal_contribution_id }`. Best-effort logging must NOT silently corrupt the goal flow — surface errors to the caller, which decides.
  - [x] Retrofit personal contributions: `goalService.addContribution` must return the inserted contribution id and call `logSavingsContribution`. Resolve the user's currency from `user_profiles.preferences.currency_format` (default EUR). (Existing goalService tests will need the new category/transaction mock branches.)
- [x] Task 3: `householdGoalService.ts` (AC: #1, #2, #3, #4, #5)
  - [x] `getHouseholdGoals(userId)` — resolve caller's household (auth-scoped); list `goals WHERE household_id = <hh>` via the **auth-scoped** client (RLS dual-path SELECT returns shared goals to members); for each goal call `household_goal_breakdown` (auth-scoped RPC, membership-gated) and attach. Returns `HouseholdGoalWithBreakdown[]`. No household → `[]`.
  - [x] `createHouseholdGoal(userId, input)` — resolve household (throw `NotHouseholdMemberError` if none); validate name + `target_amount > 0`; **service-role** insert `{ user_id, household_id, name, target_amount, deadline }`.
  - [x] `contributeToHouseholdGoal(userId, goalId, input)` — **service-role**: verify the goal exists, is shared, and the caller is a member of its household (else `NotHouseholdMemberError`/404); validate `amount > 0`; insert `goal_contributions { goal_id, user_id, amount, note }` (select its id); **log a Savings expense** for the contributor via `logSavingsContribution`; **recompute** `current_amount = SUM(goal_contributions WHERE goal_id)` (authoritative — avoids lost updates across concurrent members) and UPDATE the goal. Return the updated goal.
  - [x] (Optional) `deleteHouseholdGoal(userId, goalId)` — creator-only (service-role check `goal.user_id === userId`), else 403.
- [x] Task 4: API (AC: #1, #2, #3, #4)
  - [x] `GET /api/households/goals` → `getHouseholdGoals`; 401; `{ data: HouseholdGoalWithBreakdown[] }`. `export const dynamic = 'force-dynamic'`.
  - [x] `POST /api/households/goals` → zod `{ name, target_amount, deadline? }`; `createHouseholdGoal`; 400 invalid, 403 `NotHouseholdMemberError`, 200 `{ data: goal }`.
  - [x] `POST /api/households/goals/[id]/contribute` → zod `{ amount > 0, note? }`; `contributeToHouseholdGoal`; 400, 403, 404 (goal not found / not shared), 200 `{ data: goal }`.
- [x] Task 5: UI + i18n (AC: #2, #3, #4, #6)
  - [x] `useHouseholdGoals` hook → `GET /api/households/goals`.
  - [x] Replace the `SharedGoalsCard` (13.8 placeholder) body: list shared goals with name, progress bar (current/target via `formatAmount`), deadline, and a per-member breakdown (email/"You" + contributed). A "Contribute" control (amount input → POST contribute → revalidate `/api/households/goals` + `/api/households/category-totals` is unrelated; revalidate goals). A "New shared goal" form (name, target, optional deadline → POST create).
  - [x] Keep it member-gated (the card already only renders inside the household dashboard for members).
  - [x] `messages/en.json` + `bg.json`: `householdGoals` namespace (newGoal, name, target, deadline, create, contribute, contributeAmount, save, cancel, progressOf, breakdown, you, none, created, createFailed, contributed, contributeFailed, invalidAmount, invalidGoal). en/bg parity (translations.test.ts).
- [x] Task 6: RLS integration test `household-goals.rls.test.ts` (AC: #2, #4, #5)
  - [x] `@jest-environment node` first docblock; `rlsDescribe`; Docker-gated.
  - [x] Seed a household (A admin, B member) + a shared goal owned by A with contributions from A and B (insert via service client).
  - [x] Member B can SELECT the shared goal (dual-path SELECT). An outsider cannot.
  - [x] `household_goal_breakdown(goal_id)` returns both members' contributed sums to a member; returns `[]` to an outsider.
  - [x] A personal goal (household_id NULL) of A is NOT visible to B.
- [x] Task 7: Mocked tests (AC: #1, #3, #5)
  - [x] `householdGoalService.test.ts`: create validation (no household → 403; bad target → throws); contribute (non-member/not-shared → throws; recompute SUM updates current_amount; logs a Savings transaction); getHouseholdGoals attaches breakdown.
  - [x] `savingsTransactionService.test.ts`: creates the Savings category when missing then inserts the expense; reuses an existing Savings category.
  - [x] route tests: GET/POST goals + contribute (200/400/401/403/404).
  - [x] Update existing `goalService` / contribute-route tests for the new Savings-logging branch.
- [x] Task 8: Verification
  - [x] `npx tsc --noEmit`, `npx eslint`, full `npx jest` green (RLS suites skip without Docker). Finalize Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Architecture & data-model decisions

- **CONFIRMED PRODUCT DECISION (2026-06-07, revised): contributing to a goal ALSO logs an expense transaction in a "Savings" category** so the money shows as leaving the budget (spending view reflects it). Applies to BOTH personal and shared goal contributions (the budget-reflection rationale is universal). Implementation: a shared `logSavingsContribution` helper resolves/creates the contributor's "Savings" expense category and inserts a personal expense transaction (`household_id NULL`, `goal_contribution_id` link). The transaction is a real historical event → `goal_contribution_id` uses `ON DELETE SET NULL` (deleting the contribution/goal keeps the expense, just unlinks it — no retroactive budget inflation). Currency = the contributor's `currency_format` (default EUR).
- **Reuse the existing goals tables, don't fork them.** `goals` (migration 013) already has `name/target_amount/current_amount/deadline` and `goal_contributions` already records per-user contributions (`user_id`, `amount`, `note`). Shared goals = a `goals` row with `household_id` set — exactly the `household_id` pattern used for categories/transactions (022) and the allowance link. [Source: supabase/migrations/013_goals.sql]
- **The existing `goalService` is owner-scoped and cannot serve shared goals.** Every function filters `.eq('user_id', userId)` — including `addContribution`'s current_amount fetch+update. A non-owner member contributing would be blocked. So **do NOT modify `goalService`** (avoid regressing personal goals); add a separate `householdGoalService` for the shared path. [Source: src/lib/services/goalService.ts:140-195]
- **Service-role writes + SELECT-only RLS** is the established Epic-13 pattern (households, invitations, allowance, contribution presets). Shared-goal create/contribute go through the service-role client with an explicit `is_household_member` check as the authorization; only the `goals` **SELECT** policy is widened to dual-path so members can read shared goals. This sidesteps the cross-household-injection risk that bit Story 13.5 (no member-writable RLS path is opened). [Source: memory — "all household writes service-role; RLS SELECT-only"; supabase/migrations/022_shared_categories.sql for the WITH CHECK lesson]
- **`current_amount` is recomputed as SUM for shared goals**, not incremented. Multiple members can contribute concurrently; the existing increment (read current → add → write) can lose updates. `SUM(goal_contributions)` is authoritative and idempotent. [Source: src/lib/services/goalService.ts:179-194 — documents the single-user increment limitation]
- **Per-member breakdown via a membership-gated SECURITY DEFINER aggregate** (`household_goal_breakdown`) — mirrors `household_contributions` (13.7) and `household_category_totals` (13.4): returns sums + email, never individual rows (AC#5). `goal_contributions` SELECT RLS stays **owner-only** — the breakdown doesn't need it, and the service recompute uses service-role. [Source: supabase/migrations/025_contribution_splits.sql]
- **Fills the 13.8 seam.** Story 13.8 shipped `SharedGoalsCard` as an empty-state placeholder with a documented `// Story 13.9` seam; this story replaces its body. [Source: src/components/household/SharedGoalsCard.tsx]

### Files to touch

- NEW `supabase/migrations/027_shared_goals.sql`
- UPDATE `src/types/database.types.ts` (goals.household_id, transactions.goal_contribution_id, RPC + domain types)
- NEW `src/lib/services/savingsTransactionService.ts` (+ test)
- UPDATE `src/lib/services/goalService.ts` (addContribution logs a Savings expense)
- NEW `src/lib/services/householdGoalService.ts`
- NEW `src/app/api/households/goals/route.ts` (GET, POST)
- NEW `src/app/api/households/goals/[id]/contribute/route.ts` (POST)
- NEW `src/lib/hooks/useHouseholdGoals.ts`
- UPDATE `src/components/household/SharedGoalsCard.tsx` (fill the seam: list + breakdown + contribute + create)
- UPDATE `messages/en.json`, `messages/bg.json`
- NEW `src/lib/test-utils/__tests__/household-goals.rls.test.ts`
- NEW `src/lib/services/__tests__/householdGoalService.test.ts`
- NEW `src/app/api/households/goals/__tests__/route.test.ts` (+ contribute route test)

### Project Structure Notes

- Migration numbering continues at **027**. Apply 020→027 in order to the live DB (Vercel doesn't run migrations). [Source: memory ops note]
- RLS tests: `@jest-environment node` in the **first** docblock; `rlsDescribe`; Docker-gated; `npm run test:rls` positional pattern.
- Currency: `formatAmount(amount, currency)` with the user's `currency_format`; never hard-code symbols/ISO (ESLint `no-restricted-syntax`).
- Reuse `NotHouseholdMemberError` (householdService) → 403, consistent with preset/contribution/allowance routes.

### Testing standards summary

- Mocked service/route tests: chainable Supabase mock; `@jest-environment node`, mock `next/server` + `@/lib/supabase/server` before imports.
- Component test optional (SharedGoalsCard) — mock `useHouseholdGoals`; the household dashboard page test (13.8) already covers the card's presence via its empty state, so update expectations only if needed.
- en/bg parity enforced by `translations.test.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.9 (lines 622-634)]
- [Source: supabase/migrations/013_goals.sql] — goals + goal_contributions schema
- [Source: src/lib/services/goalService.ts] — owner-scoped pattern (why a separate service is needed)
- [Source: supabase/migrations/025_contribution_splits.sql] — SECURITY DEFINER aggregate pattern to mirror
- [Source: src/components/household/SharedGoalsCard.tsx] — the 13.8 seam to fill
- [Source: src/lib/hooks/useContributions.ts] — hook shape to mirror

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `goals`/`goal_contributions` are NOT in the typed `Database` schema (the existing `goalService` takes a generic `SupabaseClient` param to sidestep this). `householdGoalService` casts the clients to the generic `SupabaseClient` so `.from('goals')` type-checks.
- Making `transactions.goal_contribution_id` required on the Row type broke the 6 AI transaction fixtures again → added `goal_contribution_id: null`.
- The 13.8 dashboard page test now mocks `useHouseholdGoals` (the card fetches its own data).

### Completion Notes List

- All tasks implemented. **tsc 0, ESLint 0, full suite green: 1489 passed / 43 skipped** (8 env-gated RLS suites incl. the new household-goals one). No regressions.
- **REVISED DECISION honored:** contributing to a goal (personal OR shared) now also logs a "Savings" expense (`savingsTransactionService.logSavingsContribution`) so the spend reflects in the budget. Best-effort — a logging hiccup never loses the contribution. `transactions.goal_contribution_id` links them (`ON DELETE SET NULL` keeps the historical expense).
- **Shared goals:** migration 027 adds `goals.household_id` + **dual-path SELECT** RLS (members read shared goals); create/contribute go through the **service role** with explicit `is_household_member` checks (Epic-13 pattern — no member-writable RLS path opened). `current_amount` is recomputed as `SUM(goal_contributions)` (concurrency-safe across members).
- **Per-member breakdown** via membership-gated SECURITY DEFINER `household_goal_breakdown` (sums + email, never rows). RLS test proves members see shared goals + breakdown, outsiders get nothing, personal goals stay private.
- **Fills the 13.8 seam:** `SharedGoalsCard` now lists shared goals (progress + per-member breakdown), with create + contribute controls. en/bg i18n.
- **Deploy:** migration 027 must be applied with 020–026.

### File List

- supabase/migrations/027_shared_goals.sql — CREATED
- src/types/database.types.ts — MODIFIED (goals.household_id; transactions.goal_contribution_id; household_goal_breakdown fn; HouseholdGoal/GoalMemberBreakdown/HouseholdGoalWithBreakdown/CreateHouseholdGoalInput)
- src/lib/services/savingsTransactionService.ts — CREATED
- src/lib/services/goalService.ts — MODIFIED (addContribution logs a Savings expense, best-effort)
- src/lib/services/householdGoalService.ts — CREATED
- src/app/api/households/goals/route.ts — CREATED (GET, POST)
- src/app/api/households/goals/[id]/contribute/route.ts — CREATED (POST)
- src/lib/hooks/useHouseholdGoals.ts — CREATED
- src/components/household/SharedGoalsCard.tsx — MODIFIED (filled the 13.8 seam)
- messages/en.json, messages/bg.json — MODIFIED (householdGoals namespace)
- src/lib/test-utils/__tests__/household-goals.rls.test.ts — CREATED (real-DB, node env, gated)
- src/lib/services/__tests__/savingsTransactionService.test.ts — CREATED
- src/lib/services/__tests__/householdGoalService.test.ts — CREATED
- src/app/api/households/goals/__tests__/route.test.ts — CREATED
- src/lib/services/__tests__/goalService.test.ts — MODIFIED (addContribution mock for the new select + Savings branch)
- src/app/household/__tests__/page.test.tsx — MODIFIED (mock useHouseholdGoals)
- src/lib/ai/__tests__/{forecastEngine,patternDetection,recoveryPlanner,reengagementAnalysis,seasonalAnalysis}.test.ts, __tests__/lib/ai/insightRules.test.ts — MODIFIED (fixture goal_contribution_id: null)

## Change Log

- 2026-06-07: Implemented Story 13.9 — shared household savings goals (migration 027: goals.household_id dual-path SELECT + household_goal_breakdown RPC + transactions.goal_contribution_id; householdGoalService service-role create/contribute w/ SUM recompute; savings-expense logging for personal+shared contributions per revised decision; SharedGoalsCard fills the 13.8 seam; RLS + mocked tests). Status → review.
- 2026-06-07: Code review (three-lens) — Approve. One LOW applied (B3: the household dashboard realtime handler now also revalidates /api/households/goals so a co-member's contribution refreshes the goals card). Verified service-role-write + dual-path-SELECT pattern (no injection), savings expense is the contributor's personal expense (no double-count in household totals), concurrency-safe SUM recompute. Status → done.

## Senior Developer Review (AI)

Reviewer: claude-opus-4-8 · 2026-06-07 · Outcome: **Approve (1 LOW fixed)**

- AC1–AC6 all met (create, member-visible via dual-path SELECT, per-member tracked, total+breakdown, aggregate-only membership-gated RPC, 13.8 seam filled).
- Security: shared writes go through service-role with explicit `is_household_member` checks; only `goals` SELECT is dual-path → no member-writable RLS path (avoids the 13.5 injection class). Breakdown RPC is membership-gated, sums only. RLS test proves members read shared goals + breakdown, outsiders get nothing, personal goals stay private.
- Savings link (revised decision): contributing logs the contributor's **personal** Savings expense (`household_id NULL`) → reflects in their budget, never double-counted in household totals; `goal_contribution_id` ON DELETE SET NULL keeps the historical expense. Best-effort so it never loses a contribution.
- B3 (LOW, FIXED): dashboard realtime now revalidates the goals endpoint too.
- E4/N+1 (LOW, accept): best-effort savings logging; `getHouseholdGoals` does one breakdown RPC per goal (fine for few goals).

**Verification:** tsc 0, ESLint 0, full suite green (1489 pass / 43 skipped). Migration 027 must be applied with 020–026.
