---
baseline_commit: 0dc36a40d366e4a96ece0f7562061790c5e650ca
---

# Story 13.3: Join Household via Invitation

Status: done

> Closes the invitation loop from 13-2. An **authenticated** invited user accepts a
> token and becomes a household **member**. All validation is **server-side** (ADR-016 /
> NFR12): token exists, is `pending`, not expired, and its email matches the caller's.
> Single-use (flip to `accepted`). **No migration** — 13-2's `household_invitations`
> already has `accepted_by` / `accepted_at`. Member removal is Story 13-11 (out of scope).

## Story

As an invited user,
I want to accept a household invitation by opening its link while logged in,
So that I join the shared household — with the system rejecting any expired, used, revoked, or mis-addressed invitation clearly.

## Acceptance Criteria

1. **Given** an authenticated user and a valid token, **When** they `POST /api/invitations/accept { token }`, **Then** the system (atomically, server-side): inserts `household_members { household_id, user_id: caller, role: 'member' }`, flips the invitation to `status='accepted'` with `accepted_by = caller` and `accepted_at = now()`, and returns the joined household.

2. **Given** validation, **When** accept is attempted, **Then** each failure returns a distinct, clear message:
   - token not found → **404** ("This invitation link is invalid.")
   - invitation `status != 'pending'` (already accepted/revoked) → **409** ("This invitation has already been used or was revoked.")
   - `expires_at < now()` → **410** ("This invitation has expired.")
   - invitation `email` ≠ the authenticated user's email (case-insensitive) → **403** ("This invitation was sent to a different email address.")
   - caller already belongs to a household → **409** ("You already belong to a household.")
   - unauthenticated → **401**.

3. **Given** the token is email-bound (NFR12), **When** a logged-in user whose email differs from the invitation accepts, **Then** it is rejected (403) — the token alone is not sufficient.

4. **Given** single-use (NFR12), **When** an already-accepted/revoked token is presented again, **Then** it is rejected (409); the flip to `accepted` is the single-use guard. (The 13-2 partial unique index only constrains `pending` rows, so accepting frees the `(household_id, email)` slot — acceptable.)

5. **Given** `GET /api/invitations/accept?token=` (read-only validate, authenticated), **Then** it returns `{ valid, reason?, householdName?, invitedEmail?, emailMatches }` so the join page can show context and a precise error **without** mutating. No token data is exposed beyond the household name + the invited email (to the authenticated invitee only).

6. **Given** the `/join?token=…` page (the link 13-2 generates), **When** an unauthenticated user opens it, **Then** they are sent to login and returned to `/join?token=…` afterward; **When** authenticated, the page validates the token and shows the household name with an **Accept** button, or a clear error state (invalid/expired/used/mismatch/already-in-household). On success it routes to the dashboard/Settings with a success toast; with no/blank token it shows an error.

7. **Given** a successful join, **When** the membership is created, **Then** a **best-effort Web Push** notifies the inviting admin (`invited_by`) that the member joined (via `pushService.sendPushToUser`). It is non-blocking — push failure (or no subscription) must not fail the join. No email is sent (no SMTP infra).

8. **Security:** all token validation and writes happen **server-side via the service-role client** (the invitee has no RLS read on `household_invitations`). No new anon RLS policies. Reuse 13-1's membership model.

9. **No regression.** Existing solo + 13-1/13-2 features unaffected; no schema change.

## Tasks / Subtasks

