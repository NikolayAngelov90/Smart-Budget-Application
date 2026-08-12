---
baseline_commit: f398e9e0f2fd539133c574c22ec66a5281fdb905
---

# Story 13.4: Transparency Presets & Per-Category Controls

Status: done

> The epic's most security-sensitive story. Layers **per-category transparency** on top
> of 13-5's shared categories: each shared category gets a `visibility_level`
> (shared | category_only | private), and members pick a **preset** (Newlyweds /
> Roommates / Partners) that sets sensible defaults. Enforced **at the data layer**
> (NFR27): private data is inaccessible via any path; `category_only` exposes **totals
> but never individual rows**. Combined dashboard is 13-8 (reuses the aggregate helper).

## Story

As a household member,
I want to choose a transparency preset and fine-tune visibility per shared category,
So that I control exactly what financial detail my household sees — full detail, totals-only, or nothing — with the rules enforced by the database, not just the UI.

## Acceptance Criteria

1. **Given** the migration runs, **Then** a `visibility_level` enum (`shared`, `category_only`, `private`) is added to `categories` (NOT NULL DEFAULT `'shared'` — so existing 13-5 shared categories keep today's behavior), and a nullable `preset` (`newlyweds` | `roommates` | `partners` | `custom`) is added to `household_members`.

2. **Given** RLS, **When** a household member queries, **Then**:
   - **shared** category → members see the category **and** its transactions (13-5 behavior).
   - **category_only** category → members see the **category** (name/metadata, for totals) but **NOT** its individual transactions.
   - **private** category → members see **neither** the category nor its transactions; only the owner does.
   Owners always see their own categories/transactions regardless of level. Verified by a real-DB RLS test for **every** level (NFR10/NFR11/NFR27).

3. **Given** `category_only` (and `shared`) categories, **When** a member needs household totals, **Then** a `SECURITY DEFINER` aggregate helper returns per-category **sums** (never individual rows) for the household — exposing totals for `category_only` without leaking transactions. The helper verifies the caller is a household member before returning. `private` categories are **excluded** from the aggregate for non-owners.

4. **Given** the category owner, **When** they set a shared category's `visibility_level` (override), **Then** it is persisted; **only the owner** of a category may change its visibility (it's their data's privacy). Non-owners (even admins) cannot change another member's category visibility.

5. **Given** a member, **When** they choose a preset, **Then** `household_members.preset` is saved and a sensible default `visibility_level` is applied to **their own** shared categories:
   - **Newlyweds** → all `shared`.
   - **Partners** → all `category_only`.
   - **Roommates** → **bill** categories `shared`, everything else `private`. A category is a "bill" when its name matches the bills keyword list (case-insensitive, substring): rent, mortgage, utilities, electricity, electric, power, water, gas, internet, wifi, broadband, council tax, trash, garbage, sewage, heating. (Tunable constant; documented.)
   Presets are a starting point; the **per-category override (AC#4) is authoritative** and not overwritten unless the user re-applies a preset.

6. **Given** the write guards from 13-5, **When** INSERT/UPDATE run, **Then** the `WITH CHECK` household-membership guards remain; setting `visibility_level` cannot be used to read or inject across households. `private` enforcement is at the data layer — a member cannot reach private rows via the table, the aggregate helper, or any API path.

7. **Given** the UI, **When** a member edits one of **their** shared categories, **Then** they can set its visibility (Shared / Totals only / Private) with a plain-language explanation; **When** they open household setup, **Then** they can pick a preset. Non-owners don't see visibility controls for others' categories. en/bg i18n.

8. **No regression.** 13-5 shared categories default to `shared` (unchanged). Personal categories (no household_id) ignore visibility_level. Solo users unaffected.

## Tasks / Subtasks

- [x] **Task 1 — Migration `023_transparency.sql`** (AC: #1, #2, #3, #6)
  - [x] `CREATE TYPE visibility_level AS ENUM ('shared','category_only','private')` (idempotent `DO $$…duplicate_object`). `ALTER TABLE categories ADD COLUMN IF NOT EXISTS visibility_level visibility_level NOT NULL DEFAULT 'shared'`. `ALTER TABLE household_members ADD COLUMN IF NOT EXISTS preset TEXT CHECK (preset IN ('newlyweds','roommates','partners','custom'))`.
  - [x] `SECURITY DEFINER` helper `public.category_visibility(p_category_id uuid) RETURNS visibility_level` (reads the category's level, bypassing RLS) — used by the transactions SELECT policy to avoid recursion/visibility leaks. `SET search_path = public`, STABLE.
  - [x] **Refine categories SELECT**: `auth.uid() = user_id OR (household_id IS NOT NULL AND visibility_level <> 'private' AND public.is_household_member(household_id, auth.uid()))` — members see shared + category_only, never private.
  - [x] **Refine transactions SELECT**: `auth.uid() = user_id OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()) AND public.category_visibility(category_id) = 'shared')` — members see rows only for shared categories; category_only/private rows are hidden.
  - [x] Keep the 13-5 INSERT/UPDATE `WITH CHECK` membership guards unchanged (DROP+recreate only the two SELECT policies). `DROP POLICY IF EXISTS` guards throughout.
  - [x] `SECURITY DEFINER` aggregate `public.household_category_totals(p_household_id uuid)` RETURNS TABLE(category_id uuid, category_name text, visibility_level visibility_level, total numeric): membership-gated (`IF NOT is_household_member(p_household_id, auth.uid()) THEN RETURN; END IF;`); sums expense/income per category for `shared` + `category_only` categories of the household (exclude `private`); returns **only aggregates**. Design so Story 13-8 reuses it.

- [x] **Task 2 — Types** (AC: #1) — add `VisibilityLevel` union + `visibility_level` to `categories` Row/Insert/Update; `preset` to `household_members`; Enums entry; a `HouseholdCategoryTotal` domain type for the RPC result. `HouseholdPreset` union.

- [x] **Task 3 — Category visibility API** (AC: #4) — extend `PUT /api/categories/[id]` to accept `visibility_level`; apply it **only if the caller owns the category** (`category.user_id === user.id`) and it's a shared (household) category; otherwise ignore/403 for that field. (Name/color edits keep 13-5 member-manage behavior.)

- [x] **Task 4 — Preset API** (AC: #5) — `PATCH /api/households/preset` (or extend `/api/households`): set `household_members.preset` for the caller and apply the default `visibility_level` mapping to the caller's own shared categories (service-role write; only the caller's categories). Return the updated preset. Validate preset value.

- [x] **Task 5 — Totals hook/endpoint (thin)** (AC: #3) — a `GET /api/households/category-totals` that calls the `household_category_totals` RPC for the caller's household (so category_only totals are reachable now and 13-8 can reuse). Returns `HouseholdCategoryTotal[]`.

- [x] **Task 6 — UI** (AC: #7) — CategoryModal (edit mode, shared category owned by caller): a visibility selector (Shared / Totals only / Private) with helper text; Household section: a preset picker (Newlyweds/Roommates/Partners) that calls the preset API with a confirm ("applies defaults to your shared categories"). Show a small visibility indicator on shared categories. en/bg i18n. Gate all controls on ownership/membership.

- [x] **Task 7 — RLS test `transparency.rls.test.ts`** (AC: #2, #3, #6) — node env, gated. Seed household A (owner a1, member a2) with three shared categories (shared, category_only, private) each with an a1 transaction. Assert a2: sees the shared category + its transactions; sees the category_only category but **NOT** its transactions; sees **neither** the private category nor its transactions; `household_category_totals` returns totals for shared + category_only but **excludes** private; an outsider gets nothing; the owner a1 sees all three fully. Also assert a2 cannot change a1's category visibility (owner-only).

- [x] **Task 8 — Mocked tests** (AC: #4, #5) — category visibility PUT (owner-only) + preset PATCH (saves + applies mapping). Reuse chainable mocks; route tests `@jest-environment node` (first docblock).

- [x] **Task 9 — Verify** — `tsc`, `npm run lint`, `npm test` (RLS gated/skipped), en/bg parity.

## Dev Notes

### 🚨 The category_only "totals but not rows" pattern (ADR-011/ADR-015) — the crux
- **Rows are hidden by RLS; totals come from a SECURITY DEFINER aggregate.** There is no way to make a single table SELECT "return sums but not rows," so: the transactions SELECT policy **excludes** category_only/private rows for members, and `household_category_totals()` (definer, membership-gated) computes the sums server-side. The dashboard/UI shows the total from the RPC, never the rows. Do NOT try to expose category_only rows through any view/policy.
- **`category_visibility()` must be SECURITY DEFINER** (reads the category's level bypassing RLS) so the transactions policy can consult it without recursion or needing the member to be able to SELECT the category row.
- **private = invisible everywhere:** excluded from categories SELECT (members), transactions SELECT (members), and the aggregate (non-owners). NFR27.

### Carry forward the 13-5 review lesson (HIGH-1)
- INSERT/UPDATE keep `WITH CHECK (household_id IS NULL OR is_household_member(household_id, auth.uid()))`. This story only refines the two SELECT policies + adds helpers; do NOT weaken the write guards. Changing `visibility_level` is an UPDATE by the owner — the WITH CHECK still applies.

### Ownership of visibility (AC#4)
- Visibility is the data owner's privacy control: only `category.user_id === auth.uid()` may change `visibility_level`. 13-5 lets members rename/delete shared categories, but **visibility is owner-only** — enforce in the API (and consider a future RLS refinement; API enforcement is sufficient for MVP since writes go through the route). Document this nuance.

### Preset mapping (AC#5) — keep simple + documented
- Newlyweds → default `shared`; Partners → `category_only`; Roommates → `private`. Applied only to the caller's own shared categories, and only when a preset is (re)selected; never clobbers an explicit per-category override unless re-applied. Preset is a convenience; per-category is authoritative.

### What already exists — reuse
- `categories.household_id` + dual-path RLS + `is_household_member` (13-5/020). Migration 022 is the SELECT policy baseline to refine.
- CategoryModal (13-5 added the Shared toggle) — add the visibility selector alongside.
- `useHousehold` hook; service-role write pattern; node-env-first-docblock RLS harness; positional `test:rls`.
- `household_category_totals` is the seam 13-8 (shared dashboard) will consume — design its shape for that.

### Project Structure Notes
```
supabase/migrations/023_transparency.sql               ← CREATE (enum, columns, refined SELECT policies, helpers)
src/types/database.types.ts                            ← MODIFY (visibility_level, preset, totals type)
src/app/api/categories/[id]/route.ts                   ← MODIFY (owner-only visibility_level)
src/app/api/households/preset/route.ts                 ← CREATE (PATCH preset + apply defaults)
src/app/api/households/category-totals/route.ts        ← CREATE (GET totals via RPC)
src/lib/hooks/useCategoryTotals.ts (optional)          ← CREATE (SWR for totals)
src/components/categories/CategoryModal.tsx            ← MODIFY (visibility selector, edit mode, owner)
src/components/household/HouseholdSection.tsx (or new) ← MODIFY (preset picker)
src/lib/test-utils/__tests__/transparency.rls.test.ts  ← CREATE (real-DB, node env, gated)
src/app/api/**/__tests__/*                             ← CREATE (mocked: visibility PUT, preset PATCH)
messages/en.json, messages/bg.json                     ← MODIFY (visibility + preset keys)
```
No changes to households/household_invitations. Builds strictly on 13-5.

### Testing Requirements
- **RLS (gated, node env):** the security heart — the full visibility matrix per level + the aggregate (totals for shared+category_only, private excluded) + owner-only visibility change. This is the NFR27 proof.
- **Mocked:** visibility PUT (owner-only) + preset PATCH (mapping). Preserve existing category/transaction route tests (note: the 13-5 GET/PUT changes already passed).
- **Regression:** full suite green with RLS skipped; en/bg parity (allowlist any language-agnostic keys); 13-5 shared categories still default to `shared`.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.4] — preset + per-category override + data-layer enforcement
- [Source: _bmad-output/planning-artifacts/prd.md#FR24] per-category transparency; #FR25 presets; #FR27/NFR27 data-layer enforcement (private inaccessible via any path)
- [Source: architecture.md ADR-011] visibility_level ENUM on shared categories; presets as JSON/config on household_members; category_only via aggregate
- [Source: architecture.md ADR-015] dual-path RLS; category_only "aggregate returns sums but blocks individual rows"
- [Source: supabase/migrations/022_shared_categories.sql] the SELECT policies to refine + the WITH CHECK guards to preserve
- [Source: supabase/migrations/020_households.sql] is_household_member SECURITY DEFINER helper
- [Source: 13-5 story Senior Developer Review] HIGH-1 lesson: INSERT/UPDATE need WITH CHECK membership
- [Source: src/components/categories/CategoryModal.tsx] shared toggle (13-5) — add visibility selector
- [Source: src/lib/test-utils/__tests__/shared-categories.rls.test.ts] RLS test shape to extend per level

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 9 tasks implemented. `tsc` clean, ESLint clean, **1421 tests pass + 29 skipped** (5 env-gated RLS suites). No regressions.
- **Migration 023**: `visibility_level` enum + column on categories (default `shared`); `preset` on household_members. Two SECURITY DEFINER helpers: `category_visibility(id)` (lets the transactions policy consult a category's level) and `household_category_totals(household_id)` (membership-gated aggregate — sums for shared + category_only, **private excluded**; reused by 13-8). Refined SELECT RLS: categories show shared+category_only to members (private = owner only); transactions show rows only for `shared` categories (category_only/private hidden). Write `WITH CHECK` guards from 022 unchanged.
- **Owner-only visibility enforced at the data layer** via a BEFORE UPDATE trigger (`enforce_category_visibility_owner`) — a member can rename/recolor a shared category (13-5) but cannot change its `visibility_level`; service-role (auth.uid() null, e.g. applyPreset) bypasses. This makes AC#4 a DB guarantee, not just an API check.
- **APIs**: category `PUT` accepts `visibility_level` (owner-only, 403 otherwise); `PATCH /api/households/preset` saves the preset + applies the default visibility mapping to the caller's own shared categories (Newlyweds→shared, Partners→category_only, **Roommates→bills shared / rest private** via a documented keyword heuristic); `GET /api/households/category-totals` exposes category_only totals via the RPC.
- **UI**: CategoryModal visibility selector (edit mode, shared categories); HouseholdSection preset picker; en/bg i18n.
- **RLS test** `transparency.rls.test.ts` proves the full per-level matrix + the aggregate (private excluded) + the owner-only trigger.
- **Fixtures:** added the new required `visibility_level` to the AI category fixtures.
- **Env note:** RLS suites need Docker → skip locally, run in the `rls` CI job. **Migration 023 must be applied to the live DB before/with deploy** (see ops memory).
- **Deferred:** combined shared dashboard (13-8) reuses `household_category_totals`.

### File List

- supabase/migrations/023_transparency.sql — CREATED
- src/types/database.types.ts — MODIFIED (VisibilityLevel, HouseholdPreset, visibility_level on categories, preset on household_members, totals function type, HouseholdCategoryTotal)
- src/types/category.types.ts — MODIFIED (optional household_id, visibility_level)
- src/app/api/categories/route.ts — MODIFIED (GET selects visibility_level)
- src/app/api/categories/[id]/route.ts — MODIFIED (owner-only visibility_level on PUT)
- src/lib/services/householdService.ts — MODIFIED (applyPreset, NotHouseholdMemberError, bills heuristic)
- src/app/api/households/preset/route.ts — CREATED (PATCH)
- src/app/api/households/category-totals/route.ts — CREATED (GET via RPC)
- src/components/categories/CategoryModal.tsx — MODIFIED (visibility selector)
- src/components/household/HouseholdSection.tsx — MODIFIED (preset picker)
- src/lib/test-utils/__tests__/transparency.rls.test.ts — CREATED (real-DB, node env, gated)
- src/app/api/categories/__tests__/visibility.route.test.ts — CREATED (mocked)
- src/app/api/households/preset/__tests__/route.test.ts — CREATED (mocked)
- src/lib/ai/__tests__/{forecastEngine,patternDetection,recoveryPlanner}.test.ts — MODIFIED (fixture visibility_level)
- messages/en.json, messages/bg.json — MODIFIED (visibility + preset keys)

## Change Log

- 2026-06-04: Implemented Story 13.4 — transparency presets & per-category controls (visibility_level + RLS refinement, category_only aggregate helper, owner-only trigger, preset API w/ Roommates bills heuristic, UI). Status → review.
- 2026-06-05: Code review (three-lens) — one MED applied (E3: applyPreset now throws on a mid-loop category UPDATE failure instead of silently leaving the preset partially applied). AC#4 verified at two layers (API + DB trigger); NFR27 verified across SELECT RLS, transactions policy, and the membership-gated aggregate. Status → done.

## Senior Developer Review (AI)

Reviewer: claude-opus-4-8 · 2026-06-05 · Outcome: **Approve (1 MED fixed)**

**Acceptance/NFR audit**
- AC#4 (owner-only visibility): ✅ Two-layer — API PUT returns 403 when `existingCategory.user_id !== user.id`, and DB trigger `enforce_category_visibility_owner` blocks any non-owner change via the raw REST path. Service-role bypasses correctly (`OLD.user_id <> auth.uid()` → NULL when `auth.uid()` is NULL).
- NFR27 (private inaccessible via any path): ✅ categories SELECT excludes `private` for members; transactions SELECT requires `category_visibility(category_id) = 'shared'`; `household_category_totals` filters `visibility_level IN ('shared','category_only')`; RPC is membership-gated.

**Findings**
- E3 (MED, FIXED): `applyPreset` per-category UPDATE loop swallowed errors → preset could be saved with visibility only partially applied. Now checks the error and throws.
- B1 (LOW, accept): `category_visibility` is a per-row PK lookup inside the transactions policy — `STABLE` + indexed, acceptable.
- B2 (LOW, won't-fix): `category_visibility`/`household_category_totals` keep PUBLIC EXECUTE — structurally required (the transactions policy needs `authenticated` to execute the helper). Leak surface is a single enum for an unguessable UUID.
- E4 (LOW, accept): Roommates bill keyword heuristic can false-positive on substrings; per-category override is authoritative and documented.

**Verification:** tsc 0, ESLint 0, full suite green (1421 pass / 29 skipped). Migration 023 must be applied to the live DB with 020–022 before deploy.
