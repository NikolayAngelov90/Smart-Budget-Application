---
title: 'Tell people what an account deletion changed for them'
type: 'feature'
created: '2026-11-20'
status: 'done'
baseline_commit: 'ed5147a567f942e29cf60eceae52343d37a7c499'
review_loop_iteration: 1
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
| Creator deleted, a member inherits | the new owner | `household_transferred` / `account_deleted` | household name, `seniority` ("longest-standing" only when every candidate had a join date) |
| Any deletion, a user's rows used the person's categories, COPIED to them | that user | `categories_copied` / `account_deleted` | category names (copies only, sorted, distinct), `shared_household` ("a household member" only when true) |
| Shared category moved to the owner and RENAMED | the owner | `category_renamed` / deleted or removed | from, to, household name |
| Shared goals or budgets moved to the owner | the owner | `shared_plans_received` / deleted or removed | goals n, budgets n, household name |
| Shared category moved, NOT renamed | none | — | (the name is unchanged) |
| Sole member, or no household | none | — | — |
| The deletion is REFUSED after prepare | none | nothing is published; the staged notices wait (the departing user's id only there) and are published if a later deletion succeeds | staged in `private.pending_account_notices`, published by the `auth.users` trigger |
| The removal fails | none | the whole removal rolls back, notices included | one transaction, `public.remove_household_member` |
| A notice cannot be staged, published or written | none | the deletion or removal completes; Postgres logs a WARNING | savepoints in `private.record_account_notice` and `private.publish_account_notices` |
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
- [x] `supabase/migrations/20261125100000_account_notices.sql` (NEW, additive, apply-first; signatures and return shapes unchanged):
  - **`public.account_notices`:** read-own RLS; SELECT only for clients; FK indexes.
  - **`private.pending_account_notices`:** staged deletion notices, keyed by the departing user (ON DELETE CASCADE); no client privileges.
  - **`private.record_account_notice`:** the one writer (stages or writes), behind a savepoint.
  - **`private.publish_account_notices`:** the `auth.users` BEFORE DELETE trigger, behind a savepoint.
  - **`private.move_member_shared_objects`:** the reassign rule, plus rename and plans notices.
  - **`public.remove_household_member`:** the one-transaction removal.
  - **`public.reassign_member_shared_objects`:** the legacy wrapper, with no notices.
  - **`public.prepare_account_deletion`:** stages the transfer and copies notices, with `seniority` and `shared_household`.
- [x] `src/lib/services/householdMemberService.ts` -- `removeMember` calls `remove_household_member` (atomic).
- [x] `src/lib/services/notificationDeliveryService.ts` -- the `account_notice` kind, plus `claimDelivery` and `releaseDelivery`.
- [x] `src/lib/accountNotices/noticeMessage.ts` -- the one kind→keys mapping (seniority and shared-household variants, an `Intl.ListFormat` fallback).
- [x] `src/lib/services/accountNoticeService.ts` -- `renderAccountNotice` (an `onError` means no render) and `deliverAccountNoticePushes`:
  - newest first, at most 100 per run;
  - renderable notices filtered before the cap of 3 per recipient;
  - fail closed on the language lookup;
  - claim, re-check dismissal, send (clipped), release unless `sent`.
- [x] Routes -- the account deletion and member removal schedule `after()` delivery ONLY after success.
- [x] Crons -- `weekly-digest` (09:00 UTC) and `subscription-detect` (02:00 UTC) both retry, guarded and before their early returns.
- [x] `src/app/api/notices` (GET, RLS) and `[id]/dismiss` (POST, service role, scoped).
- [x] `useAccountNotices` (a per-id hidden set, so concurrent dismissals stay safe) + `AccountNoticesCard`:
  - mounted on the dashboard;
  - a section heading and named buttons;
  - focus moved after a dismissal.
- [x] `messages/{en,bg}.json` -- the `accountNotices` namespace.
- [x] Tests:
  - RLS 3, 4, 11, 12, 12b and 13-16;
  - unit and component tests for every module above;
  - real-ICU rendering of every text;
  - the dashboard mount.

  Mutants are recorded under Verification.

**Acceptance Criteria:**
- Given a creator with a member deletes their account, when the member next opens the dashboard, then they see the M1 notice (and any M2a/M2b/plans notices) in their UI language, until they dismiss it.
- Given the notice insert fails, when an account is deleted or a member removed, then the operation completes exactly as before.
- Given any deletion in the RLS suite, when the residue scan runs, then no column holds the departed person's id, email or display name, and the living user's name is found.
- Given a recipient with a push subscription, when the notice is recorded, then one push in their stored language is sent after the response, and the daily cron retries a deferred or failed one for 7 days.

## Spec Change Log

- **2026-11-25, review 1 (blind hunter, edge-case hunter and verification gap; all three found the HIGH one independently).**
  - **Trigger:** notices were recorded by `prepare_account_deletion` BEFORE `admin.deleteUser`. A REFUSED deletion therefore left, and pushed, "Its creator deleted their account" while the creator still existed. The same applied to removal: the reassign recorded "a member was removed" before the membership delete, which could still fail. That breaks the claims rule.
  - **Amended:**
    - Deletion notices are STAGED in `private.pending_account_notices` (keyed by the departing user, FK ON DELETE CASCADE). A BEFORE DELETE trigger on `auth.users` publishes them inside the deletion's own transaction, behind a savepoint. A refused deletion rolls the publication back with it.
    - Removal becomes ONE transaction, `public.remove_household_member` (move + membership delete), so its notices commit only with the removal. The old 2-arg wrapper records no notices.
    - Both routes schedule the push only after SUCCESS. That also closes the unauthorised-request scan.
  - **Known-bad state avoided:** a notice claiming a deletion or removal that did not happen.
  - **KEEP:**
    - kind/cause/params with no text and no departed person in `account_notices`;
    - the savepoint writer;
    - claim-then-send;
    - the shared `noticeMessage` mapping;
    - the card, the routes' `after()`, and the cron retry;
    - every existing test's intent.
  - **Also patched from the review:**
    - the texts claim only what the code knows: seniority only when every candidate has a join date; "a household member" only when the recipient shares the household; and on removal the reader is the remover;
    - delivery: newest first, at most 100 per run, the renderable ones filtered before the cap, fail-closed on the language lookup, dismissal re-checked before sending, a bounded push length, an `onError` on the translator;
    - a second retry slot in the 02:00 UTC cron;
    - dismissal revalidates;
    - the card's a11y (named buttons, focus after dismissal), plus an `Intl.ListFormat` fallback;
    - FK indexes;
    - the residue scan now also covers the `private` schema;
    - test gaps: the push language from the file, the selected columns, sorted and distinct names, the dashboard mount.

## Design Notes

- **A notice exists only if its event happened.**
  - Deletion notices are staged by `prepare` and published by the `auth.users` BEFORE DELETE trigger, in the deletion's own transaction.
  - Removal notices commit in the same transaction as the membership delete.
  - Either way, a savepoint keeps a failed notice from ever failing the event, and the push runs after the response, via `after()`.
  - The departing person's id is held only in the staged row, which goes with their auth row. `account_notices` never holds it.
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

**Evidence (local, 2026-11-25, after review 1):**
- `npm run verify` -- `verify: OK - every runnable step of the CI test job passed`, with `Tests:       83 skipped, 2914 passed, 2997 total` and coverage at 64.12%.
- `npm run test:order` -- `ok: 2914 tests ran, in the pinned order 20261029`.
- RLS (full) -- `Test Suites: 14 passed, 14 total`, `Tests:       83 passed, 83 total`.
- `next build` -- `Compiled successfully`.
- **Compatibility, old code × new schema:** main (`ed5147a`), full RLS suite, against the local DB with this migration applied: `Test Suites: 14 passed, 14 total`, `Tests:       77 passed, 77 total`.
- **Database mutants, 19 of 19 red, each on its own test,** with every mutant applied to the local DB and the original re-applied:
  - publishing without staging (a refusal would tell people anyway);
  - no publication trigger;
  - the publication savepoint removed. It first SURVIVED: test 15 forced both tables, so nothing was staged and the trigger had nothing to publish. Test 15 was split into two phases, and it is now red;
  - the writer savepoint removed;
  - a non-atomic removal;
  - seniority always claimed;
  - "household member" always claimed;
  - copied names not distinct;
  - the display name or id leaked into a notice (caught by the residue scan);
  - a reused category reported as a copy;
  - a notice for an unrenamed category;
  - the wrong removal cause;
  - client EXECUTE on the writer;
  - an open read policy;
  - clients reading the staged notices;
  - the new owner not told;
  - the scan skipping `private`;
  - test 15's control forcing nothing.
- **App mutants, 34 of 34 red on the final code (A1-A23, A26-A33, H1-H3):**
  - delivery: the language; the message file; the claim; the release; the cap; render before cap; the dismissal re-check; the clip; the translator error; the language fail-closed; newest first;
  - endpoints: dismiss scope; GET 500; GET columns;
  - routes: no scheduling on success, scheduling on refusal, and scheduling before authorisation, for both routes;
  - `removeMember` atomicity;
  - the crons: digest slot, digest guard, 02:00 slot;
  - the card cap, focus, and the button description;
  - the dashboard mount;
  - the mapping: seniority, shared household, cause, `ListFormat`;
  - the bg placeholder;
  - the hook (H1-H3): a refused dismissal un-hidden; the hidden set used; the cache refreshed.

  A24 and A25 targeted the SWR rollback that was REPLACED: they first survived, and a new in-flight test then showed a real race, where a refetch landing while an earlier dismissal was pending brought that notice back. The hook now keeps a per-id hidden set.
- **Browser (dev server, QA account, `/api/notices` intercepted, `reachedServer: []`):** en and bg rendered, with list formatting, plurals, priority order, the removal text, dismissal, and focus moving to the next notice. The cached fixture was removed afterwards and the cookie restored.
