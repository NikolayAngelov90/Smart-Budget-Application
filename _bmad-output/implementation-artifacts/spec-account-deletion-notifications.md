---
title: 'Tell people what an account deletion changed for them'
type: 'feature'
created: '2026-11-20'
status: 'in-progress'
baseline_commit: 'ed5147a567f942e29cf60eceae52343d37a7c499'
review_loop_iteration: 0
context:
  - '{project-root}/docs/api-conventions.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An account deletion, or a member's removal, changes other people's data silently. A member becomes a household's owner, members get copies of categories, and an owner finds a shared category renamed ("Храна 2") or receives a departed member's shared goals and budgets.

**Approach:** PR 2 of 2 (split by Niki, 2026-11-20; PR 1 is `spec-account-deletion-refused-message.md`, the refused-deletion dialog). The people who stay are told, in their own language, on their next visit, through an in-app notice that reaches every user, plus a push for anyone subscribed. Stored notices never contain the departing person's name, id or email (P2).

## Niki's decisions (2026-11-20)

- **Channels:** an in-app notice on the next visit, plus a push for subscribers.
- **Names:** never the departed person. "Its creator" / "a household member" is accepted.
- **Duration:** UNTIL DISMISSED, with no expiry. The notices hold none of the departed person's personal data, so P2 gives no reason to expire them, and with 1 of 3 users active in 30 days, an expiry would let notices vanish unseen.
- **Scope, both edges IN:**
  - the owner is told when a departed member's shared goals or budgets moved to them, not only about renamed categories;
  - `removeMember` notifies the affected members too: it moves, renames and copies through the same function, so it is the same event.
- **Pushes are localised from the start** (Niki, 2026-11-20): PR 2's pushes render in the recipient's language. Every EXISTING push being English is a separate follow-up on the board.
- **Claims rule:** a notice says only what the code knows; no absolute claim about state it cannot see.
- **Text rules for every new string:** never the departed person's name; no gendered pronoun for anyone; Bulgarian written as Bulgarian, not translated English. **Show Niki the new Bulgarian strings in the PR 2 report.**

**Texts** (en / bg; the English as drafted, the Bulgarian as corrected by Niki):
- **M1, new owner.** "You now own {household}" — "Its creator deleted their account, so the household passed to you as its longest-standing member. You are now its owner and admin." / "Вече сте собственик на {household}" — "Създателят му изтри акаунта си и домакинството премина към вас като член с най-дълъг стаж в него. Сега вие сте собственик и администратор."
- **M2a, member got copies.** "Your categories were kept" — "A household member deleted their account. You had been using categories they created ({categories}), so you now have your own copies, and your entries point to them. Nothing was lost." / "Категориите ви са запазени" — "Член на домакинството изтри акаунта си. Използвахте категории, създадени от този член ({categories}), затова вече имате собствени копия и записите ви са прехвърлени към тях. Нищо не е загубено."
- **M2b, owner got a renamed category.** "A shared category was renamed" — "The shared category "{from}" now belongs to you. You already had one with that name, so it is now called "{to}"." / "Обща категория беше преименувана" — "Общата категория „{from}“ вече е ваша. Вече имахте категория с това име, затова сега се казва „{to}“."
- **NEW, to be drafted at PR 2's plan step:** the owner received shared goals/budgets; the `removeMember` variants of M2a/M2b/goals-budgets ("a member was removed", not "deleted their account").

</frozen-after-approval>

## Corrections to the frozen text (for Niki, not applied inside the block)

- **`removeMember` does not copy.** It calls only `reassign_member_shared_objects`, which MOVES the removed member's shared categories, budgets and goals to the owner and renames a colliding category. Copying happens only in `prepare_account_deletion` step (c). On removal, the only person left behind who is affected is the OWNER, who is also the person doing the removing. They get the rename and goals/budgets notices with the "a member was removed" wording. The removed person keeps the existing push and gets no in-app notice (open question in the report).
- **M2a's "Nothing was lost." / "Нищо не е загубено." is dropped under Niki's claims rule.** It is false in one case the code knows about: in step (c), a member's personal budget for the same period on the copied category's twin is NOT repointed, and that duplicate goes with the deleted category. Restoring it is a one-line change if Niki disagrees.

## Behaviour matrix

| Event | Recipient | Notice (kind / cause) | Params (never the departed person) |
|---|---|---|---|
| Creator deleted, a member inherits | the new owner | `household_transferred` / `account_deleted` | household name |
| Any deletion, a member used the person's categories, COPIED to them | that member | `categories_copied` / `account_deleted` | category names (copies only; a reused same-name category is not "a copy") |
| Shared category moved to the owner and RENAMED | the owner | `category_renamed` / deleted or removed | from, to, household name |
| Shared goals or budgets moved to the owner | the owner | `shared_plans_received` / deleted or removed | goals n, budgets n, household name |
| Shared category moved, NOT renamed | none | — | (the name is unchanged) |
| Sole member, or no household | none | — | — |
| The notice insert fails | none | the deletion or removal completes; Postgres logs a WARNING | savepoint in `private.record_account_notice` |
| Push: quiet hours, transient, no subscription | — | the notice is unaffected; retried by the daily cron for 7 days after creation | the delivery claim is released |
| Notice dismissed | — | gone from the card; never pushed after dismissal | — |
| Recipient deletes their own account | — | their notices cascade | FK `recipient_id` → `auth.users` ON DELETE CASCADE |

