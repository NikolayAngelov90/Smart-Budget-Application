---
baseline_commit: 53409c94ac649daaa92048533e88e82e653e9f4a
---

# Story 13.1: Household Creation & Database Foundation

Status: done

> First story of Epic 13 (Household Collaboration) — the **security-first foundation**.
> Establishes the `households` + `household_members` tables and dual-path RLS (ADR-015),
> the household service + API, a minimal create-household UI, and **wires up the RLS
> integration-test harness** (Epic 12 retro PREP-1) so every later Epic 13 isolation AC
> can be proven against a real database. ADR-025 (optional `category_budgets`) is forward
> context only — **do not** build budgets here.

## Story

As a user who shares finances with others,
I want to create a household and become its admin,
So that I can start managing shared budgets with my partner or roommates — with my data isolated from every other household at the database layer.

## Acceptance Criteria

1. **Given** the migration runs, **When** the schema is applied, **Then** two tables exist: `households` (`id`, `name`, `created_by` → auth.users, `created_at`, `updated_at`) and `household_members` (`id`, `household_id` → households ON DELETE CASCADE, `user_id` → auth.users ON DELETE CASCADE, `role` ∈ {admin, member}, `joined_at`), with a `UNIQUE(household_id, user_id)` constraint and the indexes from ADR-024 (`idx_household_members_lookup` on `(household_id, user_id)`, plus `(user_id)`).

