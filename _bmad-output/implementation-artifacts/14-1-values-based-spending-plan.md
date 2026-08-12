---
baseline_commit: ceaa323ab7e8c08d2c8d395ea674a377a763a24a
---

# Story 14.1: Values-Based Spending Plan

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user who wants intentional spending,
I want to define a values-based spending plan that aligns budget categories to my personal priorities,
so that my money flows toward what matters most to me rather than just staying under arbitrary caps.

## Acceptance Criteria

1. **Given** a logged-in user, **When** they create a values-based spending plan, **Then** they can define personal **values** (e.g., Health, Family, Growth, Fun) — each with a name.
2. **And** they can **assign budget categories to one or more values** (a category may map to multiple values; a value can hold many categories).
3. **And** they can set a **priority ranking** for their values (reorder them).
4. **And** the plan is **saved and editable** (create / rename / reorder / reassign categories / delete) from Settings.
5. **Given** the plan is personal, **When** any value or mapping is read or written, **Then** it is **owner-only** (no other user can see or change it).

## Tasks / Subtasks

- [x] Task 1: Migration 031 — values + category mappings (AC: #1, #2, #3, #5)
  - [x] `CREATE TABLE user_values` (id uuid pk, user_id uuid FK auth.users ON DELETE CASCADE NOT NULL, name TEXT NOT NULL CHECK(char_length(trim(name)) BETWEEN 1 AND 50), priority INTEGER NOT NULL DEFAULT 0, created_at, updated_at). **Name it `user_values`, NOT `values`** — `values` is a SQL reserved word. `UNIQUE (user_id, lower(name))` to prevent dupes (partial/expression index). Index `user_id`. updated_at trigger reuses `update_updated_at_column` (001).
  - [x] `CREATE TABLE value_categories` (id uuid pk, user_id uuid FK auth.users ON DELETE CASCADE NOT NULL, value_id uuid FK user_values(id) ON DELETE CASCADE NOT NULL, category_id uuid FK categories(id) ON DELETE CASCADE NOT NULL, created_at, `UNIQUE (value_id, category_id)`). Denormalized `user_id` so RLS is a simple `auth.uid() = user_id` (no recursive join). Index `value_id`, `category_id`.
  - [x] **Owner-only RLS** on both (SELECT/INSERT/UPDATE/DELETE all gated `auth.uid() = user_id`; INSERT WITH CHECK same). No dual-path — this is purely personal (unlike Epic 13).
  - [x] COMMENTs.
- [x] Task 2: Types (AC: #1, #2, #3)
  - [x] `database.types.ts`: add `user_values` + `value_categories` table blocks (Row/Insert/Update/Relationships); domain types `SpendingValue` (= user_values Row), `ValueCategory`, `ValueWithCategories` (`SpendingValue & { category_ids: string[] }`), and inputs `CreateValueInput { name; categoryIds?: string[] }`, `UpdateValueInput { name?; priority? }`.
- [x] Task 3: `valuesService.ts` (AC: #1, #2, #3, #4, #5) — auth-scoped client throughout (owner-only RLS is the boundary; exercised in prod, not bypassed)
  - [x] `getValuesPlan(userId)` → all `user_values` ordered by `priority ASC, created_at ASC`, each with its `category_ids` (one `value_categories` query, grouped in memory). Returns `ValueWithCategories[]`.
  - [x] `createValue(userId, input)` → validate name (1–50, trimmed); `priority` = (max existing priority) + 1; insert value; if `categoryIds`, insert `value_categories` rows (validate each category is the user's own — RLS + a membership/ownership guard). Returns the new `ValueWithCategories`.
  - [x] `updateValue(userId, id, { name?, priority? })` → owner-scoped update (`.eq('user_id')`).
  - [x] `setValueCategories(userId, valueId, categoryIds)` → replace the value's mappings (delete existing for the value, insert the new set). Verify the value belongs to the user and each category is the user's own.
  - [x] `deleteValue(userId, id)` → owner-scoped delete (cascade removes mappings).
  - [x] `reorderValues(userId, orderedIds)` → set `priority` to the array index for each id (own rows only) — powers up/down or drag reordering.
  - [x] Typed error for bad input; rely on RLS for authorization.
- [x] Task 4: API (AC: #1, #2, #3, #4)
  - [x] `GET /api/values` → `getValuesPlan`; `{ data: ValueWithCategories[] }`; 401.
  - [x] `POST /api/values` → zod `{ name, categoryIds?: string[] }`; `createValue`; 400/401.
  - [x] `PATCH /api/values/[id]` → zod `{ name?, priority? }`; `updateValue`; 400/401/404.
  - [x] `PUT /api/values/[id]/categories` → zod `{ categoryIds: string[] }`; `setValueCategories`; 400/401/404.
  - [x] `DELETE /api/values/[id]` → `deleteValue`; 200/401.
  - [x] `PATCH /api/values/reorder` → zod `{ orderedIds: string[] }`; `reorderValues`. All routes `dynamic = 'force-dynamic'`.
- [x] Task 5: UI + i18n (AC: #1, #2, #3, #4)
  - [x] `useValues` hook → `GET /api/values`.
  - [x] `ValuesPlanSection` rendered in **Settings**: ranked list of values (priority order) — each shows name, assigned category chips (with color dots + remove), up/down reorder controls, inline rename, delete; an "Add category" menu (the user's categories from `/api/categories`) to assign/reassign; an "Add value" form (name). Empty state with a short explainer.
  - [x] Mount `<ValuesPlanSection />` in `src/app/(dashboard)/settings/page.tsx` (where HouseholdSection used to sit).
  - [x] `messages/en.json` + `bg.json`: `values` namespace. en/bg parity (translations.test.ts green).
- [x] Task 6: Tests (AC: #1, #2, #3, #5)
  - [x] `values.rls.test.ts` (gated): user B cannot SELECT/UPDATE/DELETE user A's `user_values` or `value_categories`; cascade delete of a value removes its mappings; a value + mappings round-trip for the owner.
  - [x] `valuesService.test.ts` (mocked): create assigns next priority + inserts mappings; setValueCategories replaces; reorder sets priorities by index; getValuesPlan groups category_ids; name validation.
  - [x] route tests: GET/POST/PATCH/PUT categories/DELETE/reorder (200/400/401/404/409).
- [x] Task 7: Verification
  - [x] `npx tsc --noEmit` clean; `npx eslint` clean; full `npx jest` green (1552 passed, 54 skipped Docker-gated RLS). Finalized Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Architecture & data-model decisions

- **`user_values`, never `values`.** `values` is a SQL reserved keyword — an unquoted `CREATE TABLE values` errors and quoting it everywhere is error-prone. Use `user_values`. [Source: Postgres reserved words]
- **Owner-only RLS, not dual-path.** This is a purely personal feature (no household). Both tables use simple `auth.uid() = user_id` for every op — mirror `personal_allowances` (024), which is the closest owner-only precedent. Use the **auth-scoped** client in the service so RLS is genuinely exercised (no service-role needed — there's no membership gate to satisfy). [Source: supabase/migrations/024_personal_allowances.sql; src/lib/services/allowanceService.ts]
- **Many-to-many via `value_categories` with a denormalized `user_id`.** A category maps to ≥1 values; storing `user_id` on the join row keeps RLS a flat `auth.uid() = user_id` (no recursive subquery into user_values/categories, avoiding the 42P17 recursion class). `ON DELETE CASCADE` from both `user_values` and `categories` keeps mappings clean when either side is removed. [Source: supabase/migrations/013_goals.sql goal_contributions pattern]
- **Priority = integer order.** Lower = higher priority. `createValue` appends `max(priority)+1`; `reorderValues(orderedIds)` rewrites priorities to the array index. The view story (14.2) reads this order. Keep it simple — no fractional ranks.
- **Editable from Settings (AC#4).** Add `ValuesPlanSection` to the settings page (where `HouseholdSection` was before it moved to /household). Don't add a nav tab for 14.1.
- **Categories source.** The assignment multi-select uses the existing `GET /api/categories` (returns the user's own + shared; for values, allow assigning any category the user can see — but only the user's mappings are stored, owner-only). Keep it simple: list categories from the existing endpoint.
- **goals/goal_contributions-style generic-client caveat does NOT apply here** — `user_values`/`value_categories` WILL be added to the typed `Database` schema (Task 2), so the typed client works directly (no `as unknown as SupabaseClient` cast needed).

### Files to touch

- NEW `supabase/migrations/031_values_plan.sql`
- UPDATE `src/types/database.types.ts`
- NEW `src/lib/services/valuesService.ts`
- NEW `src/app/api/values/route.ts` (GET, POST)
- NEW `src/app/api/values/[id]/route.ts` (PATCH, DELETE)
- NEW `src/app/api/values/[id]/categories/route.ts` (PUT)
- NEW `src/app/api/values/reorder/route.ts` (PATCH)
- NEW `src/lib/hooks/useValues.ts`
- NEW `src/components/values/ValuesPlanSection.tsx`
- UPDATE `src/app/(dashboard)/settings/page.tsx` (mount the section)
- UPDATE `messages/en.json`, `messages/bg.json`
- NEW `src/lib/test-utils/__tests__/values.rls.test.ts`
- NEW `src/lib/services/__tests__/valuesService.test.ts`
- NEW `src/app/api/values/__tests__/route.test.ts`

### Project Structure Notes

- Migration **031**. Apply 020→031 in order to the live DB (Vercel doesn't run them). [Source: memory ops note]
- API routes use `@/lib/supabase/server` `createClient` for auth + RLS-scoped reads/writes; tested with the chainable mock pattern; `@jest-environment node` + mock `next/server` before imports for route tests.
- RLS tests: `@jest-environment node` in the **first** docblock; `rlsDescribe`; Docker-gated; `npm run test:rls` positional pattern.
- en/bg parity enforced by `translations.test.ts`.
- This is Epic 14, Story 1 — no Epic-13 household coupling. Don't add household_id anywhere here.

### Testing standards summary

- Mocked service/route tests with chainable Supabase mock; assert priority assignment, mapping replace, grouping, validation, and HTTP codes.
- RLS test proves owner isolation + cascade.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 14.1 (lines 669-682)]
- [Source: supabase/migrations/024_personal_allowances.sql] — owner-only RLS precedent
- [Source: supabase/migrations/013_goals.sql] — id+user_id+join-table pattern
- [Source: src/lib/services/allowanceService.ts] — auth-scoped owner-only service pattern
- [Source: src/components/household/HouseholdSection.tsx] — settings-section UI shape to mirror
- [Source: src/app/(dashboard)/settings/page.tsx] — where the section mounts

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- Route test happy-paths initially 400'd: the placeholder UUID had an invalid variant nibble, so `z.string().uuid()` rejected it. Switched to a valid v4 UUID (`...-4111-8111-...`).
- One route test leaked across cases: `jest.clearAllMocks()` resets call records but NOT implementations, so a prior `mockRejectedValue` on `setValueCategories` bled into the next test. Set the resolved value explicitly in that test.

### Completion Notes List

- Migration **031** (`user_values` + `value_categories`) — owner-only RLS on both, mirroring `personal_allowances` (024). `value_categories.user_id` denormalized so RLS stays a flat `auth.uid() = user_id` (no recursive join → no 42P17). `UNIQUE (user_id, lower(name))` blocks dup value names per user; `UNIQUE (value_id, category_id)` blocks dup mappings. Both FKs `ON DELETE CASCADE` so deleting a value (or category) cleans up mappings. **Apply 020→031 in order to the live DB — Vercel does not run migrations.**
- `valuesService` uses the **auth-scoped** client throughout (no service-role) — owner-only RLS is the only authorization gate and is genuinely exercised in production. `replaceValueCategories` does delete-then-insert; `createValue` appends `max(priority)+1`; `reorderValues` rewrites priority to the array index. DB unique-violation (`23505`) is mapped to a friendly "already exists" message.
- API: `GET`/`POST /api/values`, `PATCH`/`DELETE /api/values/[id]`, `PUT /api/values/[id]/categories`, `PATCH /api/values/reorder` — all zod-validated, `force-dynamic`, 401/400/404/409.
- UI: `ValuesPlanSection` mounted in Settings (where HouseholdSection used to sit). Priority-ordered cards with `#n` rank badge, inline rename, up/down reorder (optimistic), category chips with color dots + remove, and an "Add category" menu of the user's unassigned categories. Empty-state explainer. `values` i18n namespace added to en + bg (parity test green).
- Tests: mocked `valuesService` (priority assignment, mapping replace, reorder-by-index, grouping, name validation, dup mapping) + route tests (all verbs/codes) + gated `values.rls.test.ts` (owner isolation for both tables, cascade delete, owner round-trip).

### File List

**New**
- `supabase/migrations/031_values_plan.sql`
- `src/lib/services/valuesService.ts`
- `src/app/api/values/route.ts`
- `src/app/api/values/[id]/route.ts`
- `src/app/api/values/[id]/categories/route.ts`
- `src/app/api/values/reorder/route.ts`
- `src/lib/hooks/useValues.ts`
- `src/components/values/ValuesPlanSection.tsx`
- `src/lib/services/__tests__/valuesService.test.ts`
- `src/app/api/values/__tests__/route.test.ts`
- `src/lib/test-utils/__tests__/values.rls.test.ts`

**Updated**
- `src/types/database.types.ts` (user_values + value_categories table blocks; SpendingValue / ValueCategory / ValueWithCategories / CreateValueInput / UpdateValueInput)
- `src/app/(dashboard)/settings/page.tsx` (mount ValuesPlanSection)
- `messages/en.json`, `messages/bg.json` (`values` namespace)

### Change Log

- 2026-06-09: Story 14.1 implemented — values-based spending plan (migration 031, owner-only valuesService, /api/values routes, ValuesPlanSection in Settings, en/bg i18n, mocked + RLS tests). tsc/eslint clean; jest 1552 passed / 54 skipped. Status → review.
- 2026-06-09: Code review fix (MED) — `replaceValueCategories` now filters supplied `categoryIds` against RLS-visible `categories` before inserting, so a value can never reference a category the caller doesn't own/share (Task 3 "validate each category is the user's own"). `createValue` returns the actually-stored ids. Added a service test for the filter. jest 1553 passed / 54 skipped.

## Senior Developer Review (AI)

**Outcome:** Approve (1 MED resolved in-session).

### Action Items

- [x] **[MED] Category-ownership not enforced on mapping inserts.** `value_categories` RLS only checks `user_id`, so the API would accept a mapping to any category UUID (including ones the caller can't see). Fixed: `replaceValueCategories` selects the supplied ids from `categories` (auth-scoped, RLS-filtered) and inserts only the visible subset; `createValue` returns the stored ids. Covered by a new service test. [src/lib/services/valuesService.ts]

Edge cases reviewed and OK: empty/duplicate category sets (dedup + delete-then-insert), reorder restricted to own rows via `.eq('user_id')`, case-insensitive name uniqueness mapped to a friendly 409, optimistic reorder reverts on failure.