## Code Map

- `supabase/migrations/20261119100000_prepare_account_deletion.sql:28-85,96-222` is FROZEN: `reassign_member_shared_objects` (RETURNS INTEGER) and `prepare_account_deletion` (RETURNS JSONB with `ownership_transferred` and `shared_objects_moved`, which PR 1's `readPreparedChanges` reads). A new migration can only CREATE OR REPLACE them, so the signatures and return shapes must stay the same.
- `src/lib/services/householdMemberService.ts:67-160` (`removeMember`):
  - It calls the 2-arg `reassign_member_shared_objects` RPC, then deletes the membership.
  - It then sends a best-effort push to the removed person, in hardcoded English. That push is pre-existing and stays, since the existing pushes are a follow-up.
- `src/app/api/households/members/[userId]/route.ts:35` is the only caller of `removeMember`.
- `src/app/api/user/account/route.ts`, the only caller of `deleteUserAccount`.
- `src/lib/services/pushService.ts:133` (`dispatchCategorizedPush`):
  - Its outcomes are `sent`, `suppressed`, `deferred`, `failed`, `no_subscription` and `not_configured`.
  - Only `sent` is a delivery, and the digest cron (`src/app/api/cron/weekly-digest/route.ts:170-188`) leaves everything else unmarked so that it is retried.
- `src/lib/services/notificationDeliveryService.ts:44-60`:
  - `markDelivered` upserts with `ignoreDuplicates`, so it cannot report that another run already claimed a row.
  - `kind` is free TEXT (no CHECK), so `account_notice` needs no migration.
- `vercel.json` has two crons. `weekly-digest` runs at `0 9 * * *`, daily despite the name, and is where the notice push retry rides.
- `src/app/api/transactions/route.ts:43,421-439` uses `after()` from `next/server`. The test mock pattern for it is at `src/app/api/transactions/__tests__/route.test.ts:13`.
- `src/i18n/config.ts`: `SUPPORTED_LOCALES = ['en','bg']`, `DEFAULT_LOCALE = 'en'`. The UI locale is the `NEXT_LOCALE` cookie. A push uses the recipient's stored `user_profiles.preferences.language`.
- `jest.setup.js:131-158`: the next-intl mock has no `createTranslator`. A real-ICU proof uses the child-process render from `src/components/settings/__tests__/deletionRefusalMessage.test.ts`.
- `src/app/dashboard/page.tsx:248-251` is the one-shot card mount, next to `FeatureIntroCard`. `src/lib/hooks/useFeatureDisclosure.ts` is the hook pattern (SWR key + POST + bound `mutate`).
- `src/lib/test-utils/__tests__/account-deletion.rls.test.ts`: the residue scan (id, email, and since cc8f383 the display name) covers every public table automatically, including the new one.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261125100000_account_notices.sql` (NEW, additive, apply-first):
  - **`public.account_notices`:**
    - columns: `id`; `recipient_id` (FK `auth.users` ON DELETE CASCADE); `kind` CHECK; `cause` CHECK; `household_id` (FK `households` ON DELETE CASCADE, nullable); `params` jsonb; `created_at`; `dismissed_at`;
    - a partial index on `(recipient_id, created_at) WHERE dismissed_at IS NULL`;
    - RLS with SELECT-own (initplan form);
    - `REVOKE ALL` from PUBLIC/anon/authenticated, then `GRANT SELECT` to authenticated. Writes are service-role only.
  - **`private.record_account_notice(...)`:** SECURITY DEFINER, pinned search_path, and an `EXCEPTION WHEN OTHERS -> RAISE WARNING` savepoint, so a failed insert never rolls back the caller.
  - **`private.move_member_shared_objects(p_household, p_member, p_cause)`:** the reassign logic, plus a `category_renamed` notice per renamed category and one `shared_plans_received` notice when goals+budgets > 0. Returns the moved count.
  - **`public.reassign_member_shared_objects(uuid, uuid)`:** same signature and INTEGER return, now a wrapper calling the private function with `'member_removed'`.
  - **`public.prepare_account_deletion(uuid)`:** same signature and return keys. It adds a `household_transferred` notice for the new owner, calls the private function with `'account_deleted'`, and adds one `categories_copied` notice per recipient of copies (the copied names, sorted, distinct).
  - **Privileges:** every function revoked from PUBLIC/anon/authenticated; the public ones granted to service_role.
- [ ] `src/lib/services/notificationDeliveryService.ts` -- `NotificationKind` gains `'account_notice'`. New `claimDelivery` (an insert; `true` only if this call made the row) and `releaseDelivery`.
- [ ] `src/lib/services/accountNoticeService.ts` (NEW) -- `deliverAccountNoticePushes({ since? })`:
  - service role; undismissed notices created within 7 days (or since `since`);
  - per recipient, at most 3 per run, in priority order (`household_transferred`, `categories_copied`, `shared_plans_received`, `category_renamed`);
  - for each: claim, render title/body in the recipient's stored language with `createTranslator` (next-intl) and the message files, then `dispatchCategorizedPush(…,'household',…)`; release the claim unless `sent`;
  - never throws, and returns the counts.
  
  Also `renderAccountNotice(locale, notice)`, shared with nothing else. Category lists use `Intl.ListFormat(locale)`.
- [ ] `src/app/api/user/account/route.ts` and `src/app/api/households/members/[userId]/route.ts` -- after the service call (whatever its outcome, since the writes stand), `after(() => deliverAccountNoticePushes({ since: requestStart }))`.
- [ ] `src/app/api/cron/weekly-digest/route.ts` -- call `deliverAccountNoticePushes()` once per run and add its counts to the response. A failure is logged and never fails the digest.
- [ ] `src/app/api/notices/route.ts` (GET) and `src/app/api/notices/[id]/dismiss/route.ts` (POST):
  - **GET:** the user's own undismissed notices, through the session client (RLS), oldest first. A query error is a 500 (degradation policy: core input).
  - **POST:** service role, scoped `id` AND `recipient_id = user` AND `dismissed_at IS NULL`, idempotent.
- [ ] `src/lib/hooks/useAccountNotices.ts` + `src/components/dashboard/AccountNoticesCard.tsx` -- mounted next to `FeatureIntroCard`:
  - at most 3 visible, plus "{count} more";
  - a heading per notice;
  - dismiss = POST, then the bound `mutate`;
  - no aria-live on the card.
- [ ] `messages/en.json` + `messages/bg.json` -- an `accountNotices` namespace: the M1, M2a and M2b texts above; `sharedPlansReceived*` (both causes); `dismiss`; `more`.
- [ ] Tests:
  - **RLS:**
    - every matrix row through the REAL `deleteUserAccount` / `removeMember`, against the local stack, with the residue scan (id, email, display name) green;
    - a FORCED notice-insert failure (a temporary `CHECK (false) NOT VALID`): the deletion and the removal complete, and the data still moved;
    - clients cannot insert, update or delete notices or read others';
    - privileges and search_path of the new functions.
  - **Unit:**
    - delivery: claim, render, release, the cap, the language, never throws;
    - both routes schedule `after()`;
    - the cron;
    - GET/dismiss scoping;
    - the card.
  - **Real ICU:** every notice text in en and bg (child-process render).
  - **Mutants:** the savepoint removed, the claim skipped, the recipient-scope dropped, the language ignored, plus the existing scan mutants. Each red state is recorded here.

**Acceptance Criteria:**
- Given a creator with a member deletes their account, when the member next opens the dashboard, then they see the M1 notice (and any M2a/M2b/plans notices) in their UI language, until they dismiss it.
- Given the notice insert fails, when an account is deleted or a member removed, then the operation completes exactly as before.
- Given any deletion in the RLS suite, when the residue scan runs, then no column holds the departed person's id, email or display name, and the living user's name is found.
- Given a recipient with a push subscription, when the notice is recorded, then one push in their stored language is sent after the response, and the daily cron retries a deferred or failed one for 7 days.

## Design Notes

- **Notices are recorded IN the SQL that makes the change, inside a savepoint.** There is no window in which data changed but the notice was lost, as a TS insert after `prepare` would leave, and a failed insert still cannot roll the change back. Delivery (push) is what runs off the critical path, via `after()`.
- **Same signatures, same return shapes, so this is apply-first.** Old code × new schema: main's `deleteUserAccount` reads the same keys, and main's `removeMember` calls the same 2-arg function, which now also records the owner's notices. Notices recorded before the app deploys simply wait to be shown, because they never expire.
- **Claim-then-send.** The route's `after()` and the cron can overlap, so a run claims the delivery row before sending and releases it unless the push was `sent`. Duplicates are impossible, and retries keep the marker-absence rule.
- **Household name is snapshotted into params.** The recipient may later lose RLS read access to the household. The name is the household's, not the departed person's.
- **Migration release order is #103's:** CI green and review done on the PR commit, a compatibility proof, then Niki's yes for that SHA, then a CLI `db push --dry-run` gate, the apply, a before/after diff and the drift check, and only then the merge.

## Verification

**Commands:**
- `npm run verify` -- expected: `verify: OK`.
- `npm run test:order` -- expected: `ok: N tests ran, in the pinned order 20261029`.
- `npm run test:rls` (full) -- expected: `Test Suites: 14 passed` (15 if a new file is added) and all tests passed.
- `npm run build` -- expected: success.

**Manual checks:** the dashboard card rendered in en and bg on the dev server, against a route intercept (no production writes).