2. **Given** a logged-in user with no existing household, **When** they `POST /api/households` with a non-empty `name`, **Then** a household is created, the caller is inserted into `household_members` as `role = 'admin'`, and the new household (with the caller's role) is returned. Name is validated (1–100 chars, trimmed); invalid → 400; unauthenticated → 401.

3. **Given** a user who is already a member of a household, **When** they attempt to create another, **Then** the request is rejected (409) — MVP is one household per user. (Enforced in the service, not only the UI.)

4. **Given** RLS is enabled on both tables, **When** any authenticated user queries via their own client (anon key + JWT), **Then** they can read **only** households they belong to and **only** `household_members` rows of households they belong to; rows of other households return `[]` — verified by a real-database RLS integration test (NFR10/NFR11).

5. **Given** the `household_members` RLS policy, **When** it is defined, **Then** it is **recursion-safe** — membership lookups used inside policies go through a `SECURITY DEFINER` helper function (e.g. `public.is_household_member(uuid, uuid)`), never a self-referential subquery on `household_members` (which Postgres rejects with infinite-recursion / 42P17).

6. **Given** the admin role, **When** a non-admin member attempts to `UPDATE`/`DELETE` the household row, **Then** RLS blocks it (only `created_by`/admins may rename or delete); all members may `SELECT`. Verified by RLS test.

7. **Given** the RLS test harness, **When** `npm i -D supabase && npx supabase init` is done and the `RLS_TEST_*` env vars are set, **Then** `npm run test:rls` boots against the local stack and runs `households.rls.test.ts` (built on `src/lib/test-utils/rlsClient.ts`); without the env vars the suite skips so `npm test` stays green. A CI job that runs `supabase start` before `test:rls` is added.

8. **Given** a user with no household, **When** they open Settings, **Then** a "Household" section invites them to create one (name input → POST); after creation it shows the household name and their role. Members with a household see its name. i18n in en + bg. No regression to existing solo features (no `household_id` is added to `categories`/`transactions` in this story — that is Story 13.5).

## Tasks / Subtasks

- [x] **Task 1 — Migration `020_households.sql`** (AC: #1, #4, #5, #6)
  - [x] `CREATE TABLE households` and `household_members` per AC#1 (UUIDs via `uuid_generate_v4()`, `DECIMAL`/`TIMESTAMP WITH TIME ZONE` conventions from `001_initial_schema.sql`). `role` as a new enum `household_role AS ENUM ('admin','member')` OR a `TEXT CHECK (role IN ('admin','member'))` (prefer enum for parity with `transaction_type`).
  - [x] Indexes: `idx_household_members_lookup` on `(household_id, user_id)`, `idx_household_members_user` on `(user_id)`, `idx_households_created_by` on `(created_by)`.
  - [x] `SECURITY DEFINER` helper: `CREATE FUNCTION public.is_household_member(p_household_id uuid, p_user_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM household_members WHERE household_id = p_household_id AND user_id = p_user_id) $$;` (and an `is_household_admin` variant). **This breaks the RLS recursion** — see Dev Notes.
  - [x] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on both tables, then dual-path policies (ADR-015): SELECT via `is_household_member(...)`; households UPDATE/DELETE via `is_household_admin(...)` or `created_by = auth.uid()`; `household_members` INSERT for self-join handled carefully (creator inserts own admin row — allow `user_id = auth.uid()` WITH CHECK, plus admin-adds-members in 13-2/13-3).
  - [x] Header comment matching project style (`-- Migration 020: Households & membership (Story 13.1) -- Date: {date}`).

- [x] **Task 2 — TypeScript types** (AC: #2, #8) — extend `src/types/database.types.ts`: add `HouseholdRole` union; `households` and `household_members` table `Row`/`Insert`/`Update`/`Relationships` blocks (mirror existing table blocks). Add any domain types (`Household`, `HouseholdMember`, `HouseholdWithRole`).

- [x] **Task 3 — `src/lib/services/householdService.ts`** (AC: #2, #3) — pure service-layer (accepts/creates the Supabase server client, like `insightService`/`settingsService`):
  - [x] `createHousehold(userId, name)` → validates uniqueness (reject if user already a member → throw typed error the route maps to 409), inserts household + admin membership (atomic: use a single RPC or sequential insert with rollback-on-failure; service-role client for the writes, mirroring `insightService` write path), returns `HouseholdWithRole`.
  - [x] `getCurrentHousehold(userId)` → returns the user's household + role, or `null`.
  - [x] No hardcoded currency/strings flagged by the ESLint rule (this path is `src/lib/services/**` — covered).

- [x] **Task 4 — API routes** (AC: #2, #3, #8) — `src/app/api/households/route.ts`: `POST` (auth → validate name with Zod → `createHousehold` → 201 | 400 | 401 | 409) and `GET` (auth → `getCurrentHousehold` → `{ data: household | null }`). Follow the auth + error-shape pattern of existing routes (`@/lib/supabase/server`, `logger.error`, `NextResponse.json`).

- [x] **Task 5 — RLS harness wiring + household RLS tests** (AC: #4, #5, #6, #7) — PREP-1 follow-through:
  - [x] `npm i -D supabase`; `npx supabase init` (keep existing `supabase/migrations/` + `seed.sql`); document local run in `docs/testing/rls-integration-test-strategy.md` if anything differs.
  - [x] `src/lib/test-utils/__tests__/households.rls.test.ts` using `rlsDescribe`/`createServiceClient`/`createTestUser`/`signInAsTestUser`: seed userA1+userA2 in household A and userB1 in household B; assert (a) userB1 cannot read household A or its members, (b) userA2 can read household A + its members, (c) non-admin userA2 cannot UPDATE/DELETE household A, (d) creator is `admin`.
  - [x] Add a CI job (`.github/workflows/`) that runs `supabase start` then `npm run test:rls` (gated; does not block the main test job).

- [x] **Task 6 — Mocked unit/integration tests** (AC: #2, #3) — `householdService` (chainable Supabase mock per `docs/testing/integration-test-guide.md`) + `api/households/route` (already-mocked `@/lib/supabase/server`): cover create success, 409 when already a member, 400 invalid name, 401 unauth, GET returns household/null.

- [x] **Task 7 — Minimal create-household UI** (AC: #8) — surface in Settings (reuse the existing "Manage" card pattern in `src/app/(dashboard)/settings/page.tsx`): a "Household" section that, when `getCurrentHousehold` is null, shows a name `Input` + "Create household" button (POST, optimistic refresh via SWR), else shows the household name + role. New SWR hook `useHousehold`. i18n keys in `messages/en.json` + `messages/bg.json` under a `household` namespace.

- [x] **Task 8 — Verify** — `npx tsc --noEmit`, `npm run lint` (0 warnings), `npm test` green (RLS suite skipped without env), update the en/bg key-parity test passes.

## Dev Notes

### 🚨 RLS infinite-recursion trap (the #1 disaster to avoid)
A naive `household_members` SELECT policy like
`USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()))`
**self-references the same table inside its own policy → Postgres error 42P17 (infinite recursion).** This is the most common Supabase multi-tenant mistake. **Fix:** put the membership lookup in a `SECURITY DEFINER` function (`is_household_member`) which runs with the function owner's rights and **bypasses RLS** for that lookup, then call it from the policy. Same for admin checks (`is_household_admin`). Keep `SET search_path = public` on the function (security hardening). [Source: ADR-015; Supabase RLS best practices]

### Schema & RLS conventions (follow existing migrations exactly)
- UUID PK `DEFAULT uuid_generate_v4()`; FKs to `auth.users(id) ON DELETE CASCADE`; `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`. [Source: supabase/migrations/001_initial_schema.sql]
- Enable RLS per table, then `CREATE POLICY "..." ON <t> FOR <op> USING/WITH CHECK (...)`. Service-role writes bypass RLS (server uses `createServiceRoleClient()` — see `insightService.ts`). The `auth.uid() IS NULL` service-role allowance pattern is used in `002_insights_rls_policies.sql`; prefer explicit policies + service-role client over broad `IS NULL` where possible. [Source: 001, 002 migrations]
- Next migration number is **020** (latest is `019_analytics_viewer_role.sql`). [Source: supabase/migrations/]
- ADR-024 indexes: `idx_household_members_lookup (household_id, user_id)`. [Source: architecture.md ADR-024]

### Dual-path RLS (ADR-015) — scope for THIS story
- households: `SELECT` if `is_household_member(id, auth.uid())`; `UPDATE`/`DELETE` if `is_household_admin(id, auth.uid())` (or `created_by = auth.uid()` for the single-admin MVP); `INSERT` `WITH CHECK (created_by = auth.uid())`.
- household_members: `SELECT` if `is_household_member(household_id, auth.uid())`; `INSERT` `WITH CHECK (user_id = auth.uid())` for the creator's own admin row (admin-invites-others is Stories 13.2/13.3 — do not build here); `DELETE` (member removal) is Story 13.11 — do not build here.
- The **transparency filter** in ADR-015 (`category_only`/`private`) is **Story 13.4**, not here. Do not add `visibility_level` in this story.

### What already exists — reuse, don't reinvent
- **RLS test harness**: `src/lib/test-utils/rlsClient.ts` (`rlsDescribe`, `createServiceClient`, `signInAsTestUser`, `createTestUser`, `deleteTestUser`) + reference `referenceIsolation.rls.test.ts`. Copy that test's shape. [Source: docs/testing/rls-integration-test-strategy.md]
- **Service pattern**: `src/lib/services/insightService.ts` (server client, service-role for writes), `settingsService.ts` (profile create-if-missing). [Source: those files]
- **API pattern**: auth via `createClient()` → 401; Zod validation; `logger.error`; `NextResponse.json({ data }/{ error })`. [Source: `src/app/api/**/route.ts`]
- **Mocked-test pattern**: chainable Supabase mock keyed by terminal method. [Source: docs/testing/integration-test-guide.md]
- **Settings UI pattern**: the "Manage" card with NextLink rows added in Story UX-1. [Source: src/app/(dashboard)/settings/page.tsx]
- **DO NOT** hardcode currency symbols/codes in `src/lib/services/**` or `src/app/api/cron/**` — ESLint `no-restricted-syntax` will fail the build (use `formatAmount`/`DEFAULT_CURRENCY`). N/A to this story's content but keep in mind.

### Atomicity of create
Creating a household + the admin membership row must not half-fail (orphan household with no admin). Prefer a single Postgres function `create_household(p_name text)` (SECURITY DEFINER, inserts both, returns the row) called via `.rpc()`, OR do both inserts with the service-role client and delete the household if the membership insert fails. Document the choice in Completion Notes.

### Forward context (do NOT implement now)
- ADR-025 (`category_budgets`, optional, proxy fallback) — relevant later for shared budgets (13.5/13.7), not here.
- Realtime (ADR-017), invitations (ADR-016, Story 13.2), transparency (ADR-011, Story 13.4), shared categories (13.5) — all later.

### Project Structure Notes
```
supabase/migrations/020_households.sql            ← CREATE
supabase/config.toml                              ← CREATE (npx supabase init)
src/types/database.types.ts                       ← MODIFY (households, household_members, HouseholdRole)
src/lib/services/householdService.ts              ← CREATE
src/lib/services/__tests__/householdService.test.ts ← CREATE (mocked)
src/app/api/households/route.ts                   ← CREATE (POST + GET)
src/app/api/households/__tests__/route.test.ts    ← CREATE (mocked)
src/lib/hooks/useHousehold.ts                     ← CREATE (SWR)
src/lib/test-utils/__tests__/households.rls.test.ts ← CREATE (real-DB, gated)
src/app/(dashboard)/settings/page.tsx             ← MODIFY (Household section)
messages/en.json, messages/bg.json                ← MODIFY (household namespace)
.github/workflows/*                               ← MODIFY/CREATE (RLS CI job)
package.json                                      ← MODIFY (supabase devDep already implied by test:rls)
```
No existing files are functionally altered except Settings (additive section) and types (additive). Solo `categories`/`transactions` are untouched (no `household_id` yet).

### Testing Requirements
- **RLS integration (real DB, gated):** the heart of this story's security ACs (#4–#6). Use the harness; assert what the DB returns to each authenticated user, never service-role reads. Cover the full isolation matrix foundation: member-can-read, other-household-cannot-read, non-admin-cannot-mutate, creator-is-admin.
- **Mocked unit/integration:** service + route happy/edge paths (201/400/401/409, GET null vs household).
- **Regression:** `npm test` stays green with the RLS suite skipped (no `RLS_TEST_*` env). en/bg key-parity test must pass.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.1] — ACs (creation, admin, DB isolation, name)
- [Source: _bmad-output/planning-artifacts/prd.md#FR18] — household creation; #FR23 DB-level isolation; #NFR9–NFR11 RLS/isolation
- [Source: _bmad-output/planning-artifacts/architecture.md ADR-010] — households + household_members + household_id model
- [Source: _bmad-output/planning-artifacts/architecture.md ADR-015] — dual-path RLS strategy
- [Source: _bmad-output/planning-artifacts/architecture.md ADR-024] — household indexes
- [Source: supabase/migrations/001_initial_schema.sql] — table/RLS/index conventions
- [Source: supabase/migrations/002_insights_rls_policies.sql] — service-role policy pattern
- [Source: docs/testing/rls-integration-test-strategy.md] — RLS harness + run/CI strategy (PREP-1)
- [Source: src/lib/test-utils/rlsClient.ts] — harness helpers + `rlsDescribe` gating
- [Source: src/lib/services/insightService.ts; settingsService.ts] — service-layer + write patterns
- [Source: docs/testing/integration-test-guide.md] — chainable Supabase mock for unit tests
- [Source: src/app/(dashboard)/settings/page.tsx] — Settings "Manage" card pattern for the UI entry
- [Source: _bmad-output/planning-artifacts/adr-025-budget-limits-table.md] — forward context only (no budgets here)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 8 tasks implemented. `tsc --noEmit` clean, ESLint clean (0 warnings), **1364 tests pass + 10 skipped** (the 2 env-gated `*.rls.test.ts` suites — they run only where Docker/Supabase-local is available). No regressions.
- **Migration 020**: `households` + `household_members` (+ `household_role` enum, ADR-024 indexes). Dual-path RLS (ADR-015) with **recursion-safe `SECURITY DEFINER` helpers** `is_household_member` / `is_household_admin` — the policies never self-reference `household_members` (avoids Postgres 42P17). Policies are `DROP POLICY IF EXISTS`-guarded so the migration re-runs cleanly on local `supabase start`.
- **Create path** uses the service-role client with manual rollback (delete the household if the membership insert fails) rather than a plpgsql RPC — keeps it mock-testable and sidesteps the RLS read-back-after-insert problem (the SELECT policy needs membership that doesn't exist mid-insert). One-household-per-user (AC#3) enforced in `createHousehold`. Reads (`getCurrentHousehold`) use the auth-scoped client so RLS is genuinely exercised.
- **API** `/api/households`: POST (201/400/401/409) + GET (200 `{data: household|null}` / 401). `HouseholdExistsError` → 409.
- **UI**: self-contained `HouseholdSection` in Settings (create form when no household; name + role badge when present). New `useHousehold` SWR hook. en/bg i18n under a `household` namespace (key-parity test passes).
- **PREP-1 harness wired**: `households.rls.test.ts` (member-reads / outsider-blocked / non-admin-cannot-mutate / creator-is-admin), `supabase/config.toml` committed, and a dedicated CI job `.github/workflows/rls.yml` (boots Supabase via `supabase/setup-cli`, applies migrations, runs `test:rls`).
- **Environment note:** `supabase start` / `npm run test:rls` require Docker; unavailable in this dev sandbox, so the RLS suites skip locally and execute in the `rls` CI job. `npm i -D supabase` is not added (CI uses `supabase/setup-cli`; local devs use `npx supabase`) to avoid lockfile churn.
- **Deliberately deferred** (forward context only): transparency/`visibility_level` (13.4), invitations (13.2/13.3), `household_id` on categories/transactions (13.5), ADR-025 budgets. No solo features were altered.

### File List

- supabase/migrations/020_households.sql — CREATED
- supabase/config.toml — CREATED (local Supabase config for RLS harness)
- src/types/database.types.ts — MODIFIED (HouseholdRole, households + household_members tables, domain types, Enums entry)
- src/lib/services/householdService.ts — CREATED (createHousehold, getCurrentHousehold, HouseholdExistsError)
- src/lib/services/__tests__/householdService.test.ts — CREATED (7 mocked tests)
- src/app/api/households/route.ts — CREATED (POST + GET)
- src/app/api/households/__tests__/route.test.ts — CREATED (8 mocked tests)
- src/lib/hooks/useHousehold.ts — CREATED (SWR)
- src/components/household/HouseholdSection.tsx — CREATED (Settings UI)
- src/lib/test-utils/__tests__/households.rls.test.ts — CREATED (6 real-DB tests, env-gated)
- src/app/(dashboard)/settings/page.tsx — MODIFIED (import + render HouseholdSection)
- messages/en.json — MODIFIED (household namespace)
- messages/bg.json — MODIFIED (household namespace)
- .github/workflows/rls.yml — CREATED (RLS integration CI job)
- docs/testing/rls-integration-test-strategy.md — MODIFIED (PREP-1 DoD marked done + Docker note)

## Change Log

- 2026-06-03: Implemented Story 13.1 — household schema + dual-path RLS foundation, service/API/UI, and the wired RLS integration-test harness. Status → review.
- 2026-06-03: Addressed code review — 3 findings fixed (1 HIGH security, 1 MED CI, 1 LOW UX), 2 deferred, 1 dismissed. Status → done.

## Senior Developer Review (AI)

**Date:** 2026-06-03 · **Reviewer:** bmad-code-review (three-lens) on the uncommitted working tree vs baseline `53409c9` · **Outcome:** Approved after fixes

The RLS focus was deliberate (the real-DB tests can't execute in this Docker-less sandbox), and it surfaced a genuine cross-household breach vector.

### Action Items

- [x] **[HIGH] Cross-household breach via over-permissive `household_members` INSERT policy** (`020_households.sql`). `WITH CHECK (user_id = auth.uid())` let any authenticated user insert their own row into ANY `household_id` and self-join (as admin) → read another household's data (violates AC#4 / NFR11 / FR23). **Fixed:** removed both anon INSERT policies (households + household_members); all membership/household writes go through the service-role-backed API, with invitation-guarded joins coming in Story 13.3. Added a regression RLS test (`outsider CANNOT insert themselves into household A`).
- [x] **[MED] CI `rls` job could green-pass without running the RLS tests** (`.github/workflows/rls.yml`). If `supabase status` credential extraction yielded empty `RLS_TEST_*`, the env-gated suites skip and the job exits 0 — false confidence. **Fixed:** added a guard step that fails the job when any `RLS_TEST_*` var is empty.
- [x] **[LOW] `HouseholdSection` masked a fetch error as "no household"** (showed the create form on a failed GET). **Fixed:** added an error state (`household.loadError` i18n, en+bg).
- [ ] **[LOW][Defer] `getCurrentHousehold` uses `maybeSingle()`** — would throw if a user is ever in >1 household. Acceptable while one-per-user holds; revisit when multi-household lands.
- [ ] **[LOW][Defer] One-household-per-user has a TOCTOU race** — no `UNIQUE(user_id)` on `household_members` (kept open for future multi-household). Concurrent double-submit could create two memberships.
- [x] **[Dismissed] `households.updated_at` has no auto-update trigger** — no update path exists in this story; add with the rename feature.

Post-fix: `tsc` + ESLint clean; **1364 tests pass, 11 skipped** (RLS suites incl. the new regression test). Deferred items logged for future stories.
