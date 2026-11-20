---
title: 'A household creator can delete their account without destroying members'' data'
type: 'feature'
created: '2026-11-19'
status: 'done'
baseline_commit: '071d2c993d4d9a2954772ad725e64bb4850a3c23'
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
| Plain member with shared objects | member P (not creator) owns shared goal/category/budget in H; another member used the category and contributed to the goal | P's shared objects move to H's owner (`created_by`) through the SAME function `removeMember` now uses; others' contributions and rows intact (P1); another member's shared objects untouched | collision rename as above |
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
- [x] `supabase/migrations/20261119100000_prepare_account_deletion.sql` -- function and trigger per Design Notes -- the only place all preparatory writes can share one transaction
- [x] `src/lib/services/settingsService.ts` -- prepare RPC, then `admin.deleteUser`; profile delete removed once verified -- destructive step last
- [x] `src/lib/services/householdMemberService.ts` -- `removeMember` calls `reassign_member_shared_objects` instead of its own two UPDATEs -- ONE definition of where a departing member's shared objects go
- [x] `src/lib/services/__tests__/householdMemberService.test.ts` -- assert the RPC call (household, member); the scope guard moves to the RLS suite
- [x] `src/lib/services/__tests__/settingsService.test.ts` -- order and failure cases (prepare fails: no deleteUser; deleteUser fails: error surfaced, no profile delete)
- [x] `src/lib/test-utils/__tests__/account-deletion.rls.test.ts` -- NEW: the scenarios below (seven tests after review; each ends in a residue scan)
- [x] `scripts/schema-drift/dump-catalog.sql` -- (review 2) the drift dump also reads triggers the app puts on `auth.*` tables, so the gate can see `on_auth_user_deleted_remove_invitations`
- [x] `src/lib/test-utils/__tests__/member-removal.rls.test.ts` -- (review) drives the REAL `removeMember`; asserts category, goal and budget move; asserts `created_by` is server-only
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- add the residual holes to the accumulator item

**Acceptance Criteria:**
- Given C and member M where M tagged a transaction with C's category, when C deletes, then M owns H (`created_by`, role admin), M's transaction points to M's copy, and C is fully gone.
- Given `admin.deleteUser` is made to fail, when C deletes, then the profile and all of C's data are intact.
- Given C is H's sole member, when C deletes, then H is deleted.
- Given any deletion above, then every rewritten row belongs to N, and **no row in any FK column referencing `auth.users`, enumerated from `pg_constraint` at test time**, holds C's id. The enumeration must find `user_profiles.id`, or the test fails as NOT MEASURED. (Implemented as a superset: every uuid, uuid[] and text-like column of `public` and `storage`. See the Spec Change Log.)
- Given C contributed to a shared goal, when C deletes, then `goals.current_amount = SUM(goal_contributions.amount)` for that goal.
- Given a plain member P who created a shared goal, a shared category another member used, and a shared budget, when P deletes their account, then all three belong to H's owner, the other member's contributions and rows are intact, and another member's own shared category is NOT moved (the scope guard, mutation-tested).
- Given a plain member P (not a creator) contributed to shared goal G, when P deletes their account, then G survives and its `current_amount` drops by exactly P's contributions. Red state: without the trigger, the total is unchanged.
- (Added 2026-11-19, Niki; refined by review 2.) Given invitations ADDRESSED to the person, meaning ones they accepted (including at an address they later changed) or unaccepted ones addressed to their CONFIRMED email in any letter case and with surrounding whitespace, when they delete their account by any hard delete (the app, or a raw admin delete), then every such invitation is gone. The following survive: invitations they SENT (unattributed), an invitation at the same address accepted by SOMEONE ELSE, invitations to an UNCONFIRMED address, and near-miss addresses that merely contain theirs. A REFUSED delete removes none, and an account with a NULL or blank email deletes cleanly. No client role can EXECUTE any of the migration's five functions. The residue scan searches every text-like column for the deleted person's email as well as their id. Red state, recorded before the fix: the scan found the invitation rows.

