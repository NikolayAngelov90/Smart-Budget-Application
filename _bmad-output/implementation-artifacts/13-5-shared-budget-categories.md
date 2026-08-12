---
baseline_commit: 10901b7aae1e2421628f44fb723295e1c079706a
---

# Story 13.5: Shared Budget Categories

Status: done

> **Sequencing note:** pulled ahead of 13-4 (the user approved a dependency reorder).
> 13-4 (Transparency Presets & Per-Category Controls) needs shared categories to exist
> and to refine their RLS, so 13-5 lands first. This story establishes the **"fully
> shared" baseline**; 13-4 will layer `visibility_level` (shared / category_only /
> private) + the category-totals-only behavior on top. Leave a clear seam for it.

## Story

As a household member,
I want to create shared budget categories that everyone in the household can see and use,
So that household expenses are tracked collectively — while my personal categories and transactions stay private to me.

## Acceptance Criteria

1. **Given** the migration runs, **When** applied, **Then** `categories` and `transactions` each gain a nullable `household_id UUID REFERENCES households(id) ON DELETE SET NULL` (ADR-010: shared items carry both `user_id` = creator and `household_id`; personal items keep `household_id = NULL`). Indexes: `idx_categories_household (household_id)`, `idx_transactions_household (household_id)`.

2. **Given** a member of a household, **When** they create a category marked shared, **Then** it is persisted with `household_id` = their household and `user_id` = creator; **When** a member creates a personal category, **Then** `household_id` stays NULL (unchanged behavior).

