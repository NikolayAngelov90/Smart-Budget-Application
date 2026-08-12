---
baseline_commit: 830563c
---

# Story 13.11: Member Removal & Access Revocation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a household admin,
I want to remove a member from the household with immediate access revocation,
so that former members cannot access shared financial data.

## Acceptance Criteria

1. **Given** a household admin, **When** they remove a member, **Then** that member's **access to shared household data is immediately revoked** — they can no longer read the household, other members' shared categories/transactions, or any membership-gated aggregate (totals, contributions, goal breakdowns, insights, period totals).
2. **And** the removed member's **personal data is preserved for solo use** — their personal categories, their personal allowance, and their own transactions remain intact and accessible to them.
3. **And** **shared transactions attributed to the removed member remain in household history** — remaining members still see them (the rows keep `household_id` and their `user_id` attribution; nothing is deleted or re-owned).
4. **And** the **removed member is notified** (best-effort push).
5. **Given** the admin UI, **When** an admin views the household, **Then** they see the member list and can remove any member **except themselves**; a non-admin cannot remove anyone.

## Tasks / Subtasks

- [x] Task 1: Migration 029 — member list RPC (AC: #5)
  - [x] `household_members_list(p_household_id UUID)` SECURITY DEFINER, membership-gated (`IF NOT is_household_member(...) THEN RETURN`). Returns `{ user_id, email, role, joined_at }` for the household (joins `auth.users` for email — members already invited each other by email). Sums/identity only, membership-gated.
  - [x] COMMENT documenting it. **No schema change to remove a member is needed** — removal is a DELETE of the `household_members` row; RLS does the rest.
- [x] Task 2: Types (AC: #5)
  - [x] `database.types.ts`: add `household_members_list` to `Functions`; add domain type `HouseholdMemberListEntry { user_id; email; role: HouseholdRole; joined_at }`.
- [x] Task 3: `householdMemberService.ts` (AC: #1, #2, #3, #4, #5)
  - [x] `listHouseholdMembers(userId)` — resolve the caller's household (auth-scoped); call `household_members_list` (auth-scoped, membership-gated); return `HouseholdMemberListEntry[]`. No household → `[]`.
  - [x] `removeMember(adminUserId, targetUserId)` — **service-role**: resolve the admin's household + assert `role === 'admin'` (reuse the `requireAdminHouseholdId` pattern from invitationService → `NotHouseholdAdminError`); reject removing **self** (`targetUserId === adminUserId` → `CannotRemoveSelfError`); verify the target is a member of that household (else `MemberNotFoundError`); **DELETE the `household_members` row** for `(household_id, target)`. That alone revokes all shared access (the ex-member fails every `is_household_member` branch). **Do NOT touch** the target's categories/transactions/goals/allowance — preserving personal data (AC#2) and household history/attribution (AC#3). Best-effort push to the removed member ("You've been removed from {household}"), like the join notification.
  - [x] Typed errors → HTTP: `NotHouseholdAdminError` 403, `CannotRemoveSelfError` 400, `MemberNotFoundError` 404.
- [x] Task 4: API (AC: #1, #5)
  - [x] `GET /api/households/members` → `listHouseholdMembers`; 401; `{ data: HouseholdMemberListEntry[] }`. `dynamic = 'force-dynamic'`.
  - [x] `DELETE /api/households/members/[userId]` → `removeMember(caller, userId)`; 200 `{ data: { success: true } }`; 400/403/404 per the typed errors; 401.
- [x] Task 5: UI + i18n (AC: #5)
  - [x] `useHouseholdMembers` hook → `GET /api/households/members`.
  - [x] `HouseholdMembers` component in `HouseholdSection` (rendered when the user has a household): list members (email; "You" + Admin/Member badge for self/role). For an **admin**, show a "Remove" control on every member **except themselves**, behind a confirm (Chakra `useDisclosure` + `AlertDialog`, matching existing confirm patterns). On success → DELETE then revalidate the member list + `globalMutate('/api/households')` is not needed (admin stays). Toast feedback.
  - [x] `messages/en.json` + `bg.json`: extend `household` namespace (membersHeading, remove, removeConfirmTitle, removeConfirmBody, removeCta, removed, removeFailed, cannotRemoveSelf). Reuse existing `roleAdmin`/`roleMember`. en/bg parity (translations.test.ts).
- [x] Task 6: RLS integration test `member-removal.rls.test.ts` (AC: #1, #2, #3)
  - [x] Seed household (A admin, B member) + A's shared category with a shared transaction + B's personal category. Confirm B sees the shared data while a member.
  - [x] Delete B's `household_members` row (simulating removeMember via service client). Then, signed in as B: B can NO LONGER read the household, A's shared category, A's shared transaction, or any membership-gated RPC (`household_category_totals`, `household_contributions`, `household_category_period_totals`) — all empty/blocked.
  - [x] B's **own personal category** is still readable by B (personal data preserved, AC#2).
  - [x] A (still admin) still sees the shared category + transaction (history preserved, AC#3).
- [x] Task 7: Mocked tests (AC: #4, #5)
  - [x] `householdMemberService.test.ts`: `removeMember` — non-admin → 403 error type; remove-self → 400 error type; target-not-member → 404 error type; success deletes the row + best-effort push (mock `sendPushToUser`). `listHouseholdMembers` returns the RPC rows / `[]` with no household.
  - [x] route tests: GET members (200/401); DELETE member (200/400/403/404/401).
- [x] Task 8: Verification
  - [x] `npx tsc --noEmit`, `npx eslint`, full `npx jest` green (RLS suites skip without Docker). Finalize Dev Agent Record + File List + Change Log; status → review.

## Dev Notes

### Architecture & data-model decisions

- **Removal = delete the `household_members` row. RLS does the revocation.** Every shared-data policy and every aggregate RPC gates on `is_household_member(household_id, auth.uid())`. The instant that row is gone, the ex-member fails all of them → no household, no other members' shared categories/transactions, no totals/contributions/goal-breakdowns/insights. This is "immediate access revocation" with zero extra code (AC#1). [Source: supabase/migrations/020_households.sql:53-64 (is_household_member); 023/025/027/028 (all membership-gated)]
- **Personal data preserved by NOT touching it (AC#2).** The ex-member's personal categories (`household_id NULL`), their `personal_allowances` row (owner-only RLS, `user_id`), and their own transactions stay exactly as they were — still readable by them via the `auth.uid() = user_id` owner branch. The removal only deletes the membership row. [Source: supabase/migrations/024_personal_allowances.sql (owner-only); 022 (personal categories)]
- **History + attribution preserved by NOT re-owning rows (AC#3).** The ex-member's shared categories/transactions/goals keep their `household_id` (so remaining members still see them — dual-path SELECT) and their `user_id` (attribution). We deliberately do NOT reassign or strip them. **Known, acceptable residual:** the ex-member can still read the specific *shared category rows they personally created* (owner branch) — but NOT other members' transactions in them (those rows are `user_id != ex-member` and the membership branch is now inert), and NOT any aggregate. So no cross-member financial data leaks; only their own historical entries remain visible to them, which is consistent with "personal data preserved". Document this in the review.
- **Writes are service-role (Epic-13 pattern).** `household_members` is SELECT-only under RLS; the delete goes through `createServiceRoleClient` with an explicit admin check as the authorization (same as `createInvitation`/`applyPreset`/goal create). [Source: src/lib/services/invitationService.ts:94-110 (requireAdminHouseholdId); src/lib/services/householdService.ts]
- **Notification (AC#4)** reuses `sendPushToUser(adminClient, targetUserId, {...})` best-effort, mirroring the join-notification in `acceptInvitation`. Never fail the removal on a push error. [Source: src/lib/services/invitationService.ts:323-335]
- **Member list needs emails** → a membership-gated SECURITY DEFINER RPC (`household_members_list`) that joins `auth.users`, mirroring `household_contributions`/`household_goal_breakdown`. The existing `household_members` SELECT RLS lets members see co-member rows but not their emails (no auth.users access from the client). [Source: supabase/migrations/025_contribution_splits.sql (household_contributions returns email)]

### Files to touch

- NEW `supabase/migrations/029_member_list.sql`
- UPDATE `src/types/database.types.ts` (household_members_list fn + HouseholdMemberListEntry)
- NEW `src/lib/services/householdMemberService.ts`
- NEW `src/app/api/households/members/route.ts` (GET)
- NEW `src/app/api/households/members/[userId]/route.ts` (DELETE)
- NEW `src/lib/hooks/useHouseholdMembers.ts`
- NEW `src/components/household/HouseholdMembers.tsx`
- UPDATE `src/components/household/HouseholdSection.tsx` (render the member list)
- UPDATE `messages/en.json`, `messages/bg.json`
- NEW `src/lib/test-utils/__tests__/member-removal.rls.test.ts`
- NEW `src/lib/services/__tests__/householdMemberService.test.ts`
- NEW `src/app/api/households/members/__tests__/route.test.ts`

### Project Structure Notes

- Migration **029**. Apply 020→029 in order to the live DB. [Source: memory ops note]
- Writes service-role; reads auth-scoped (RLS exercised). `household_members` has no anon write policy by design (020) — the delete must be service-role.
- Reuse `NotHouseholdAdminError` from invitationService (don't redefine). New errors `CannotRemoveSelfError`, `MemberNotFoundError` live in the member service.
- RLS tests: `@jest-environment node` in the **first** docblock; `rlsDescribe`; Docker-gated.
- The member service's writes use the service-role client; the member-list read uses the auth-scoped client (RLS-exercised RPC).

### Testing standards summary

- Mocked service/route tests: chainable Supabase mock; `@jest-environment node`, mock `next/server` + `@/lib/supabase/server` (+ `sendPushToUser`) before imports.
- en/bg parity enforced by `translations.test.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 13.11 (lines 650-663)]
- [Source: supabase/migrations/020_households.sql] — household_members + is_household_member (the gate that revocation relies on)
- [Source: src/lib/services/invitationService.ts] — requireAdminHouseholdId + best-effort push patterns to reuse
- [Source: src/components/household/HouseholdSection.tsx] — where the member list mounts
- [Source: src/lib/hooks/useContributions.ts] — hook shape to mirror

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- All tasks implemented. **tsc 0, ESLint 0, full suite green: 1516 passed / 49 skipped** (10 env-gated RLS suites incl. member-removal). No regressions.
- **Revocation = a single DELETE of the `household_members` row.** No new revocation logic — the existing `is_household_member` gate on every shared-data policy + aggregate RPC does the work. The RLS test proves the removed member loses the household, other members' shared categories/transactions, and ALL aggregate RPCs the instant the row is gone.
- **Personal data + history preserved by NOT touching them:** the removal deletes only the membership row. The ex-member's personal categories, allowance, and own transactions stay (owner branch); their shared categories/transactions keep `household_id` + `user_id` so remaining members still see the history with attribution (RLS test confirms A still sees them).
- **Admin-gated, service-role write** (household_members is SELECT-only under RLS): `removeMember` asserts admin, rejects self-removal (`CannotRemoveSelfError`), verifies the target is in the same household (`MemberNotFoundError`), deletes, then best-effort pushes the removed member.
- **Member roster** via membership-gated SECURITY DEFINER `household_members_list` (joins auth.users for email); service marks `isSelf`. `HouseholdMembers` UI lists members with Admin/Member badges; admins get a confirm-gated Remove on every member but themselves.
- **Deploy:** migration 029 must be applied with 020–028.

### File List

- supabase/migrations/029_member_list.sql — CREATED
- src/types/database.types.ts — MODIFIED (household_members_list fn + HouseholdMemberListEntry)
- src/lib/services/householdMemberService.ts — CREATED (list + remove + notify; CannotRemoveSelfError, MemberNotFoundError)
- src/app/api/households/members/route.ts — CREATED (GET)
- src/app/api/households/members/[userId]/route.ts — CREATED (DELETE)
- src/lib/hooks/useHouseholdMembers.ts — CREATED
- src/components/household/HouseholdMembers.tsx — CREATED (roster + admin remove + confirm)
- src/components/household/HouseholdSection.tsx — MODIFIED (render HouseholdMembers)
- messages/en.json, messages/bg.json — MODIFIED (household member-management keys)
- src/lib/test-utils/__tests__/member-removal.rls.test.ts — CREATED (revocation proof)
- src/lib/services/__tests__/householdMemberService.test.ts — CREATED
- src/app/api/households/members/__tests__/route.test.ts — CREATED

## Change Log

- 2026-06-07: Implemented Story 13.11 — member removal & access revocation (migration 029 household_members_list RPC; householdMemberService.removeMember = service-role admin-gated DELETE of the membership row + best-effort notify; GET members / DELETE member routes; HouseholdMembers UI with confirm; RLS test proving instant revocation while personal data + shared history are preserved). Status → review.
- 2026-06-07: Code review (three-lens) — Approve. One MED applied (B1): deleting the membership row left the ex-member with owner-branch read/WRITE over the shared categories/goals THEY created → removeMember now also reassigns those to the admin (household_id kept; transactions keep their attribution). Service test asserts the reassignment; RLS test proves the member-created shared category is reassigned to the admin and invisible to the ex-member. Status → done.

## Senior Developer Review (AI)

Reviewer: claude-opus-4-8 · 2026-06-07 · Outcome: **Approve (1 MED fixed)**

- AC1–AC5 met. Core revocation = delete the `household_members` row; every shared-data policy + aggregate RPC gates on `is_household_member`, so access drops instantly (RLS test: ex-member loses the household, others' shared categories/transactions, and all aggregate RPCs).
- B1 (MED, FIXED): the categories UPDATE/DELETE policy (022) and goals writes (027) grant the **owner branch** (`auth.uid()=user_id`), so a removed member retained write/delete over shared categories/goals they created. `removeMember` now reassigns those to the admin (keeps `household_id`; transactions keep `user_id` attribution per AC#3). Proven by the service test (reassign update calls) and the RLS test (B's shared category ends up owned by A and invisible to B).
- Accepted LOWs: the ex-member can still read their **own** historical transactions (their data/attribution — not other members'); their `personal_allowances` row keeps a now-dangling `household_id` (private, harmless).

**Verification:** tsc 0, ESLint 0, full suite green (1516 pass / 49 skipped, 10 RLS suites). Migration 029 applies with 020–028.