## Spec Change Log

- **2026-11-19, human-approved extension (plain members).** Trigger: the step-3 enumeration found that the transfer covered only households the deleting user CREATED. A plain member's shared goal cascaded with every other member's contributions, against P1, while `removeMember` (Epic 13) already reassigned a removed member's shared objects to the admin. Amended: the transfer applies to plain members too. Their shared categories, budgets and goals go to the household owner. Known-bad state avoided: a member's account deletion destroying household objects that member removal preserves.
- **Same date, ONE definition, not two (human-required).** `reassign_member_shared_objects(p_household, p_member)` is the single implementation; deletion and `removeMember` both call it. Its target is `households.created_by`, read inside the function. Verified identical to `removeMember`'s old "acting admin" today: admin is set only by `createHousehold` (creator) and invitations set `member`; production has 2/2 households with exactly one admin, the creator. To keep "the admin is the owner" true, the creator transfer also DEMOTES the creator to member in the same transaction. Otherwise a refused delete would leave the first two-admin household. `removeMember` gains, as stated fixes: shared budgets move (they didn't), name collisions are renamed (today the UPDATE failed and the error was logged and swallowed), and atomicity. KEEP: option 1 was chosen over a parity test because the deletion path needs the step anyway; with one implementation there is nothing left to drift.

- **Same date, step 3 implementation: three strengthenings, no change of intent.**
  - **AC 4's scan is a superset of the FK columns.** Scanning only the FK columns referencing `auth.users` CANNOT fail: once the auth row is gone, referential integrity guarantees each one has cascaded, gone NULL, or refused the delete. The column that can still hold a deleted id is one WITHOUT an FK, which is the risk the deferred-work item names ("a new `user_id` column without an FK"). So test 4 scans EVERY uuid column of every public table, enumerated from the catalog at test time. The FK columns stay as the must-find (`user_profiles.id` or NOT MEASURED; at least 26), and a still-living user must produce hits (the presence control). KEEP: the superset; the presence control.
  - **The matrix audit added coverage to test 1.** Row 33's reuse branch and its value-mapping conflict skip, the personal-budget period-conflict skip, row 32's surviving unattributed invitation, row 34's "lowest free n" (walks to 3) and 100-char truncation (in test 6), and row 39's surviving savings transaction. Test 3 asserts that row 42's preparation is a literal no-op (all counts zero).
  - **Statement-level trigger confirmed on cascaded deletes.** Test 5 is green, and red with the trigger dropped. The row-level fallback in Design Notes is not needed.
- **Same date, step 4 review (three layers): patches only, no loopback.** Nothing was classified intent_gap or bad_spec.
  - **CORRECTION to the entry above: `removeMember` did NOT gain atomicity.** As first written it deleted the membership row, then called the RPC, and only logged a failure. That left an ex-member still owning shared objects, with nothing left to retry. It now calls the RPC FIRST and THROWS on error, which makes it fail closed. That is not one transaction, but every intermediate state is valid: after a reassignment and a failed delete, the member is still a member and their shared objects belong to the owner.
  - **The deploy window.** The `deploy` job ships main before the migration is applied (the standing rule requires a merge first). Until it is applied, account deletion and member removal both answer 500 and change nothing. Apply promptly after merge.
  - **`households.created_by` is now server-only** (trigger `trg_household_owner_server_only`, same shape as `enforce_category_visibility_owner`). The households UPDATE policy let an admin rewrite any column. Before this story `created_by` decided only the cascade; it now decides who receives shared objects and who owns the household, so a client-side rewrite would break "the admin is the owner". Paired test: the admin can still rename the household.
  - **Tests now run the real services.** Deletion goes through `deleteUserAccount` and removal through `removeMember`, with the app's service-role env pinned to the local stack by `pinAppServiceRoleToLocalStack`; a hard assert precedes every call, because next/jest loads `.env*`. `member-removal.rls.test.ts` had kept mirroring the old UPDATE the service no longer ran.
  - **Further coverage:**
    - new-owner choice with ties and a NULL join date, and exactly one admin (test 7);
    - the trigger's shared-only guard (test 5, an un-shared goal);
    - the residue scan, now per scenario and widened to uuid[] and text-like columns in `public` and `storage`, with a jsonb presence control (test 4, self-contained);
    - matrix row 39 seeded as `logSavingsContribution` links it (`goal_contribution_id`, SET NULL);
    - a test-6 fixture that was an impossible state (current 0 against 80 contributed);
    - errors checked everywhere;
    - cleanup that attempts every user.
  - **Deferred** (deferred-work.md): the race window between the two calls; telling people what changed; accepted invitations keeping the invitee's email (P2, pre-existing).
  - **Rejected:**
    - the route's `!deleteSuccess` branch (pre-existing);
    - SECURITY DEFINER (the 026 convention);
    - a creator without a membership row, and a second admin (both unreachable);
    - reuse onto a member's shared same-name category (that is the approved reuse: the member's own category and settings now apply to their own rows);
    - Database type regeneration and a down migration (not used by repo convention).

