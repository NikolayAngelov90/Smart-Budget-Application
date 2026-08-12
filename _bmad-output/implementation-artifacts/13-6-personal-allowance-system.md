---
baseline_commit: 3d331047875fe60110ec120019773b5399b79146
---

# Story 13.6: Personal Allowance System

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a household member,
I want to maintain a personal allowance — a private budget within the household,
so that I have financial autonomy for personal spending.

## Acceptance Criteria

1. **Given** a user is part of a household, **When** they configure a personal allowance, **Then** the allowance has its own budget amount that is invisible to other household members.
2. **Given** a user has a personal allowance, **When** they record spending against it, **Then** transactions within the allowance are completely private (no other member can read the row or its amount via any access path).
3. **Given** a household with shared categories and contribution totals, **When** allowance spending occurs, **Then** the allowance does not affect any shared budget calculation (it is excluded from `household_category_totals` and from members' transaction SELECT).
4. **Given** a configured allowance, **When** the owner views it, **Then** they see the budget amount, current-period spend, and remaining balance, with a clear "only you can see this" privacy indicator.
5. **Given** a user with no household, **When** they open the household area, **Then** the allowance UI is not offered (the allowance is a private budget *within a household*, AC tie to "is part of a household").

## Tasks / Subtasks

- [x] Task 1: Migration 024 — `personal_allowances` table + `transactions.allowance_id` (AC: #1, #2, #3)
  - [x] Create `personal_allowances` (id, user_id FK auth.users, household_id FK households, monthly_amount NUMERIC(12,2) NOT NULL CHECK >= 0, currency TEXT NOT NULL DEFAULT 'EUR', created_at, updated_at). `UNIQUE (user_id, household_id)` — one allowance per user per household (MVP).
  - [x] Add `allowance_id UUID NULL REFERENCES personal_allowances(id) ON DELETE SET NULL` to `transactions`; index it.
  - [x] Enable RLS on `personal_allowances`. **Owner-only** (NO dual-path): SELECT/INSERT/UPDATE/DELETE all gated `USING/WITH CHECK (auth.uid() = user_id)`. This is the privacy guarantee for AC#1 — household members have no SELECT path to the row.
  - [x] Add an updated_at trigger (reuse the project's existing `set_updated_at`/`handle_updated_at` pattern from prior migrations).
  - [x] COMMENTs documenting the privacy model + the `household_id IS NULL` invariant for allowance transactions.
- [x] Task 2: Types (AC: #1, #2, #4)
  - [x] `src/types/database.types.ts`: add `personal_allowances` table block (Row/Insert/Update); add `allowance_id: string | null` to `transactions` Row/Insert/Update; add a `PersonalAllowance` domain type and an `AllowanceStatus` type (`{ allowance: PersonalAllowance | null; spent: number; remaining: number | null }`).
- [x] Task 3: `allowanceService.ts` (AC: #1, #2, #3, #4)
  - [x] `getAllowance(userId)` → the row or null (auth-scoped client; RLS owner-only enforces privacy).
  - [x] `upsertAllowance(userId, { monthly_amount, currency })` → create or update the single allowance; resolves the caller's `household_id` from `household_members` (throws `NotHouseholdMemberError` if none — reuse from `householdService`); validates `monthly_amount >= 0` and a finite number; validates `currency` ∈ `SUPPORTED_CURRENCIES`.
  - [x] `getAllowanceStatus(userId)` → `{ allowance, spent, remaining }` where `spent` = sum of current-month **expense** transactions with `allowance_id = allowance.id`; `remaining = monthly_amount - spent`. Null allowance → `{ allowance: null, spent: 0, remaining: null }`.
  - [x] Typed error mapping consistent with the household services (e.g. `NotHouseholdMemberError` → 403).
- [x] Task 4: API `/api/allowance` (AC: #1, #4)
  - [x] `GET /api/allowance` → `getAllowanceStatus`; 401 unauth; `{ data: AllowanceStatus }`. `export const dynamic = 'force-dynamic'`.
  - [x] `PUT /api/allowance` → zod-validate `{ monthly_amount, currency }`; `upsertAllowance`; 400 invalid, 403 `NotHouseholdMemberError`, 200 `{ data: PersonalAllowance }`.
  - [x] `DELETE /api/allowance` → remove the caller's allowance (owner-only via RLS); 200. Transactions keep their now-dangling tag cleared by `ON DELETE SET NULL`.
- [x] Task 5: Transaction tagging integration (AC: #2, #3)
  - [x] `POST /api/transactions`: accept optional `allowance_id`. If provided: (a) verify it resolves under RLS (owner's allowance) else 400; (b) **force `household_id = NULL`** on the insert regardless of the category; (c) reject (400) if the chosen category is a shared category (`category.household_id` is not null) — an allowance expense cannot be tagged to a shared category.
  - [x] `transactions` GET select: add `allowance_id` to the selected columns so the client can distinguish allowance transactions (does not change the existing `.eq('user_id')` scoping).
  - [x] Confirm `household_category_totals` (migration 023) already excludes these (allowance txns have `household_id NULL` and are not in any shared category) — assert in the RLS test, no SQL change expected.
- [x] Task 6: UI + i18n (AC: #4, #5)
  - [x] `AllowanceCard` (new) in the household area (rendered by `HouseholdSection.tsx`, only when `useHousehold()` resolves a membership): budget amount, spent, remaining, a progress bar, an edit form (amount + currency), and a lock/"only you can see this" indicator. Use `formatAmount(value, currency)` — never hard-coded symbols (ESLint `no-restricted-syntax`).
  - [x] Optional allowance toggle in the transaction entry form: when the user has an allowance and the selected category is personal (not shared), allow "Count toward my personal allowance" which sets `allowance_id`. Hidden when no allowance exists or a shared category is selected.
  - [x] `messages/en.json` + `messages/bg.json`: `allowance` namespace (heading, privacyNote, budgetLabel, spentLabel, remainingLabel, edit, save, amountLabel, currencyLabel, none/setup, countTowardAllowance). Keep en/bg key parity (translations.test.ts).
- [x] Task 7: RLS integration test `allowance.rls.test.ts` (AC: #1, #2, #3)
  - [x] `@jest-environment node` in the FIRST docblock; `rlsDescribe` env-gated; Docker-gated.
  - [x] Member B cannot SELECT member A's `personal_allowances` row (0 rows).
  - [x] An allowance transaction (household_id NULL, allowance_id set) is invisible to member B's transactions SELECT.
  - [x] `household_category_totals(household_id)` called by B (and by A) does not include allowance spend.
  - [x] Owner A can read/update/delete only their own allowance.
- [x] Task 8: Mocked unit/route tests (AC: #1, #3, #4)
  - [x] `allowanceService.test.ts`: upsert validation (negative amount, bad currency, no-household→403), status math (spent/remaining, null allowance).
  - [x] `allowance` route test: GET/PUT/DELETE 200/401/400/403.
  - [x] Transactions route test: `allowance_id` forces `household_id NULL`; shared category + allowance_id → 400.
- [x] Task 9: Verification
  - [x] `npx tsc --noEmit` clean; `npx eslint` clean (watch currency rule); full `npx jest` green (RLS suites skipped without Docker).
  - [x] Finalize Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Architecture & data-model decisions

- **No budget-limits table exists in the MVP.** Migration 018 documents this: "exceeded budget" is computed from the 3-month historical average, not a stored budget. The personal allowance therefore introduces the *first* explicit stored budget amount — keep it self-contained in `personal_allowances`; do **not** retrofit a generic per-category budget here. [Source: supabase/migrations/018_recovery_plans.sql:3-4]
- **Privacy model (the crux of this story).** Two independent guarantees, both at the data layer (NFR27-style "inaccessible via any path"):
  1. The allowance *amount* lives in `personal_allowances` with **owner-only RLS** — unlike categories/transactions (Story 13.5's dual-path), there is deliberately **no** `is_household_member` OR-branch. Members simply cannot SELECT the row.
  2. Allowance *transactions* are kept private by the existing transactions SELECT policy: a member sees another member's transaction only when `household_id IS NOT NULL AND is_household_member AND category_visibility = 'shared'` (migration 023). Allowance transactions are inserted with **`household_id = NULL`**, so that OR-branch is inert → owner-only. [Source: supabase/migrations/023_transparency.sql:114-124]
- **Exclusion from shared calcs (AC#3) is automatic, not a new filter.** `household_category_totals` only sums categories where `household_id = p_household_id AND visibility_level IN ('shared','category_only')`. Allowance transactions are personal (household_id NULL) and tagged to personal categories, so they never appear. The RLS test asserts this; no SQL change is needed. [Source: supabase/migrations/023_transparency.sql:56-63]
- **Service/RLS split (established pattern).** Household *writes* that need to bypass RLS use the service-role client; *reads* use the auth-scoped client so RLS is genuinely exercised. For the allowance, owner-only RLS means **both** reads and writes can use the auth-scoped client (`auth.uid() = user_id` covers all ops) — prefer that over service-role so the privacy policy is actually tested in production paths. [Source: src/lib/services/householdService.ts:1-14, 122-142]
- **Reuse `NotHouseholdMemberError`** from `householdService.ts` for the no-household case (maps to 403), matching the preset route. [Source: src/lib/services/householdService.ts:32-38; src/app/api/households/preset/route.ts:40-46]

### Files to touch

- NEW `supabase/migrations/024_personal_allowances.sql`
- UPDATE `src/types/database.types.ts` — allowance table + domain types + `allowance_id` on transactions
- NEW `src/lib/services/allowanceService.ts`
- NEW `src/app/api/allowance/route.ts` (GET/PUT/DELETE)
- UPDATE `src/app/api/transactions/route.ts` — accept `allowance_id`, force `household_id NULL`, reject shared-category tagging, add `allowance_id` to GET select
- NEW `src/components/household/AllowanceCard.tsx`
- UPDATE `src/components/household/HouseholdSection.tsx` — render `AllowanceCard` for members
- UPDATE the transaction entry form component (allowance toggle) — locate the existing modal (e.g. `src/components/transactions/*Modal*.tsx`)
- UPDATE `messages/en.json`, `messages/bg.json`
- NEW `src/lib/test-utils/__tests__/allowance.rls.test.ts`
- NEW `src/lib/services/__tests__/allowanceService.test.ts`
- NEW `src/app/api/allowance/__tests__/route.test.ts`
- UPDATE the transactions route test for allowance tagging

### Project Structure Notes

- Migration numbering continues at **024** (023 is the latest). Migrations are applied manually to the live DB (Vercel does not run them) — flag in the Change Log that 024 must be applied with 020–023 before deploy. [Source: memory ops note `supabase-migrations-manual-apply.md`]
- RLS tests: `@jest-environment node` in the **first** docblock (Jest reads only the first), `rlsDescribe` gate, Docker-gated; `npm run test:rls` uses the positional Jest pattern (Jest 30). [Source: existing `*.rls.test.ts`]
- Currency: always `formatAmount(amount, currency)`; never hard-code `$`/`€`/`£` or ISO codes in `src/lib/ai`, `src/lib/services`, `src/app/api/cron` (ESLint `no-restricted-syntax`). The allowance carries an explicit `currency` column.

### Testing standards summary

- Mocked API/route tests: `@jest-environment node`, mock `next/server` + `@/lib/supabase/server` before imports, chainable Supabase mock.
- en/bg parity enforced by `translations.test.ts`; if any value is intentionally identical across languages, add it to the allowlist.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.6 (lines 580-592)]
- [Source: supabase/migrations/023_transparency.sql] — transactions SELECT policy + `household_category_totals`
- [Source: supabase/migrations/022_shared_categories.sql] — dual-path pattern + WITH CHECK membership guards
- [Source: src/app/api/transactions/route.ts] — POST insert (household_id derivation) + GET select
- [Source: src/lib/services/householdService.ts] — service/RLS split, `NotHouseholdMemberError`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- tsc surfaced the same fixture gap as 13.4: making `allowance_id` a required field on the transactions Row type broke 6 AI fixture factories → added `allowance_id: null` to the transaction (not category) fixtures.
- allowance-tagging POST test initially 500'd: the route's `checkAndTriggerForTransactionCount(...).catch(...)` needs a promise-returning mock (the existing transactions GET test never exercised POST).

### Completion Notes List

- All 9 tasks implemented. **tsc 0, ESLint 0, full suite green: 1441 passed / 34 skipped** (6 env-gated RLS suites, incl. the new allowance one). No regressions.
- **Privacy is enforced at the data layer, two ways:** (1) `personal_allowances` has **owner-only** RLS (no household member OR-branch — unlike 022/023), so the amount is invisible to other members; (2) allowance transactions are inserted with `household_id = NULL` (forced server-side), so the migration-023 transactions SELECT household OR-branch is inert and `household_category_totals` never sums them. **No change to migration 023 was needed** — exclusion from shared totals is automatic. The RLS test proves all three.
- **Owner-only RLS lets the service use the auth-scoped client for reads AND writes** (`auth.uid() = user_id` covers every op), so the privacy policy is exercised in the real production path rather than bypassed with the service role.
- **Transaction tagging:** POST accepts `allowance_id`; if set it forces the row personal (`household_id NULL`) and rejects a shared category (400) or an unknown allowance (400). GET/insert selects now return `allowance_id`.
- **UI:** `AllowanceCard` (budget / spent / remaining + progress + edit form + lock + "only you can see this") rendered in `HouseholdSection` for members; transaction modal shows a "Count toward my personal allowance" toggle only for a new personal-category expense when an allowance exists. en/bg i18n added.
- **Deploy:** migration 024 must be applied to the live DB with 020–023 (see ops memory) or allowance reads/writes fail.

### File List

- supabase/migrations/024_personal_allowances.sql — CREATED
- src/types/database.types.ts — MODIFIED (personal_allowances table block; allowance_id on transactions Row/Insert/Update; PersonalAllowance/AllowanceStatus domain types)
- src/lib/services/allowanceService.ts — CREATED
- src/app/api/allowance/route.ts — CREATED (GET/PUT/DELETE)
- src/app/api/transactions/route.ts — MODIFIED (accept allowance_id, force household_id NULL, reject shared-category tagging, select allowance_id)
- src/lib/hooks/useAllowance.ts — CREATED
- src/components/household/AllowanceCard.tsx — CREATED
- src/components/household/HouseholdSection.tsx — MODIFIED (render AllowanceCard)
- src/components/transactions/TransactionEntryModal.tsx — MODIFIED (allowance toggle)
- messages/en.json, messages/bg.json — MODIFIED (allowance namespace + transactions allowance keys)
- src/lib/test-utils/__tests__/allowance.rls.test.ts — CREATED (real-DB, node env, gated)
- src/lib/services/__tests__/allowanceService.test.ts — CREATED (mocked)
- src/app/api/allowance/__tests__/route.test.ts — CREATED (mocked)
- src/app/api/transactions/__tests__/allowance-tagging.test.ts — CREATED (mocked)
- src/lib/ai/__tests__/{forecastEngine,patternDetection,recoveryPlanner,reengagementAnalysis,seasonalAnalysis}.test.ts, __tests__/lib/ai/insightRules.test.ts — MODIFIED (fixture allowance_id: null)

## Change Log

- 2026-06-05: Implemented Story 13.6 — personal allowance system (migration 024 owner-only personal_allowances + transactions.allowance_id; allowanceService; /api/allowance GET/PUT/DELETE; transaction tagging forces household_id NULL; AllowanceCard + modal toggle; en/bg i18n; RLS + mocked tests). Status → review.
- 2026-06-05: Code review (three-lens) — Approve. One LOW applied (E2: POST now rejects tagging a non-expense transaction to an allowance). Verified the edit route never mutates household_id/allowance_id, so the privacy invariant can't be broken via edit. Status → done.

## Senior Developer Review (AI)

Reviewer: claude-opus-4-8 · 2026-06-05 · Outcome: **Approve (1 LOW fixed)**

**Acceptance/NFR audit**
- AC1 (amount invisible): ✅ `personal_allowances` owner-only RLS — co-member SELECT returns 0 rows (rls test).
- AC2 (txns fully private): ✅ allowance txns forced `household_id NULL` → migration-023 transactions SELECT household OR-branch is inert. **Verified the edit route (`PUT /api/transactions/[id]`) never writes `household_id`/`allowance_id`**, so the invariant cannot be undone by editing.
- AC3 (no shared-calc effect): ✅ allowance txns live in personal categories (POST rejects shared-category tagging), and `household_category_totals` only joins `categories WHERE household_id = p_household_id` → never summed.
- AC4/AC5: ✅ AllowanceCard (budget/spent/remaining + lock + privacy copy), gated to members.

**Findings**
- E2 (LOW, FIXED): POST accepted `allowance_id` on income; now 400 ("only expenses can be tagged"). Tightens AC2 semantics; regression test added.
- E3 (LOW, accept): `spent` sums raw amounts across currencies — pre-existing app-wide simplification.

**Architecture note:** Owner-only RLS (not dual-path) is the right call — it lets the service read AND write via the auth-scoped client, so the privacy policy is exercised in production rather than bypassed by the service role.

**Verification:** tsc 0, ESLint 0, full suite green (1441+ pass / 34 skipped). Migration 024 must be applied to the live DB with 020–023 before deploy.
