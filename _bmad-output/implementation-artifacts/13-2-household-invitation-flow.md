---
baseline_commit: 09c6690bf1e5aabd2621808945fa296c103fcbb1
---

# Story 13.2: Household Invitation Flow

Status: done

> Second Epic 13 story. Builds directly on 13-1's household foundation. An admin
> invites someone by email; the system mints a **single-use, 48h-expiry, email-bound
> token** (ADR-016 / NFR12) and prevents duplicate active invites. **Acceptance/join is
> Story 13-3** — this story is invite **creation / listing / revocation + token issuance**.
> Reuse 13-1's exact patterns: `is_household_admin` SECURITY DEFINER helper, SELECT-only
> RLS (all writes via service-role), and the node-env RLS test harness.

## Story

As a household admin,
I want to invite other people to my household by email with a secure, expiring invitation,
So that we can collaborate on shared finances — without exposing the household to anyone I didn't invite.

## Acceptance Criteria

1. **Given** the migration runs, **When** the schema is applied, **Then** a `household_invitations` table exists: `id`, `household_id` → households ON DELETE CASCADE, `email` (citext or lower-cased text), `token` UUID UNIQUE (DEFAULT `gen_random_uuid()` — cryptographic, unguessable), `status` ∈ {pending, accepted, revoked} (enum `invitation_status`), `invited_by` → auth.users, `expires_at` timestamptz NOT NULL, `accepted_by`/`accepted_at` (nullable, written in 13-3), `created_at`. A **partial unique index** prevents more than one **pending** invite per `(household_id, lower(email))`. Indexes: `(token)` (unique already), `(household_id)`, `(lower(email))`.

2. **Given** a household admin, **When** they `POST /api/invitations` with a valid `email`, **Then** an invitation is created with `status='pending'`, `expires_at = now() + 48h`, `invited_by = caller`, a fresh `token`; the response includes the invitation and a shareable accept link (`/join?token=<token>`). Email is validated + normalized (trimmed, lower-cased); invalid → 400.

3. **Given** the caller is not authenticated → 401. **Given** the caller has no household, or is a **member but not admin** → 403 (only admins invite). **Given** an active (pending, non-expired) invite to the same email already exists for the household → 409 (no duplicate active invites). Enforced in the service AND by the partial unique index (catch 23505 → 409).

4. **Given** a household admin, **When** they `GET /api/invitations`, **Then** they receive their household's invitations (pending + recent), each with a computed `isExpired` flag (`expires_at < now()`). Non-admins/non-members get 403.

5. **Given** a household admin, **When** they `DELETE /api/invitations/:id` (revoke), **Then** the invite's `status` becomes `revoked` (only if it belongs to the caller's household and they are admin); 404 if not found in their household; 403 if not admin. Revoking a non-pending invite is a no-op/idempotent.

6. **Given** RLS, **When** any authenticated user queries `household_invitations` via their own client, **Then** they can SELECT **only** invitations of households where they are an **admin** (via `is_household_admin`); non-admin members and outsiders get `[]`. There are **no** anon INSERT/UPDATE/DELETE policies — all writes go through the service-role-backed API (consistent with the 13-1 review outcome). Verified by a real-DB RLS test (NFR10/NFR11).