- **Same date, Niki's direction after review: the email, and the order of release.**
  - **The invitee's email (P2, needs no new decision).** An accepted invitation kept the person's address, and the admin's list (`listInvitations`, every status) kept showing it. Pending and revoked invitations addressed to them stayed in other households. The residue scan was extended first to search every text-like column for the deleted person's EMAIL. It went red on exactly those rows (`Tests: 2 failed, 5 passed, 7 total`; `household_invitations.email: 3 (email)` in test 5, `: 1 (email)` in test 2) and nowhere else. Fixed by migration section 5, a BEFORE DELETE trigger on `auth.users` that deletes invitations `accepted_by` the person or addressed to their email (case-insensitive).
    - **Deleted, not anonymised:** with `accepted_by` NULL, an anonymised row carries only an invented placeholder address.
    - **A trigger, not a step in the preparation:** it runs inside the auth delete's transaction, so a refused delete rolls it back. The preparation must stay non-destructive.
    - **BEFORE DELETE:** `accepted_by` still holds the id at that point.
    - Precedent: `on_auth_user_created`. `postgres` holds TRIGGER on `auth.users` locally and in production, checked read-only.
  - **Release order: migration first, then merge.** Merging first meant a guaranteed 500 window on both paths until the apply. The migration is additive, so it is applied from the PR's commit while production runs main, and THEN merged. This requires "old code × new schema: compatible", proven, not assumed (see Verification). The standing rule's condition 1 is amended for this: a reviewed, CI-green PR commit meets its purpose, and the file is FROZEN once applied (any later change is a new migration).
  - **Board decisions:** notifications become a separate story, later. The two-call race window is accepted for now: revisit if users grow.