3. **Given** a shared category, **When** any member of that household lists categories, **Then** they see it (personal categories + their household's shared categories); **When** a non-member / other household lists, **Then** they do **not** see it. Personal categories remain visible only to their owner.

4. **Given** RLS (dual-path, ADR-015), **When** evaluated, **Then**:
   - `categories` SELECT: `auth.uid() = user_id OR (household_id IS NOT NULL AND is_household_member(household_id, auth.uid()))`.
   - `categories` INSERT: `WITH CHECK (user_id = auth.uid() AND (household_id IS NULL OR is_household_member(household_id, auth.uid())))` — you can only create a shared category in a household you belong to.
   - `categories` UPDATE/DELETE: owner OR a member of the category's household may manage shared categories; **preserve** the existing `is_predefined = false` guard for personal categories.
   - `transactions` SELECT gains the same dual-path so members see shared-category transactions; `transactions` INSERT/UPDATE/DELETE stay **owner-only** (`user_id = auth.uid()`) — members see but do not edit each other's transactions in this story.
   All verified by a real-DB RLS test (NFR10/NFR11). Personal-only behavior must be byte-for-byte preserved (the new OR-clause is false when `household_id IS NULL`).

5. **Given** a member records a transaction against a **shared** category, **When** it is saved, **Then** the server sets the transaction's `household_id` to the category's `household_id` (derived server-side from the category — never trusted from the client), so the transaction is visible to household members; transactions in personal categories keep `household_id = NULL`.

6. **Given** the categories list endpoint, **When** a member fetches, **Then** it returns personal **and** household-shared categories (the current `.eq('user_id', …)` filter must be widened to personal + shared, e.g. `.or(user_id.eq.<uid>,household_id.eq.<hid>)`, or rely on RLS without the `user_id` filter). Existing solo users (no household) see exactly what they see today.

7. **Given** the category UI, **When** a household member creates/edits a category, **Then** they can mark it **Shared with household** (only shown when the user has a household); shared categories are visually indicated (badge). Non-household users see no sharing controls. en/bg i18n.

8. **No regression.** Solo users and all existing category/transaction tests behave identically (personal rows have `household_id = NULL`; the dual-path OR-clauses are inert for them). No change to `households`/`household_members`/`household_invitations`.

## Tasks / Subtasks

- [x] **Task 1 — Migration `022_shared_categories.sql`** (AC: #1, #4)
  - [x] `ALTER TABLE categories ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE SET NULL;` same for `transactions`. Indexes `idx_categories_household`, `idx_transactions_household`.
  - [x] **Rewrite the categories RLS** (DROP + recreate, `DROP POLICY IF EXISTS` guarded): SELECT/INSERT/UPDATE/DELETE per AC#4. Reuse `public.is_household_member` (migration 020). Keep the `is_predefined = false` constraint on personal UPDATE/DELETE. (See `001_initial_schema.sql` for the exact current policy text to extend.)
  - [x] **Extend the transactions SELECT policy** to the dual-path; leave INSERT/UPDATE/DELETE owner-only. DROP+recreate the SELECT policy only.
  - [x] Header comment matching project style (`-- Migration 022: Shared budget categories (Story 13.5) -- Date: {date}`).

- [x] **Task 2 — Types** (AC: #1, #2) — add `household_id: string | null` to `categories` and `transactions` Row/Insert/Update in `src/types/database.types.ts` (Insert optional/nullable). Update any `Category`/`Transaction` domain consumers if they construct full objects.

- [x] **Task 3 — Categories API** (AC: #2, #6) — `src/app/api/categories/route.ts`:
  - [x] POST: accept an optional `shared` boolean (or `household_id`); when `shared` and the caller has a household, set `household_id` (resolve the caller's household server-side; reuse `getCurrentHousehold`/a `household_members` lookup). Validate the user belongs to the household. Personal create unchanged.
  - [x] GET: return personal + shared (widen the `user_id` filter as in AC#6). Resolve the caller's `household_id` once; include shared rows. Solo users (no household) unaffected.
  - [x] Also update `src/app/api/categories/[id]/route.ts` (PUT/DELETE) so members can manage shared categories (RLS already allows it; ensure the route's own `.eq('user_id', …)` guard doesn't block shared-category edits by other members — widen or drop it, relying on RLS).

- [x] **Task 4 — Transactions API** (AC: #5) — `src/app/api/transactions/route.ts` POST: after resolving/validating the category, if the category has a `household_id`, set the new transaction's `household_id` to it (server-derived). Personal-category transactions keep NULL. Don't trust a client `household_id`. (Be careful around the existing nudge logic — additive only.)

- [x] **Task 5 — UI** (AC: #7) — `src/components/categories/CategoryModal.tsx`: add a "Shared with household" toggle, shown only when the user has a household (use `useHousehold`); pass `shared` to the API. `CategoryBadge`/list: show a shared indicator for `household_id != null`. i18n keys (en/bg). Keep the existing personal flow intact.

- [x] **Task 6 — RLS test `shared-categories.rls.test.ts`** (AC: #3, #4) — `@jest-environment node` (FIRST docblock), gated. Seed household A (a1 admin, a2 member), household B (b1), a shared category in A (service-role), a personal category for a1, and a transaction by a1 in the shared category. Assert: a2 sees A's shared category + a1's shared-category transaction; a2 does NOT see a1's personal category; b1 (outsider) sees neither; a2 can update the shared category but cannot update a1's personal one; a member cannot UPDATE a1's transaction (owner-only).

- [x] **Task 7 — Mocked tests** (AC: #2, #5, #6) — categories route (shared create sets household_id; GET returns personal+shared; personal create unchanged) + transactions route (transaction in a shared category gets household_id; personal stays NULL). Reuse the chainable-mock pattern; route tests `@jest-environment node` first docblock.

- [x] **Task 8 — Verify** — `tsc --noEmit`, `npm run lint` (0 warnings), `npm test` green (RLS gated/skipped), en/bg parity passes (allowlist any language-agnostic keys).

## Dev Notes

### 🚨 This story rewrites core RLS on `categories` and `transactions` — preserve personal behavior exactly
- The **only** correct change is to ADD the household OR-path; the personal predicate (`auth.uid() = user_id`, and `is_predefined = false` on personal mutate) must remain. For personal rows `household_id IS NULL`, so `(household_id IS NOT NULL AND …)` is always false → personal behavior is unchanged. Read the current policies in `001_initial_schema.sql` and extend them verbatim.
- **Read-back-after-insert:** creating a shared category via the user's client should be fine (the creator is `user_id` → SELECT passes via the owner path). No service-role needed for category create (unlike household create). Transactions likewise (owner path). Keep using the normal `createClient()` route flow.

### The 13-4 seam (don't build it, but don't block it)
- 13-4 adds `visibility_level` (enum: shared / category_only / private) to shared categories + `household_members.preset`, and refines the SELECT RLS so `category_only` returns aggregates but not rows, `private` hides entirely. Design 13-5's SELECT policy so 13-4 can wrap/replace it cleanly (a single dual-path SELECT policy is easiest to refine). Do NOT add `visibility_level` here.

### What already exists — reuse, don't reinvent
- **No category service** — categories are handled directly in `src/app/api/categories/route.ts` (+ `[id]/route.ts`). Extend those; don't introduce a service unless it clarifies (optional small helper to resolve the caller's household_id, or reuse `householdService.getCurrentHousehold`).
- **`is_household_member`** SECURITY DEFINER helper (migration 020) — use in the new policies.
- **`useHousehold`** hook (13-1) — gate the "Shared" toggle on `household != null`.
- **RLS test harness** (`rlsClient.ts`) + node-env-first-docblock rule + Docker-gated `test:rls`.
- **Chainable Supabase mock** for route tests (`docs/testing/integration-test-guide.md`); transactions route tests already exist — extend, don't break.
- **Transactions POST** already has nudge + push logic — your `household_id` derivation is additive; don't disturb the nudge path.

### Project Structure Notes
```
supabase/migrations/022_shared_categories.sql          ← CREATE
src/types/database.types.ts                            ← MODIFY (household_id on categories + transactions)
src/app/api/categories/route.ts                        ← MODIFY (POST shared; GET personal+shared)
src/app/api/categories/[id]/route.ts                   ← MODIFY (members manage shared categories)
src/app/api/transactions/route.ts                      ← MODIFY (derive household_id from shared category)
src/components/categories/CategoryModal.tsx            ← MODIFY (Shared toggle)
src/components/categories/CategoryBadge.tsx (or list)  ← MODIFY (shared indicator) [if trivial]
src/lib/test-utils/__tests__/shared-categories.rls.test.ts ← CREATE (real-DB, node env, gated)
src/app/api/categories/__tests__/*, transactions/__tests__/* ← MODIFY/CREATE (mocked)
messages/en.json, messages/bg.json                     ← MODIFY (shared-category keys)
```
No changes to household tables. `visibility_level` and the shared dashboard are out of scope.

### Testing Requirements
- **RLS (gated, node env):** the security core — members see shared, outsiders don't, personal stays private, transactions in shared categories are visible to members but only editable by their owner. Reuse 13-1/13-2 seeding (service-role seeds; delete test users to cascade-clean).
- **Mocked:** category POST/GET (shared vs personal) and transaction POST (household_id derivation). Preserve existing category/transaction route tests.
- **Regression:** full `npm test` green with RLS skipped; en/bg parity passes; existing solo behavior unchanged.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.5] — shared categories visible/manageable by members; transactions in shared categories in the shared view; personal stays private
- [Source: _bmad-output/planning-artifacts/prd.md#FR20] — shared budget categories
- [Source: _bmad-output/planning-artifacts/architecture.md ADR-010] — household_id FK on categories + transactions; shared = user_id + household_id
- [Source: _bmad-output/planning-artifacts/architecture.md ADR-015] — dual-path RLS
- [Source: supabase/migrations/001_initial_schema.sql] — current categories + transactions RLS to extend (verbatim) + index conventions
- [Source: supabase/migrations/020_households.sql] — is_household_member SECURITY DEFINER helper
- [Source: src/app/api/categories/route.ts + [id]/route.ts] — category endpoints to extend (direct queries, no service)
- [Source: src/app/api/transactions/route.ts] — transaction POST (derive household_id; don't disturb nudge logic)
- [Source: src/components/categories/CategoryModal.tsx] — category create/edit UI for the Shared toggle
- [Source: src/lib/hooks/useHousehold.ts] — gate sharing UI on membership
- [Source: src/lib/test-utils/__tests__/households.rls.test.ts] — RLS test shape (node env, seeding, isolation)
- [Source: docs/testing/rls-integration-test-strategy.md] — node-env requirement + Docker-gated run

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 8 tasks implemented. `tsc` clean, ESLint clean, **1413 tests pass + 22 skipped** (4 env-gated RLS suites). No regressions.
- **Migration 022**: added nullable `household_id` (FK → households, ON DELETE SET NULL) to `categories` + `transactions`; indexes. **Extended the existing 001 RLS** to a dual-path (owner OR household member via `is_household_member`): categories SELECT/INSERT/UPDATE/DELETE (preserving the `is_predefined = false` guard); transactions **SELECT only** (writes stay owner-only — members see but can't edit each other's transactions). Personal behavior preserved (OR-path inert when `household_id IS NULL`).
- **Categories API**: POST accepts `shared` (resolves+verifies the caller's household → 403 if none; sets `household_id`); GET returns personal + shared (widened the `user_id` filter to `.or(user_id, household_id)`); `[id]` PUT/DELETE dropped explicit `user_id` filters so members can manage shared categories (RLS authorizes; personal stays owner-only).
- **Transactions API**: POST verifies the category via RLS (no `user_id` filter, so shared categories created by others are usable) and **derives `household_id` from the category server-side** (never from the client) so shared-category transactions are visible to members. Nudge logic untouched.
- **UI**: CategoryModal "Shared with household" toggle (create-mode, members only via `useHousehold`); en/bg i18n (`categories.sharedWithHousehold/sharedHint/sharedBadge`).
- **RLS test** `shared-categories.rls.test.ts` (node env, gated): members see+manage shared categories, see shared transactions but can't edit them; personal data stays private; outsiders see nothing.
- **Fixture fix:** the new required `household_id` on the Category/Transaction Row types required adding `household_id: null` to the AI-engine test fixtures (forecast/pattern/recovery/reengagement/seasonal/insightRules).
- **Env note:** RLS suites need Docker → skip locally, run in the `rls` CI job.
- **Seam for 13-4:** the dual-path SELECT policies are the "fully shared" baseline; 13-4 will refine them with `visibility_level` (shared/category_only/private). **Deferred:** transaction edit (PUT) household_id re-derivation (owner-only edits; minor); combined shared dashboard (13-8).

### File List

- supabase/migrations/022_shared_categories.sql — CREATED
- src/types/database.types.ts — MODIFIED (household_id on categories + transactions)
- src/app/api/categories/route.ts — MODIFIED (POST shared, GET personal+shared)
- src/app/api/categories/[id]/route.ts — MODIFIED (members manage shared; RLS-gated)
- src/app/api/transactions/route.ts — MODIFIED (RLS-gated category check + derive household_id)
- src/components/categories/CategoryModal.tsx — MODIFIED (Shared toggle)
- src/app/api/categories/__tests__/shared-categories.route.test.ts — CREATED (3 mocked)
- src/lib/test-utils/__tests__/shared-categories.rls.test.ts — CREATED (7 real-DB, gated)
- src/lib/ai/__tests__/{forecastEngine,patternDetection,recoveryPlanner,reengagementAnalysis,seasonalAnalysis}.test.ts, __tests__/lib/ai/insightRules.test.ts — MODIFIED (fixture household_id: null)
- messages/en.json, messages/bg.json — MODIFIED (shared-category keys)

## Change Log

- 2026-06-04: Implemented Story 13.5 — shared budget categories (household_id + dual-path RLS on categories/transactions, API, UI, RLS tests). Reordered ahead of 13.4. Status → review.
- 2026-06-04: Code review — 1 HIGH fixed (cross-household write-injection), 2 deferred, 1 dismissed. Status → done.

## Senior Developer Review (AI)

**Date:** 2026-06-04 · **Reviewer:** bmad-code-review (three-lens) on the uncommitted working tree vs baseline `10901b7` · **Outcome:** Approved after fix

### Action Items

- [x] **[HIGH] Cross-household write-injection via INSERT/UPDATE** (`022_shared_categories.sql`). The migration extended SELECT to the dual-path but left transactions INSERT/UPDATE (and categories UPDATE) without a `household_id` membership check. An authenticated user could (via the anon REST client) insert/move a row with `household_id = <victim household>` — `WITH CHECK (auth.uid() = user_id)` passed — polluting another household's shared view (isolation breach, NFR11/FR23). **Fixed:** added `WITH CHECK (household_id IS NULL OR is_household_member(household_id, auth.uid()))` to transactions INSERT + UPDATE and categories UPDATE. Added a regression RLS test (outsider cannot inject into household A). categories INSERT already had the guard.
- [ ] **[LOW][Defer] Deleting a shared category with other members' transactions** — the route's orphan step is owner-only (RLS), so the delete may fail (FK) or partially orphan. Shared-category lifecycle overlaps Story 13-11 / 13-4; consider admin-only deletion or service-role orphaning.
- [ ] **[LOW][Defer] Any member can rename/delete shared categories** (per the "manageable by all members" AC). Confirm product intent; 13-4 transparency / admin roles may refine.
- [x] **[Dismissed] GET usage-stats count only personal transactions** — category recency is intentionally personal.

Post-fix: SQL + gated-test change; tsc + ESLint clean; 1413 tests pass, 22 skipped (RLS).