7. **Token security (NFR12):** token is a cryptographic UUID, **email-bound** (the `email` column; 13-3's accept will require the authenticated user's email to match), **48h expiry** (`expires_at`), **single-use** (13-3 flips `status` to `accepted` on use). This story must not leak tokens to non-admins (covered by AC#6 RLS).

8. **Notification — honest MVP scope:** the app has **no email/SMTP infrastructure** (only Web Push). So delivery is: the create response returns the **shareable accept link**, and the admin's Household UI shows pending invites with a **Copy link** action. Sending the invite by email is **deferred** (documented; needs an email provider). In-app surfacing of an invite to the *invited* user is **Story 13-3** (the invitee-facing accept). Do not fabricate an email-sent state.

9. **Given** the admin Household UI, **When** an admin with a household opens Settings, **Then** they see an "Invite a member" email input (+ Send) and a list of pending invites (email, expiry, Copy-link, Revoke). Non-admins/non-members see no invite controls. en + bg i18n.

10. **No regression.** Reuse 13-1 patterns; no schema changes to `households`/`household_members`. Existing solo + 13-1 features unaffected.

## Tasks / Subtasks

- [x] **Task 1 — Migration `021_household_invitations.sql`** (AC: #1, #3, #6, #7)
  - [x] `CREATE TYPE invitation_status AS ENUM ('pending','accepted','revoked')` (idempotent `DO $$ … duplicate_object` guard, per 020).
  - [x] `CREATE TABLE household_invitations` per AC#1. Use lower-cased `email TEXT` (normalize in service) — avoid the `citext` extension unless already enabled. `token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()`. `expires_at TIMESTAMPTZ NOT NULL`.
  - [x] Partial unique index: `CREATE UNIQUE INDEX idx_invitations_active ON household_invitations (household_id, email) WHERE status = 'pending';` + `idx_invitations_household`, `idx_invitations_email`.
  - [x] RLS: `ENABLE ROW LEVEL SECURITY`; **SELECT** policy `USING (public.is_household_admin(household_id, auth.uid()))`. **No** INSERT/UPDATE/DELETE policies (service-role writes only). `DROP POLICY IF EXISTS` guards for re-runnability.
  - [x] Header comment matching project style (`-- Migration 021: Household invitations (Story 13.2) -- Date: {date}`).

- [x] **Task 2 — Types** (AC: #2, #4) — extend `src/types/database.types.ts`: `InvitationStatus` union; `household_invitations` Row/Insert/Update/Relationships; Enums entry `invitation_status`; domain types `HouseholdInvitation`, `HouseholdInvitationInsert`, and a view type `HouseholdInvitationWithState = HouseholdInvitation & { isExpired: boolean; acceptLink?: string }`.

- [x] **Task 3 — `src/lib/services/invitationService.ts`** (AC: #2–#5) — service-role writes, auth-scoped reads (mirror `householdService`):
  - [x] `InvitationError` typed errors (or reuse a small set): `NotHouseholdAdminError` (→403), `InvitationExistsError` (→409).
  - [x] `createInvitation(userId, email)` → resolve caller's household + assert admin (reuse `getCurrentHousehold` or a direct `is_household_admin`-equivalent query via service-role); validate+normalize email; dedupe (rely on partial unique index, catch Postgres `23505` → `InvitationExistsError`, also pre-check for a friendly path); insert `{household_id, email, invited_by:userId, expires_at: now+48h}` (token+status default); return `HouseholdInvitation`.
  - [x] `listInvitations(userId)` → admin's household invites (service-role or auth client), map `isExpired`.
  - [x] `revokeInvitation(userId, invitationId)` → verify the invite's household is the caller's AND caller is admin; set `status='revoked'` where `status='pending'`; throw NotFound/NotAdmin appropriately.

- [x] **Task 4 — API routes** (AC: #2–#5) — `src/app/api/invitations/route.ts` (POST + GET) and `src/app/api/invitations/[id]/route.ts` (DELETE). Auth → 401; map `NotHouseholdAdminError`→403, `InvitationExistsError`→409, Zod email invalid→400. Follow 13-1 route shape (`createClient` auth, `logger.error`, `NextResponse.json({data}/{error})`). The accept link is built in the route from the request origin (or `NEXT_PUBLIC_SITE_URL`) so the service stays env-agnostic.

- [x] **Task 5 — RLS test `invitations.rls.test.ts`** (AC: #6) — `@jest-environment node` in the FIRST docblock; reuse `rlsClient` harness. Seed household A (admin a1, member a2), household B (admin b1) + an invitation in A (service-role). Assert: a1 (admin) reads A's invitations; a2 (non-admin member) gets `[]`; b1 (outsider) gets `[]`; a2/b1 anon INSERT into A's invitations is denied (no INSERT policy).

- [x] **Task 6 — Mocked tests** (AC: #2–#5) — `invitationService.test.ts` (create success, 403 non-admin, 409 duplicate via 23505, email validation; list; revoke) + `api/invitations` route tests (POST 201/400/401/403/409, GET 200/403, DELETE 200/403/404). Mock `@/lib/supabase/server` (both clients) + the service for route tests.

- [x] **Task 7 — UI** (AC: #8, #9) — extend `HouseholdSection` (or add `HouseholdInvites` sub-component) shown only when `household.role === 'admin'`: email input + Send, pending-invite list with expiry, **Copy link** (`${origin}/join?token=…`) and **Revoke**. New `useInvitations` SWR hook. en/bg i18n under an `invitations` namespace (key-parity test must pass). Coaching/neutral microcopy.

- [x] **Task 8 — Verify** — `tsc --noEmit`, `npm run lint` (0 warnings), `npm test` green (RLS suites skip without Docker), en/bg parity test passes.

## Dev Notes

### Reuse from Story 13-1 (do NOT reinvent) — see `13-1-household-creation-database-foundation.md`
- **`is_household_admin(household_id, auth.uid())`** SECURITY DEFINER helper already exists (migration 020) — use it directly in the invitations SELECT policy. Recursion-safe.
- **All writes via service-role; SELECT-only RLS.** 13-1's review (HIGH-1) removed anon write policies after a self-join breach. Apply the same: invitations get a SELECT policy only; INSERT/UPDATE/DELETE happen in `invitationService` via `createServiceRoleClient()`.
- **Service shape:** `householdService.ts` (service-role writes, typed errors mapped to HTTP in the route, `getCurrentHousehold` to resolve the caller's household+role).
- **RLS test harness:** `src/lib/test-utils/rlsClient.ts` + `households.rls.test.ts`. **CRITICAL:** `@jest-environment node` MUST be in the **first** docblock (Jest only reads the pragma there) so Node's global `fetch` is available — jsdom lacks it. `npm run test:rls` uses a positional path pattern.
- **Mocked-test pattern:** chainable Supabase mock; for service tests `jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceRoleClient: jest.fn() }))`; for route tests `@jest-environment node` (first docblock) + mock `next/server` + mock the service module (real-shaped error classes for `instanceof`).
- **ESLint currency guard** covers `src/lib/services/**` and `src/app/api/cron/**` — N/A to content here, but never embed currency literals.

### Invitation specifics (ADR-016 / NFR12)
- Token = `gen_random_uuid()` DB default (cryptographic, unguessable). Single-use + email-bound + 48h expiry. The **accept** (single-use flip, email match, expiry check) is Story 13-3 — this story only issues + lists + revokes.
- **Dedupe** is enforced at the DB by a partial unique index on `(household_id, email) WHERE status='pending'` — the authoritative guard. The service should still pre-check for a friendly 409 and must catch `23505` as the race-safe backstop.
- **Email normalization:** trim + lower-case before insert and before dedupe checks (so `A@x.com` == `a@x.com`).
- **Expiry:** store `expires_at = now() + interval '48 hours'`; compute `isExpired` at read time (don't rely on a cron to flip status in this story).

### Notification reality (AC#8)
- No SMTP/email provider in the codebase (confirmed: only Web Push `pushService.sendPushToUser`). Do **not** add an email dependency in this story. Deliver the invite as a **copyable accept link**; document email delivery as deferred. Optional (only if trivial) best-effort: nothing — keep scope tight.

### Project Structure Notes
```
supabase/migrations/021_household_invitations.sql      ← CREATE
src/types/database.types.ts                            ← MODIFY (invitation types + enum)
src/lib/services/invitationService.ts                  ← CREATE
src/lib/services/__tests__/invitationService.test.ts   ← CREATE (mocked)
src/app/api/invitations/route.ts                       ← CREATE (POST + GET)
src/app/api/invitations/[id]/route.ts                  ← CREATE (DELETE/revoke)
src/app/api/invitations/__tests__/route.test.ts        ← CREATE (mocked)
src/lib/hooks/useInvitations.ts                        ← CREATE (SWR)
src/components/household/HouseholdInvites.tsx          ← CREATE (admin-only invite UI)
src/components/household/HouseholdSection.tsx          ← MODIFY (render invites for admins)
src/lib/test-utils/__tests__/invitations.rls.test.ts   ← CREATE (real-DB, node env, gated)
messages/en.json, messages/bg.json                     ← MODIFY (invitations namespace)
```
No changes to `households`/`household_members` schema. `/join` page + accept logic are **Story 13-3**.

### Testing Requirements
- **RLS integration (real DB, node env, gated):** the security heart (AC#6). Assert what the DB returns to each authed user (admin reads; non-admin/outsider `[]`; anon insert denied). Reuse the 13-1 seeding approach (service-role seeds; cascade-cleanup by deleting test users).
- **Mocked unit/integration:** service + routes (201/400/401/403/404/409 paths; dedupe via 23505).
- **Regression:** `npm test` green with RLS suites skipped; en/bg parity passes.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.2] — ACs (email invite, single-use 48h email-bound token, duplicate prevention)
- [Source: _bmad-output/planning-artifacts/prd.md#FR18] — invite by email; #FR19 join flow (13-3); #NFR12 invitation tokens single-use/48h/email-bound
- [Source: _bmad-output/planning-artifacts/architecture.md ADR-016] — `household_invitations`: crypto UUID token, email-bound, 48h, single-use; validation checks
- [Source: _bmad-output/planning-artifacts/architecture.md ADR-015] — dual-path RLS; `is_household_admin`
- [Source: supabase/migrations/020_households.sql] — household tables, `is_household_admin`/`is_household_member`, RLS + SECURITY DEFINER pattern to follow
- [Source: src/lib/services/householdService.ts] — service-role write + typed-error pattern
- [Source: src/app/api/households/route.ts] — route auth/validation/error-shape pattern
- [Source: src/lib/test-utils/__tests__/households.rls.test.ts] — RLS test shape (node env, seeding, isolation)
- [Source: docs/testing/rls-integration-test-strategy.md] — harness + node-env requirement + run/CI
- [Source: src/components/household/HouseholdSection.tsx] — where the admin invite UI hangs
- [Source: src/lib/services/pushService.ts] — the only notification channel (Web Push); confirms no email infra

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 8 tasks implemented. `tsc` clean, ESLint clean, **1387 tests pass + 15 skipped** (3 env-gated `*.rls.test.ts` suites; run only with Docker/Supabase-local). No regressions.
- **Migration 021**: `household_invitations` (+ `invitation_status` enum, crypto `token UUID DEFAULT gen_random_uuid()`, `expires_at`, `accepted_by/at` reserved for 13.3). Dedupe enforced by a **partial unique index** on `(household_id, email) WHERE status='pending'`. RLS is **SELECT-only**, restricted to admins via the existing `is_household_admin` SECURITY DEFINER helper; **no anon write policies** (writes are service-role only) — consistent with the 13-1 review outcome.
- **invitationService**: `requireAdminHouseholdId` gate (→403 `NotHouseholdAdminError`); `createInvitation` validates+normalizes email, pre-checks for an active invite and catches Postgres `23505` as the race-safe backstop (→409 `InvitationExistsError`), sets `expires_at = now + 48h`; `listInvitations` maps `isExpired`; `revokeInvitation` (idempotent for non-pending; →404 `InvitationNotFoundError`).
- **API**: `POST/GET /api/invitations` + `DELETE /api/invitations/[id]` (401/400/403/404/409). The shareable accept link (`/join?token=…`) is built in the route from the request origin (`NEXT_PUBLIC_SITE_URL` fallback).
- **UI**: admin-only `HouseholdInvites` inside `HouseholdSection` (email invite, pending list with expiry, **Copy link**, **Revoke**); `useInvitations` SWR hook; en/bg i18n (`invitations` namespace; `emailPlaceholder` added to the translations-parity allowlist as a language-agnostic email example).
- **Notification scope (honest):** no SMTP/email infra exists (only Web Push), so delivery is the copyable accept link — email sending is **deferred**. The invitee-facing accept/join is **Story 13.3**; this story does not flip token state.
- **RLS test** `invitations.rls.test.ts` (node env, gated): admin-reads / non-admin-member-blocked / outsider-blocked / anon-INSERT-denied.
- **Environment note:** `npm run test:rls` needs Docker (unavailable here) → RLS suites skip locally and run in the `rls` CI job.
- **Deferred (forward):** accept/join + single-use flip + email-match + expiry enforcement (13.3); member-removal revokes access (13.11).

### File List

- supabase/migrations/021_household_invitations.sql — CREATED
- src/types/database.types.ts — MODIFIED (InvitationStatus, household_invitations table, domain types, Enums entry)
- src/lib/services/invitationService.ts — CREATED (create/list/revoke + typed errors)
- src/lib/services/__tests__/invitationService.test.ts — CREATED (12 mocked tests)
- src/app/api/invitations/route.ts — CREATED (POST + GET)
- src/app/api/invitations/[id]/route.ts — CREATED (DELETE/revoke)
- src/app/api/invitations/__tests__/route.test.ts — CREATED (11 mocked tests)
- src/lib/hooks/useInvitations.ts — CREATED (SWR)
- src/components/household/HouseholdInvites.tsx — CREATED (admin invite UI)
- src/components/household/HouseholdSection.tsx — MODIFIED (render HouseholdInvites for admins)
- src/lib/test-utils/__tests__/invitations.rls.test.ts — CREATED (4 real-DB tests, node env, gated)
- src/i18n/__tests__/translations.test.ts — MODIFIED (allowlist emailPlaceholder)
- messages/en.json — MODIFIED (invitations namespace)
- messages/bg.json — MODIFIED (invitations namespace)

## Change Log

- 2026-06-04: Implemented Story 13.2 — household invitation flow (schema + admin-only RLS, service/API/UI, RLS tests). Status → review.
- 2026-06-04: Code review — 1 LOW patch applied, 3 deferred, 3 dismissed; no HIGH/MED. Status → done.

## Senior Developer Review (AI)

**Date:** 2026-06-04 · **Reviewer:** bmad-code-review (three-lens) on the uncommitted working tree vs baseline `09c6690` · **Outcome:** Approved after fix

The 13-1 security hardening carried over cleanly — invitations RLS is SELECT-only via `is_household_admin`, with **no anon write policies** (writes are service-role), so there is no self-join-style breach vector here. No HIGH/MED findings.

### Action Items

- [x] **[LOW] Dedupe index now uses `lower(email)`** (`021_household_invitations.sql`). AC#1 specified `lower(email)`; the column is service-normalized so it was functionally fine, but the expression index is strictly more robust against any future non-normalizing insert path. Fixed.
- [ ] **[LOW][Defer] `requireAdminHouseholdId` uses `.maybeSingle()`** — throws if a user is ever in >1 household (same latent issue as 13-1's `getCurrentHousehold`; gated by one-household-per-user). Revisit with multi-household.
- [ ] **[LOW][Defer] No guard against inviting an existing member / the admin's own email** — cleanest to validate at accept (Story 13.3).
- [ ] **[LOW][Defer] The `/join?token=…` copy-link target doesn't exist until Story 13.3** — expected by scope; 13.2 + 13.3 should ship together.
- [x] **[Dismissed] GET returns accept links for non-pending invites** (admin-only; single-use/dead tokens) — low risk.
- [x] **[Dismissed] POST 400-by-error-message regex / invite accumulation** — Zod covers the normal invalid-email path; cleanup is out of scope.

Post-fix: SQL-only change (no TS/test impact); tsc + ESLint clean; 1387 tests pass, 15 skipped (RLS).