- **Same date, review 2 (three layers on the `auth.users` email trigger, Niki's five attack points): patches, no loopback.**
  - **Point 4 FAILED as committed.** `enforce_household_owner_server_only` had no REVOKE, so Supabase's default privileges gave anon and authenticated EXECUTE. Found by all three layers and by a catalog check. Now revoked. New test 8 asserts, for all five functions: no client EXECUTE; DEFINER only where needed; `search_path` pinned; owner. It also asserts that the auth trigger is BEFORE DELETE FOR EACH ROW, and that nothing on `household_invitations` (FK, trigger, rule, forced RLS) can make it raise.
  - **Point 2:** whitespace was not handled. The match is now `lower(btrim())` on both sides. New test 9 adds a mixed-case ACCOUNT email, padded and mixed-case invitations, and near-misses that must survive.
  - **Point 3, two scope corrections.** These are the refinements to the earlier instruction:
    - **Another person's acceptance is kept.** The email arm matched invitations already accepted by SOMEONE ELSE who held the address before, which is that person's record (P1). It now matches only unaccepted rows; the person's own acceptances go through `accepted_by`.
    - **Unconfirmed addresses are kept.** An UNCONFIRMED address is not proven to be the account's, so deleting a never-confirmed sign-up must not wipe the real owner's invitations. The email arm now requires `email_confirmed_at`.
  - **Point 1:** a NULL or blank email matches nothing (`nullif(btrim())`). New test 10 deletes accounts with NULL and blank addresses. Production: 0 users with NULL email, providers `email` and `google`.
  - **The trigger now has a test on a RAW `admin.deleteUser`** with no preparation (test 9). There is an index for the email arm, and comments now state the failure mode (fail-closed, deliberate), that coverage is hard deletes only (not soft delete or TRUNCATE), and the known limits.
  - **Point 5 / the gate:** the drift dump read triggers only for the `public` schema, so the drift check could not see this trigger. Fixed in `dump-catalog.sql`; both sides were checked to hash `on_auth_user_created` identically, so the change adds no false drift.
  - **Red before the fix:** `Tests:       3 failed, 7 passed, 10 total` (test 8: anon/authenticated EXECUTE on the guard; test 9: the padded invitation survived; test 10: the unconfirmed address's invitation was deleted). After: `10 passed`.
  - **Deferred:**
    - a SECURITY question: does production require email confirmation? If not, `GET /api/invitations/mine` hands invitation tokens to anyone who registers the invitee's address;
    - function ACLs in the drift dump;
    - GoTrue's audit log keeping the email (P2);
    - a stale allowlist entry.
  - **Rejected:**
    - SECURITY DEFINER on the RPCs (the 026 convention);
    - same-address SSO accounts (no SSO; OAuth links by email);
    - `DROP TRIGGER` needing ownership (it worked on about 24 local re-applies with the trigger present; production's apply is a first apply);
    - backfill (production has 0 orphaned accepted invitations);
    - "jsonb not scanned for email" (it is);
    - the en/bg `lower()` divergence.

## Design Notes

**26 FKs to `auth.users`, from the catalog:**
- **REWRITE to N for household-scoped rows, else CASCADE (4):** `categories.user_id`, `category_budgets.user_id`, `goals.user_id` (P1 for household rows, P2 otherwise); `households.created_by` (P1; CASCADE only when sole member).
- **SET NULL, kept but unattributed (2):** `household_invitations.invited_by`, `.accepted_by` (P2: the row survives, the person doesn't). AMENDED 2026-11-19: this holds for invitations the person SENT (`invited_by`). An invitation ADDRESSED to them, accepted by them or carrying their email, is deleted by the `auth.users` BEFORE DELETE trigger before the `accepted_by` SET NULL can apply: its email is their personal data.
- **CASCADE, personal (20):** `analytics_events`, `comeback_challenges`, `detected_subscriptions`, `goal_contributions`, `household_members`, `insights`, `notification_deliveries`, `personal_allowances`, `push_subscriptions`, `recovery_plans`, `streaks`, `transactions` (P2, confirmed: shared budget totals drop accordingly), `user_achievements`, `user_feature_state`, `user_profiles.id`, `user_sessions`, `user_values`, `value_categories`, `weekly_digests`, `wishlist_items`.

**Function order, one transaction:**
1. Lock C's households `FOR UPDATE`.
2. Per household with another member: choose N (earliest `joined_at`, tie-break `user_id`); set `created_by`; set N's role to `admin` and DEMOTE C to `member`; move C's shared categories (with collision rename), budgets and goals to N through `reassign_member_shared_objects`.
3. Then, for every category still owned by C that another user's row references (any of the four tables): copy it to that user, or reuse their same name+type category, and repoint their rows.
4. Return counts.

Nothing here is destructive. If the delete never follows, N owns H and is its only admin, C is a member, and members hold their own categories: a valid state (test 2 asserts it).

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

**Results (2026-11-19, final code after review 2; local stack on CLI 2.105.0, the CI pin):**
- `npm run lint`: `files linted: 649   errors: 0   warnings: 0 (max 0)`; `npm run format:check`: `All matched files use Prettier code style!`
- `npx tsc --noEmit`: exit 0
- `npm run test:order` + `scripts/ci/assert-test-run.sh`: `Tests:       76 skipped, 2718 passed, 2794 total`, `ok: 2718 tests ran, in the pinned order 20261029`
- `npm run test:rls`, the FULL suite, with BOTH lines checked: `Test Suites: 14 passed, 14 total`, `Tests:       76 passed, 76 total`. The first run of the review-2 tests failed at SUITE level only: the cleanup `afterAll` exceeded Jest's 5 s default, and `Tests:` alone could not show that. It now has an explicit 180 s timeout.
- **The email: test before fix.**
  - Round 1, before section 5: `Tests:       2 failed, 5 passed, 7 total` (the invitation rows, and nothing else); after: green.
  - Review 2, before its fixes: `Tests:       3 failed, 7 passed, 10 total` (the guard's EXECUTE grant, the padded invitation, the unconfirmed address); after: `10 passed`.
- **Email-trigger mutants, on the final bytes:**
  - M18 trigger dropped: `5 failed, 5 passed, 10 total` (tests 2, 5, 8, 9, 10)
  - M19 case-sensitive: `2 failed, 8 passed, 10 total` (tests 5, 9)
  - M20 `accepted_by` arm dropped: `2 failed, 8 passed, 10 total` (tests 5, 10)
- **Review-2 guards, each red on its test:**
  - M21 no trim: test 9
  - M22 deletes another person's acceptance: test 9
  - M23 unconfirmed treated as theirs: test 10
  - M24 REVOKE dropped: test 8
  - M25 AFTER instead of BEFORE: tests 5, 8, 10
  - T1–T4 re-run: T4 (email path blind) is red on test 4's presence control and on tests 9 and 10, whose allowances must be found.
  - The `nullif` blank-email guard cannot be made red: the invitations table's non-empty CHECK already prevents a blank match. It is kept as an unreachable guard.
- **Old code × new schema: COMPATIBLE.** Where I looked:
  1. **Writers of `households.created_by` on main:** `git grep` over `src` and `supabase`. App code only INSERTs (`householdService.createHousehold`) and DELETEs (its rollback); every other call is a SELECT. No SQL anywhere UPDATEs `households`. The guard is BEFORE UPDATE, so nothing on main reaches it.
  2. **The old deletion path:** profile delete, then `admin.deleteUser`.
     - Nothing references `user_profiles` or `household_invitations` (catalog), so the profile delete cascades nothing.
     - The contribution cascade fires the goal trigger. It updates only shared goals, and `goals` has only its `updated_at` trigger.
     - The `auth.users` trigger deletes invitations addressed to the user.
     - Both of those are intended changes, not breakages.
  3. **Name collisions in production** (read-only query): none of the five functions and none of the three triggers exist, and no migration at or after `20261100000000` is recorded. Every `CREATE OR REPLACE` creates; nothing is overwritten.
  4. **Privilege:** `postgres` holds TRIGGER on `auth.users` in production (read-only check), so section 5 can be applied.
  5. **EMPIRICAL:** main's actual `deleteUserAccount` and `removeMember` (via `git show main:`, run once and not committed) against the migrated local DB: `Tests:       3 passed, 3 total`.
     - a plain member's deletion succeeds, with the shared total recomputed and the invitations gone;
     - a creator's deletion succeeds with the OLD semantics (the household cascades);
     - main's `removeMember` succeeds and its own UPDATEs still move the category and goal.
- **Red states against the final code** (each SQL mutant applied to the local DB, the original re-applied after it; test-side mutants were mutated copies). All 24 went red on the intended test:

  | Mutant | Red |
  |---|---|
  | M1 trigger dropped | tests 1, 5, 6 |
  | M2 scope guard removed | test 6 |
  | M3 copy+repoint removed | tests 1, 2 |
  | M4 demotion removed | test 2 |
  | M5 transfer removed | tests 1, 2, 7 |
  | M6 no walk to the lowest free n | test 1 |
  | M7 no truncation | test 6 |
  | M8 budget skip removed | test 1 |
  | M9 mapping skip removed | test 1 |
  | M10 reuse removed | test 1 |
  | M11 latest joiner | test 7 |
  | M12 NULL join date wins | test 7 |
  | M13 tie to the highest id | test 7 |
  | M14 everyone promoted | test 7 |
  | M15 personal goals recomputed | test 5 |
  | M16 `created_by` trigger dropped | member-removal, owner test |
  | M17 reassign moves nothing | account-deletion 1, 6 and member-removal 2 tests |
  | M18 email trigger dropped | tests 2, 5 |
  | M19 email compared case-sensitively | test 5 |
  | M20 `accepted_by` clause dropped | test 5 |
  | T1 blind enumeration | all 7, `NOT MEASURED` |
  | T2 counter never counts | test 4 |
  | T3 text path blinded | test 4, `Tests: 1 failed, 6 passed, 7 total` |
  | T4 email path blinded | test 4 |

  T3's `Received` holds every uuid hit and the email hit, and lacks only `public.analytics_events.event_properties: 1`: red for the right reason. Measured before the Prettier reformat, which changed only whitespace; the full suite was re-run on the formatted bytes.
- **Unit mutants against the final code**, each red on its intended test:
  - U1 prepare failure only logged;
  - U2 the admin passed as the member;
  - U3 a direct UPDATE kept;
  - U4 `removeMember` swallows again;
  - U5 `removeMember`'s old order;
  - U6 a profile delete through the service client;
  - U7 a rejected preparation swallowed.

**Production apply (2026-11-20, Niki's yes for `c52de92`, via the CLI):**
- Two attempts through the MCP `apply_migration` tool were declined automatically: its confirmation for DROP/REVOKE cannot appear in a non-interactive session. Nothing was applied either time, verified read-only.
- `supabase projects list`: `● | rlcgqvqpuqkkxtczalpi | smart-budget-application` (linked by Niki).
- `supabase db push --dry-run` from `c52de92`: `Would push these migrations: • 20261119100000_prepare_account_deletion.sql`. Exactly one.
- Before: none of the five functions; triggers `on_auth_user_created` only; the new index absent; ledger 47 rows.
- `supabase db push` from `c52de92` (migration blob `8868eb44`): `Applying migration 20261119100000_prepare_account_deletion.sql...` / `Finished supabase db push.`
- After: +5 functions (owner postgres, `search_path=public`, `anon_exec=false auth_exec=false` on all five); +3 triggers (auth.users BEFORE DELETE FOR EACH ROW, households BEFORE UPDATE, goal_contributions AFTER DELETE FOR EACH STATEMENT); +1 index; ledger 48 rows, the new one `20261119100000 | prepare_account_deletion`. Ledger vs repo: `in both: 48 | only in the repo: 0 | only in the ledger: 0`. Row counts unchanged.
- Drift (run 44720322967): `hard failures : 0`, `pending : 0` (8 before the apply), `DRIFT CHECK PASSED.`
- The file `supabase/migrations/20261119100000_prepare_account_deletion.sql` is FROZEN from here: any change is a new migration.

## Suggested Review Order

**The ordering: preparatory writes first, the destructive step last**

- Entry point: one non-destructive RPC, then `admin.deleteUser`; no hand-written profile delete.
  [`settingsService.ts:331`](../../src/lib/services/settingsService.ts#L331)

- All preparatory writes in one transaction: ownership, shared objects, category copies.
  [`20261119100000_prepare_account_deletion.sql:96`](../../supabase/migrations/20261119100000_prepare_account_deletion.sql#L96)

- Longest-standing member becomes owner and admin; the creator is demoted, so a refused delete stays valid.
  [`20261119100000_prepare_account_deletion.sql:128`](../../supabase/migrations/20261119100000_prepare_account_deletion.sql#L128)

**One definition of where a departing member's shared objects go**

- The single implementation; the target is `created_by`, and collisions get a numeric suffix.
  [`20261119100000_prepare_account_deletion.sql:28`](../../supabase/migrations/20261119100000_prepare_account_deletion.sql#L28)

- removeMember calls it FIRST and fails closed: no ex-member left owning shared objects.
  [`householdMemberService.ts:94`](../../src/lib/services/householdMemberService.ts#L94)

- `created_by` made server-only: the invariant both functions rely on, closed at the data layer.
  [`20261119100000_prepare_account_deletion.sql:292`](../../supabase/migrations/20261119100000_prepare_account_deletion.sql#L292)

**P1: members keep their rows**

- Every category of the user's that another member references: copied or reused, then repointed.
  [`20261119100000_prepare_account_deletion.sql:157`](../../supabase/migrations/20261119100000_prepare_account_deletion.sql#L157)

- Conflict skips for personal budgets and value mappings, so a repoint never collides.
  [`20261119100000_prepare_account_deletion.sql:192`](../../supabase/migrations/20261119100000_prepare_account_deletion.sql#L192)

**Shared-goal totals**

- A statement trigger recomputes SHARED goals from their remaining rows on any contribution delete.
  [`20261119100000_prepare_account_deletion.sql:249`](../../supabase/migrations/20261119100000_prepare_account_deletion.sql#L249)

**P2 for the email**

- Invitations ADDRESSED to the person go inside the auth delete's own transaction (a refused delete rolls back).
  [`20261119100000_prepare_account_deletion.sql:371`](../../supabase/migrations/20261119100000_prepare_account_deletion.sql#L371)

- The seeds the email scan went red on before the fix, plus the over-deletion guard.
  [`account-deletion.rls.test.ts:773`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L773)

**Tests against Postgres**

- Review 2's three: privileges and structure, the email rule attacked, accounts with no proven email.
  [`account-deletion.rls.test.ts:894`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L894)

- The real service, then a residue scan of every user-referencing column, after each deletion.
  [`account-deletion.rls.test.ts:108`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L108)

- Why the scan is wider than the FKs (an FK scan cannot fail), plus its NOT MEASURED must-find.
  [`account-deletion.rls.test.ts:305`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L305)

- The creator scenario: copy, reuse, rename, invitation, goals, savings link.
  [`account-deletion.rls.test.ts:431`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L431)

- A REFUSED auth delete destroys nothing; a retry succeeds.
  [`account-deletion.rls.test.ts:623`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L623)

- New-owner choice: ties, NULL join dates, exactly one admin.
  [`account-deletion.rls.test.ts:869`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L869)

- Member removal now drives the real service, no longer a stale mirror.
  [`member-removal.rls.test.ts:161`](../../src/lib/test-utils/__tests__/member-removal.rls.test.ts#L161)

- The admin cannot rewrite `created_by`, but can still rename (the paired presence check).
  [`member-removal.rls.test.ts:220`](../../src/lib/test-utils/__tests__/member-removal.rls.test.ts#L220)

**Peripherals**

- The drift gate now reads the app's triggers on auth.* tables, so it can see this one.
  [`dump-catalog.sql:137`](../../scripts/schema-drift/dump-catalog.sql#L137)

- Pins the app's service-role env to the local stack, with a hard assert before each real call.
  [`rlsClient.ts:67`](../../src/lib/test-utils/rlsClient.ts#L67)

- Unit test: removal fails closed, and the membership is never deleted.
  [`householdMemberService.test.ts:114`](../../src/lib/services/__tests__/householdMemberService.test.ts#L114)

- Unit test: the order, failure and rejection cases; no table write through either client.
  [`settingsService.test.ts:359`](../../src/lib/services/__tests__/settingsService.test.ts#L359)

- Route: either step's throw answers 500; stale cascade comment corrected.
  [`route.ts:125`](../../src/app/api/user/account/route.ts#L125)

- Deferred from review: the race window, notifications, accepted-invitation emails.
  [`deferred-work.md:852`](deferred-work.md#L852)