- [x] **Task 1 — `invitationService` accept/validate** (AC: #1–#5, #7, #8) — extend `src/lib/services/invitationService.ts`:
  - [x] Typed errors: `InvalidTokenError` (→404), `InvitationNotPendingError` (→409), `InvitationExpiredError` (→410), `EmailMismatchError` (→403), and reuse a one-household guard error (→409; reuse `HouseholdExistsError` from `householdService` or a local `AlreadyInHouseholdError`).
  - [x] `validateInvitation(userId, userEmail, token)` → fetch by token (service-role); compute `{ valid, reason, householdName, invitedEmail, emailMatches }`. Read-only.
  - [x] `acceptInvitation(userId, userEmail, token)`:
    - fetch invitation by token (service-role); throw `InvalidTokenError` if none.
    - throw `InvitationNotPendingError` if `status !== 'pending'`; `InvitationExpiredError` if expired; `EmailMismatchError` if `invitation.email !== userEmail.trim().toLowerCase()`.
    - check the caller isn't already a member of any household (reuse the `household_members` lookup pattern from `householdService`/`invitationService`) → throw the one-household error.
    - insert membership `{ household_id, user_id: userId, role: 'member' }`; on success update the invitation `{ status: 'accepted', accepted_by: userId, accepted_at: now }`. If the membership insert fails with unique-violation `23505` (already a member of THIS household) → treat as the one-household error. Order so a failure can't leave the invite accepted without a membership.
    - best-effort notify: `sendPushToUser(serviceRoleClient, invitation.invited_by, payload)` wrapped in try/catch (never throw). Skip if `invited_by` is null.
    - return the joined household (`Household`).

- [x] **Task 2 — Push payload for household events** (AC: #7) — confirm the `PushPayload` `type` union (used by `pushService` + `worker/index.ts`) accepts a household value; if not, add `'household_event'` (or reuse an existing acceptable type) to the union and the service-worker handler's switch so the notification routes/links sensibly (deep link to `/settings`). Keep changes minimal and consistent with the 12-3 push infra.

- [x] **Task 3 — API route** (AC: #1, #2, #5) — `src/app/api/invitations/accept/route.ts`: `POST` (auth → Zod `{ token: uuid }` → `acceptInvitation(user.id, user.email, token)` → 200 `{ data: household }`; map typed errors to 404/409/410/403; 401 unauth; 400 invalid token shape) and `GET` (auth → read `token` from query → `validateInvitation` → 200 `{ data: {...} }`; 401). Follow the 13-2 route error-shape pattern. `user.email` comes from `supabase.auth.getUser()`.

- [x] **Task 4 — `/join` page** (AC: #6) — `src/app/join/page.tsx` (client; wrap `useSearchParams` in `<Suspense>` like `transactions/page.tsx`):
  - [x] If unauthenticated → redirect to the existing login route with a return path back to `/join?token=…` (reuse the app's auth-redirect pattern; check `src/app/page.tsx` / middleware for how auth is gated).
  - [x] Read `token`; call `GET /api/invitations/accept?token=` to render: household name + **Accept** (calls `POST`), or a precise error card (invalid/expired/used/mismatch/already-in-household), or "missing token".
  - [x] On accept success → toast + route to `/settings` (where the household now shows) or `/dashboard`. On error → inline message. Loading skeletons; no full-page spinner.
  - [x] i18n `join` namespace (en/bg); coaching/clear microcopy.

- [x] **Task 5 — `useAcceptInvitation` / hook or inline fetch** (AC: #6) — a small client helper/hook for validate+accept, or inline `fetch` in the page (keep it simple; no SWR cache needed for a one-shot action). Revalidate `useHousehold` (`mutate('/api/households')`) after success so Settings reflects membership.

- [x] **Task 6 — Mocked tests** (AC: #1–#5, #7) — `invitationService` accept/validate tests (success; 404 unknown; 409 not-pending; 410 expired; 403 email-mismatch; 409 already-in-household; push failure does not throw) + `api/invitations/accept` route tests (POST 200/400/401/403/404/409/410; GET 200/401). Mock `@/lib/supabase/server` (both clients) + `pushService.sendPushToUser`. Route tests: `@jest-environment node` (FIRST docblock) + mock `next/server` + mock the service with real-shaped error classes.

- [x] **Task 7 — RLS test (extend)** (AC: #8) — add to `invitations.rls.test.ts` (or a new gated suite) a check that, after a service-role accept, the **new member can read the household** (13-1 SELECT RLS) and still **cannot read invitations** (non-admin). Keep node-env + gated. (Most accept logic is service-role, so coverage is mostly the mocked tests; this guards the end-to-end isolation outcome.)

- [x] **Task 8 — Verify** — `tsc --noEmit`, `npm run lint` (0 warnings), `npm test` green (RLS gated/skipped), en/bg parity passes.

## Dev Notes

### Reuse from 13-1 / 13-2 (do NOT reinvent)
- **No migration.** `household_invitations.accepted_by` / `accepted_at` already exist (migration 021). `household_members` + `is_household_member`/`is_household_admin` from migration 020.
- **invitationService patterns** (`src/lib/services/invitationService.ts`): service-role client, typed errors mapped to HTTP in the route, `requireAdminHouseholdId`'s `household_members` lookup style. The one-household-per-user check mirrors `householdService.createHousehold`.
- **Route pattern** (`src/app/api/invitations/route.ts`): `createClient` auth → 401; Zod validation; `logger.error`; `NextResponse.json({data}/{error})`. **`user.email`** is available on the `auth.getUser()` user object — use it for the email-bound check (don't trust a client-sent email).
- **Push** (`src/lib/services/pushService.ts`): `sendPushToUser(supabaseClient, userId, payload)`; VAPID-gated (no-op if unconfigured). Best-effort only.
- **RLS test harness + node-env rule**: `@jest-environment node` MUST be in the first docblock; `npm run test:rls` positional pattern; Docker-gated (skips locally).
- **Suspense for `useSearchParams`**: `src/app/transactions/page.tsx` wraps the content in `<Suspense>` — follow that to avoid the Next.js CSR-bailout error on `/join`.
- **ESLint currency guard** covers `src/lib/services/**` — no currency literals (N/A here).

### Security / correctness focus (where reviews will look)
- **Email binding is server-side only:** compare `invitation.email` to `auth.getUser().user.email` (lower-cased), never a client-supplied email. This is the NFR12 guarantee.
- **Token is the bearer secret but not sufficient alone:** even with a valid token, a different-email user is rejected (403). Validate before mutate.
- **Atomicity:** insert membership first, then flip the invite to `accepted`. If membership insert fails, do NOT mark accepted (so the invite stays usable). If the flip fails after membership insert, the worst case is a usable-looking invite whose slot is taken — acceptable; log it. (A Postgres function could make it fully atomic; service-role two-step is acceptable for MVP — document the choice.)
- **Single-use:** the `status='accepted'` flip is the guard; re-accept → 409. Don't rely on the partial unique index (it only covers `pending`).
- **One-household-per-user** is enforced here too (same MVP rule as 13-1); a user in a household cannot accept another invite (409).

### Notification reality (AC#7)
- Best-effort Web Push to `invited_by` only; **no email** (no SMTP). Wrap in try/catch; null `invited_by` → skip. Don't block or fail the join on push errors.

### Project Structure Notes
```
src/lib/services/invitationService.ts          ← MODIFY (acceptInvitation, validateInvitation, errors)
src/lib/services/__tests__/invitationService.test.ts ← MODIFY (accept/validate tests)
src/app/api/invitations/accept/route.ts        ← CREATE (POST accept + GET validate)
src/app/api/invitations/accept/__tests__/route.test.ts ← CREATE (mocked)
src/app/join/page.tsx                          ← CREATE (auth-gated accept page; Suspense)
src/lib/test-utils/__tests__/invitations.rls.test.ts ← MODIFY (post-accept member-can-read-household)
src/types/database.types.ts                    ← MODIFY only if extending PushPayload type union
worker/index.ts                                ← MODIFY only if adding a household push type/handler
messages/en.json, messages/bg.json             ← MODIFY (join namespace)
```
No DB migration. No changes to `households`/`household_members`/`household_invitations` schema.

### Testing Requirements
- **Mocked unit/integration** carry the weight here (accept is service-role logic): every rejection branch (404/409/410/403/401) + success + push-failure-is-non-fatal.
- **RLS (gated, node env):** extend to confirm the post-accept end state — new member reads the household, still can't read invitations.
- **Regression:** `npm test` green with RLS skipped; en/bg parity passes (add any identical-by-nature keys to the allowlist).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.3] — accept → member; reject expired/used; notify admin
- [Source: _bmad-output/planning-artifacts/prd.md#FR19] — join via verified invitation; #NFR12 single-use/48h/email-bound
- [Source: _bmad-output/planning-artifacts/architecture.md ADR-016] — token validation checks (exists, not expired, not used, email matches)
- [Source: supabase/migrations/021_household_invitations.sql] — invitation columns incl. accepted_by/accepted_at, status enum
- [Source: src/lib/services/invitationService.ts] — service patterns + typed errors to extend
- [Source: src/lib/services/householdService.ts] — one-household-per-user check + membership insert pattern
- [Source: src/app/api/invitations/route.ts] — route auth/validation/error-shape; user.email usage
- [Source: src/lib/services/pushService.ts] — sendPushToUser(client, userId, payload), VAPID-gated best-effort
- [Source: src/app/transactions/page.tsx] — Suspense wrapper for useSearchParams (apply to /join)
- [Source: src/lib/test-utils/__tests__/invitations.rls.test.ts] — RLS suite to extend (node env, gated)
- [Source: docs/testing/rls-integration-test-strategy.md] — node-env requirement + Docker-gated run

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All 8 tasks implemented. `tsc` clean, ESLint clean, **1410 tests pass + 16 skipped** (3 env-gated RLS suites). No regressions. **No migration** (13-2 already added `accepted_by/accepted_at`).
- **invitationService** extended: `validateInvitation` (read-only, reports precise reason) + `acceptInvitation` (server-side checks → membership insert → flip invite to `accepted` → best-effort push). Typed errors: `InvalidTokenError`(404), `InvitationNotPendingError`(409), `InvitationExpiredError`(410), `EmailMismatchError`(403), `AlreadyInHouseholdError`(409). Email-bound check uses the **authenticated** user's email, never a client value (NFR12). Membership-insert-before-flip ordering so a failure can't leave an accepted-but-memberless invite; `23505` on membership → AlreadyInHousehold.
- **API** `/api/invitations/accept`: POST (200 + household; 400/401/403/404/409/410) and GET validate (200 `{valid,reason,householdName,invitedEmail,emailMatches}`; 401). Token validated as a UUID (Zod).
- **`/join` page**: auth-gated (redirects to `/login?redirect=/join?token=…` and returns), Suspense-wrapped `useSearchParams`, validates then Accept, clear per-reason error states; on success revalidates `/api/households` and routes to `/settings`. `join` i18n (en/bg).
- **Login redirect**: `getSafeRedirectTarget()` now honors a safe internal `redirect` param on email/password login (open-redirect-guarded: must start with single `/`). This also fixes the pre-existing dead `redirect` param the middleware sets. OAuth round-trip return is not wired (edge case; documented).
- **Notification**: best-effort Web Push to `invited_by` (`type:'household_event'`, already in the PushPayload union) — wrapped in try/catch, never fails the join; no email (no SMTP infra).
- **Single-use**: enforced by the `status='accepted'` flip (re-accept → 409), not the partial unique index.
- **RLS test**: extended `invitations.rls.test.ts` with the post-accept end-state (joined member reads the household, still can't read invitations).
- **Env note:** RLS suites need Docker → skip locally, run in the `rls` CI job.
- **Deferred (forward):** OAuth-login return-to-/join; member removal/access revocation (13.11).

### File List

- src/lib/services/invitationService.ts — MODIFIED (validateInvitation, acceptInvitation, 5 new error classes, isUserInHousehold, push import)
- src/lib/services/__tests__/invitationService.test.ts — MODIFIED (accept/validate tests; pushService mock)
- src/app/api/invitations/accept/route.ts — CREATED (POST accept + GET validate)
- src/app/api/invitations/accept/__tests__/route.test.ts — CREATED (mocked)
- src/app/join/page.tsx — CREATED (auth-gated accept page; Suspense)
- src/app/(auth)/login/page.tsx — MODIFIED (honor safe `redirect` param on login success)
- src/lib/test-utils/__tests__/invitations.rls.test.ts — MODIFIED (post-accept end-state test)
- messages/en.json — MODIFIED (join namespace)
- messages/bg.json — MODIFIED (join namespace)

## Change Log

- 2026-06-04: Implemented Story 13.3 — join household via invitation (accept/validate service + API, /join page, login redirect honoring). Status → review.
- 2026-06-04: Code review — 1 LOW patch (join page crash-guard), 2 deferred, 3 dismissed; no HIGH/MED. Status → done.

## Senior Developer Review (AI)

**Date:** 2026-06-04 · **Reviewer:** bmad-code-review (three-lens) on the uncommitted working tree vs baseline `0dc36a4` · **Outcome:** Approved after fix

Security model is sound: token validation + email-binding are server-side using the **authenticated** user's email (NFR12), single-use is enforced by the `accepted` flip, all writes are service-role, and no new anon RLS policies were added.

### Action Items

- [x] **[LOW] `/join` could crash on an error-shaped validate response** (`join/page.tsx`). `setValidation(json.data)` set `undefined` when the GET returned `{error}` (500 / session expiry), then `validation.valid` threw. Fixed with a `?? { valid:false, reason:'invalid' }` fallback.
- [ ] **[LOW][Defer] `isUserInHousehold` uses `.maybeSingle()`** — throws if a user is ever in >1 household (carried from 13-1/13-2; gated by one-household-per-user).
- [ ] **[LOW][Defer] OAuth-login does not return to `/join`** — only email/password login honors the `redirect` param; OAuth round-trips to `/auth/callback`→dashboard. Edge case; wire if needed.
- [x] **[Dismissed] `validateInvitation` returns `invitedEmail`** — it's the recipient's own address and the UI doesn't display it; common accept-page pattern, low risk.
- [x] **[Dismissed] token brute-force / redirect backslash edge** — UUIDv4 tokens are infeasible to guess; `router.push` treats the guarded redirect as an internal path.

Post-fix: tsc + ESLint clean; 1410 tests pass, 16 skipped (RLS).
