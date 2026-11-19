---
title: 'A household creator can delete their account without destroying members'' data'
type: 'feature'
created: '2026-11-19'
status: 'ready-for-dev'
review_loop_iteration: 0
context:
  - '{project-root}/docs/api-conventions.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When a household's creator deletes their account, `households.created_by ON DELETE CASCADE` deletes the household for every member. If a member's transaction uses a creator-owned category, `transactions.category_id ON DELETE RESTRICT` refuses the delete half-way: `deleteUserAccount` has already deleted the profile, and the account and all its data remain.

**Approach:** A service-role Postgres function makes every *preparatory* write in one transaction: transfer ownership, rewrite shared objects, and copy/repoint member-referenced categories. The service then calls `admin.deleteUser` LAST, so a refused delete has destroyed nothing. Shared-goal totals stay true through an `AFTER DELETE` trigger on `goal_contributions`, not a function step. It fires on every path that deletes a contribution row, which includes any member's account deletion, so that becomes a stated behaviour fix (see Design Notes).

## Boundaries & Constraints

**Always:** Two principles pull against each other, and every resolution names which one decides. **P1:** a member never loses their own data because someone else left. **P2:** a person who deletes their account leaves no personal data behind (FR38). Every write in the function must be valid whether or not the deletion follows. The function is `SECURITY DEFINER`, `SET search_path = public`, with `REVOKE ALL ... FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE ... TO service_role` (the 026 convention). No language is written into stored data. A failed prepare is a core-input failure, so it returns 500 and nothing is deleted (docs/api-conventions.md#Error-Handling).

**Ask First:** Applying to production: merged to main, Niki's explicit "yes" to a plain-words summary, a before/after read-only diff, and drift green. Also any change to an FK's `ON DELETE` action, and any behaviour outside the 26-row table.

**Never:** Production SQL outside the merged migration. Data-changing `execute_sql`. Attributing a kept invitation to the new owner. Deleting or rewriting a member's own rows except to repoint them at a category they keep.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Creator + members | creator C of household H; members joined at t1<t2 | earliest-joined N becomes `created_by` and `role='admin'`; H, its members and invitations survive; C's shared categories/budgets/goals move to N (P1); C's own rows go (P2) | — |
| Member used C's category | M's transaction/budget/value-mapping/wishlist item points at a C-owned category not transferred | M gets a copy (or M's existing same name+type category is reused); M's rows repointed; nothing uncategorised (P1) | value-mapping conflicts skipped (mapping already exists) |
| Name collision on transfer | N already owns C's shared category's name+type | the transferred one becomes `name n`, the lowest free n ≥ 2, base truncated to fit 100 chars | — |
| Sole-member creator | C is H's only member | H deleted, as today (P2) | — |
| C contributed to a shared goal | goal now owned by N | C's contribution rows go (P2); `current_amount = SUM(remaining)` | — |
| Plain member deletes their account | member P (not a creator) contributed to shared goal G | P's contributions go (P2); G survives; `current_amount` drops by exactly P's contributions. Today it stays overstated: a FIX outside the creator path | — |
| C's personal goal with others' contributions | goal un-shared after contributions | lost with the goal: accepted, not fixed; members' savings transactions survive | — |
| Auth delete refused | `admin.deleteUser` errors | 500; profile and all data intact; prepared writes stand (valid by design) | error surfaced |
| Prepare fails | RPC errors | 500; `deleteUser` never called | error surfaced |
| No household | C in none | prepare is a no-op; deletion as today | — |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261119100000_prepare_account_deletion.sql` -- NEW: `public.prepare_account_deletion(p_user uuid) returns jsonb` plus the `goal_contributions` AFTER DELETE trigger. Conventions: `026_invitation_notifications.sql` (service-role grants), `038_security_hardening.sql` (pinned search_path).
- `src/lib/services/settingsService.ts:312` `deleteUserAccount` -- today deletes `user_profiles` FIRST (L317), then `admin.deleteUser`. New order: `rpc('prepare_account_deletion')` via the service-role client, then `admin.deleteUser`. Remove the profile delete only once the RLS test proves the `auth.users` cascade removes it.
- `src/app/api/user/account/route.ts:127` -- the only caller; contract unchanged.
- `src/lib/services/householdGoalService.ts:206-219` -- shared-goal definition `current_amount = SUM(contributions)`. Goals are shared only at creation (no code sets `goals.household_id` later).
- `src/lib/test-utils/rlsClient.ts` -- `createTestUser`, `seedSingle`, `deleteTestUser` (asserts its result), `createServiceClient`. `pg` 8.23 and `LOCAL_DB_URL` are available in the RLS job (`.github/actions/local-supabase/action.yml:177`).
- `src/lib/test-utils/__tests__/households.rls.test.ts` -- model for seeding a household.
- Catalog facts: `categories UNIQUE(user_id,name,type)`, `name VARCHAR(100)`; `value_categories UNIQUE(value_id,category_id)`; personal-budget unique index `WHERE household_id IS NULL` (shared budgets unconstrained); owner powers come from `household_members.role='admin'` (`created_by` is only indexed).

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261119100000_prepare_account_deletion.sql` -- function and trigger per Design Notes -- the only place all preparatory writes can share one transaction
- [ ] `src/lib/services/settingsService.ts` -- prepare RPC, then `admin.deleteUser`; profile delete removed once verified -- destructive step last
- [ ] `src/lib/services/__tests__/settingsService.test.ts` -- order and failure cases (prepare fails: no deleteUser; deleteUser fails: error surfaced, no profile delete)
- [ ] `src/lib/test-utils/__tests__/account-deletion.rls.test.ts` -- NEW: the five scenarios below
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` -- add the residual holes to the accumulator item

**Acceptance Criteria:**
- Given C and member M where M tagged a transaction with C's category, when C deletes, then M owns H (`created_by`, role admin), M's transaction points to M's copy, and C is fully gone.
- Given `admin.deleteUser` is made to fail, when C deletes, then the profile and all of C's data are intact.
- Given C is H's sole member, when C deletes, then H is deleted.
- Given any deletion above, then every rewritten row belongs to N, and **no row in any FK column referencing `auth.users`, enumerated from `pg_constraint` at test time**, holds C's id. The enumeration must find `user_profiles.id`, or the test fails as NOT MEASURED.
- Given C contributed to a shared goal, when C deletes, then `goals.current_amount = SUM(goal_contributions.amount)` for that goal.
- Given a plain member P (not a creator) contributed to shared goal G, when P deletes their account, then G survives and its `current_amount` drops by exactly P's contributions. Red state: without the trigger, the total is unchanged.

## Design Notes

**26 FKs to `auth.users`, from the catalog:**
- **REWRITE to N for household-scoped rows, else CASCADE (4):** `categories.user_id`, `category_budgets.user_id`, `goals.user_id` (P1 for household rows, P2 otherwise); `households.created_by` (P1; CASCADE only when sole member).
- **SET NULL, kept but unattributed (2):** `household_invitations.invited_by`, `.accepted_by` (P2: the row survives, the person doesn't).
- **CASCADE, personal (20):** `analytics_events`, `comeback_challenges`, `detected_subscriptions`, `goal_contributions`, `household_members`, `insights`, `notification_deliveries`, `personal_allowances`, `push_subscriptions`, `recovery_plans`, `streaks`, `transactions` (P2, confirmed: shared budget totals drop accordingly), `user_achievements`, `user_feature_state`, `user_profiles.id`, `user_sessions`, `user_values`, `value_categories`, `weekly_digests`, `wishlist_items`.

**Function order, one transaction:**
1. Lock C's households `FOR UPDATE`.
2. Per household with another member: choose N (earliest `joined_at`, tie-break `user_id`); set `created_by`; set N's role to `admin`; move C's shared categories (with collision rename), budgets and goals to N.
3. Then, for every category still owned by C that another user's row references (any of the four tables): copy it to that user, or reuse their same name+type category, and repoint their rows.
4. Return counts.

Nothing here is destructive. If the delete never follows, H simply has two admins and members hold their own categories.

**Why a trigger for goal totals:** recomputing before the delete would understate the total while C's rows still exist. Deleting C's contributions inside the function would be destructive if `deleteUser` then failed. A trigger recomputes inside the cascade's own transaction, so the total is valid throughout.

**Where it fires.** The deletions come from the schema, not from app code: `goal_contributions.goal_id` and `.user_id` are both `ON DELETE CASCADE` (013_goals.sql), so three paths delete contribution rows.
1. **Any user deletes their account**, a plain member as well as a creator. Today that leaves a shared goal's total overstated by money with no row behind it; the trigger corrects it. This is a behaviour change outside the creator path, and a fix. It is stated here and has its own test.
2. **A goal is deleted.** Its contributions cascade, and the goal row is already gone, so the update matches no row.
3. **The creator case** this story is about.

**Scope: shared goals only (`household_id IS NOT NULL`).** That's the only place the invariant is established: shared from creation, and every shared contribution recalculates. A personal goal's contributions come only from its owner, whose deletion removes the goal too, so recomputing personal goals could only "correct" a number never proved equal to its rows.

**Shape: statement-level, `REFERENCING OLD TABLE`**, one `UPDATE goals ... WHERE id IN (distinct deleted goal_ids) AND household_id IS NOT NULL` per statement, rather than a `SUM` per row. That cheaply covers path 2, since a deleted goal matches nothing. Cascaded deletes run as their own statements, so it should fire on paths 1 and 3, and test 5 checks that. If it doesn't fire, use a row-level trigger guarded by `EXISTS` and record the switch in the Spec Change Log.

**Disambiguator:** a numeric suffix. SQL can't read the message files, and a translated word would freeze one language into stored data. The UI already shows a translated "shared" badge driven by `household_id`.

## Verification

**Commands:**
- `npm run lint` -- expected: `files linted: ... errors: 0 warnings: 0`
- `npx tsc --noEmit` -- expected: exit 0
- `npx jest` -- expected: `Tests: ... passed`, 0 failed, floor ok
- CI `RLS Integration Tests` -- expected: the new suite passes on the local stack; red states recorded for the trigger, the copy/repoint, and the ordering
