---
title: 'A refused account deletion says, in the reader''s language, what it changed'
type: 'bugfix'
created: '2026-11-20'
status: 'done'
baseline_commit: 'd60e9d24736df06eff3c2098b5473bc951d084c5'
review_loop_iteration: 1
context:
  - '{project-root}/docs/api-conventions.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When `admin.deleteUser` refuses after `prepare_account_deletion` ran, the deletion dialog shows a raw English technical error ("Failed to delete user account: Database error deleting user"). The person is not told that the preparation's writes still stand: the household may now belong to someone else, and their shared categories, budgets and goals may now belong to the owner.

**Approach:** PR 1 of 2 (split by Niki, 2026-11-20). The dialog shows a translated message, built from a code and live parameters, choosing the variant that is TRUE for what the preparation reported. Nothing is stored, and there is no migration. PR 2 (the notice system) is `spec-account-deletion-notifications.md`.

## Boundaries & Constraints

**Always:**
- Claim "your account was not deleted" only after confirming that the auth user still exists.
- Pick the variant from `prepare_account_deletion`'s own result (`ownership_transferred`, `shared_objects_moved`), never from a second computation.
- Resolve names through the person's own session (RLS), naming members as the household page does (by email).
- en/bg parity, including ICU argument names, is enforced by CI.

**Ask First:** any text change.

**Never:** a stored row; a new migration; showing a server `message` or `details` string for a 500.

**Texts** (settings namespace, en / bg). ✅ approved by Niki; ⏳ PROPOSED, needed because the approved two are false whenever shared objects moved (in production that is both people in the only shared household, with 9 and 1 shared categories). They ship only with Niki's yes.
- ✅ `deletionRefusedUnchanged`: "Your account was not deleted and nothing was changed. Please try again." / "Акаунтът ви не беше изтрит и нищо не е променено. Моля, опитайте отново."
- ✅ `deletionRefusedTransferred`: "Your account was not deleted. Before the deletion stopped, {household} passed to {newOwner}, who is now its owner. You remain a member, and nothing else changed. You can try again." / "Акаунтът ви не беше изтрит. Преди изтриването да спре, домакинството {household} беше прехвърлено и сега {newOwner} е негов собственик. Вие оставате член и нищо друго не е променено. Можете да опитате отново."
- ⏳ `deletionRefusedTransferredShared`: "Your account was not deleted. Before the deletion stopped, {household} passed to {newOwner}, who is now its owner. The shared categories, budgets and goals you created in it now belong to the new owner too. You remain a member, and nothing else changed. You can try again." / "Акаунтът ви не беше изтрит. Преди изтриването да спре, домакинството {household} беше прехвърлено и сега {newOwner} е негов собственик. Общите категории, бюджети и цели, които създадохте в него, също вече принадлежат на новия собственик. Вие оставате член и нищо друго не е променено. Можете да опитате отново."
- ⏳ `deletionRefusedShared`: "Your account was not deleted. Before the deletion stopped, the shared categories, budgets and goals you created in {household} passed to its owner, {owner}. You remain a member, and nothing else changed. You can try again." / "Акаунтът ви не беше изтрит. Преди изтриването да спре, общите категории, бюджети и цели, които създадохте в домакинството {household}, бяха прехвърлени към неговия собственик {owner}. Вие оставате член и нищо друго не е променено. Можете да опитате отново."

## I/O & Edge-Case Matrix

| Scenario | State after prepare | Response / dialog |
|---|---|---|
| Refused, nothing moved | transferred=false, moved=0; user still exists | 500 `code: ACCOUNT_NOT_DELETED`, `outcome: unchanged` -> Unchanged |
| Refused after transfer | transferred=true, moved=0 | `outcome: transferred` + household, owner -> Transferred |
| Refused after transfer, shared moved | transferred=true, moved>0 | `outcome: transferredShared` -> TransferredShared |
| Refused, member's shared moved | transferred=false, moved>0 | `outcome: shared` -> Shared |
| Auth error, but the user is gone | getUserById: not found | deletion succeeded: 200 as normal, warn logged |
| Refusal not confirmable | getUserById errors | 500, no code -> `accountDeleteFailed` |
| Prepare fails, or its result is malformed | rpc error / unexpected shape | 500, no code -> `accountDeleteFailed` |
| Names unresolvable | refusal confirmed, the name lookup fails | 500, no code -> `accountDeleteFailed`, warn logged |
| Wrong password / missing password | 401 / 400 | unchanged (pre-existing `details` text) |

</frozen-after-approval>

## Code Map

- `src/lib/services/settingsService.ts:331-360` -- `deleteUserAccount`. prepare's `data` is discarded today; the authError branch throws a generic Error.
- `supabase/migrations/20261119100000_prepare_account_deletion.sql:120-147,215-220` -- FROZEN. prepare transfers ownership THEN calls `reassign_member_shared_objects`, which moves the departing person's shared categories/budgets/goals to the (new) owner, so after a transfer `moved` counts the creator's own shared objects. Returns `{ownership_transferred, shared_objects_moved, categories_copied, rows_repointed}`. Step (c) only changes OTHER users' rows.
- `src/app/api/user/account/route.ts:129,152` -- the only caller; its catch returns 500 with `error.message` in `details`. It holds the user's session client (`supabase`).
- `src/lib/services/householdMemberService.ts:39-61` -- the member list: `household_members` -> `rpc('household_members_list', {p_household_id})`, rows `{user_id, email, role}`. The household page names members by email (`HouseholdMembers.tsx:83`).
- `src/components/settings/sections/DangerZoneSection.tsx:33-35` -- throws `data.error?.details`; `ConfirmDeleteModal.tsx:62-66` shows `err.message` in an Alert and stays open.
- `jest.setup.js:131-158` -- the next-intl mock: flat keys only, `{k}` replaced once. Use flat keys. Real ICU rendering for both locales: `createTranslator` from `use-intl/core`.
- `src/i18n/__tests__/translations.test.ts:42` -- key parity only. 115 en strings already carry ICU arguments (13 plurals, no select), and en/bg mismatches today = 0. `@formatjs/icu-messageformat-parser` is not hoisted, so use a small local parser.
- `src/lib/test-utils/__tests__/account-deletion.rls.test.ts` -- helpers `makeUser`, `household`, `category`, `db()`, `signInAsTestUser` (rlsClient). Real `deleteUserAccount` via `pinAppServiceRoleToLocalStack`.

## Tasks & Acceptance

**Execution:**
- [x] `src/types/accountDeletion.types.ts` (NEW) -- the shared contract: `ACCOUNT_NOT_DELETED`, `RefusalOutcome`, `DeletionRefusedBody`. It is server- and client-safe.
- [x] `src/lib/services/accountDeletionRefusal.ts` (NEW) -- `AccountDeletionRefusedError {ownershipTransferred, sharedObjectsMoved}`; `readPreparedChanges` (null for any unrecognised shape); `refusalOutcome`; and `resolveRefusalNames(client, userId)`, which returns `{household, owner} | null` and never throws.
- [x] `src/lib/services/settingsService.ts` -- `deleteUserAccount`:
  - reads prepare's result; an unrecognised one is only logged and never blocks the deletion.
  - On authError:
    - an unknown outcome (status 0, 502+, `AuthRetryableFetchError`, no status) -> a generic Error, with no check;
    - otherwise `admin.getUserById`:
      - `code: user_not_found` -> warn and return true;
      - the same user present + changes read -> Refused;
      - anything else -> warn and a generic Error.
- [x] `src/app/api/user/account/route.ts` -- `AccountDeletionRefusedError` -> 500 `{error:{message, code:'ACCOUNT_NOT_DELETED', outcome, household?, owner?}}`; `outcome` other than `unchanged` without names -> 500 without a code. Other 500s: `details` is no longer the raw error message.
- [x] `src/components/settings/deletionRefusalMessage.ts` (NEW) -- `deletionFailureMessage(t, status, body)`:
  - 5xx: code + outcome -> the four keys (exhaustive over `RefusalOutcome`), anything else -> `accountDeleteFailed`;
  - 4xx: `details`, or `accountDeleteFailed` when there are none.
  
  `DangerZoneSection.tsx` uses it. It also:
  - shows `accountDeleteFailed` for a network failure and for a 2xx without `data.success === true`;
  - revalidates every SWR key (`useSWRConfig().mutate(() => true)`) after a refusal whose outcome is not `unchanged`.
- [x] `messages/en.json`, `messages/bg.json` -- the four keys above; and the three `categories.*Success*` toasts' `'{name}'` -> `''{name}''` (they rendered a literal "{name}").
- [x] `src/i18n/__tests__/translations.test.ts`:
  - every message parses;
  - en and bg have identical `name:type` argument sets per key, nested plural branches included;
  - plurals need `other`;
  - a quoted placeholder throws.
  
  Must-finds: the refusal keys' arguments, a nested plural argument, >10 plurals, a count > 100, and each rejection.
- [x] Tests, where each guard is mutation-tested and the red state is recorded under Verification:
  - settingsService: each branch above.
  - route: each outcome, plus missing names.
  - the mapping: the chosen key for every case, and the EXACT text under real ICU in en and bg.
  - DangerZoneSection: the dialog text, revalidation, a network failure, an unreadable 2xx.
  - RLS: a REAL refusal (a temp `REFERENCES auth.users ON DELETE RESTRICT` table, dropped before and after) for:
    - a creator with a shared category (both flags);
    - a plain member with a shared category (`shared`);
    - a user in no household (`unchanged`).
    
    Plus the DB state, names through each person's session, and GoTrue's real not-found shape.

**Acceptance Criteria:**
- Given a refusal confirmed by `getUserById`, when the dialog renders in bg or en, then it shows the variant that matches prepare's flags, from that language's file, with the household and owner filled in.
- Given any 5xx from the delete route, when the dialog renders, then no server `message` or `details` string is shown.
- Given en and bg, when CI runs, then any key whose ICU argument names differ fails the build.

## Spec Change Log

- **2026-11-20, review 1 (blind hunter, edge-case hunter, verification gap).**
  - **Triggers:**
    - the Tasks disagreed with the code (module location; whether an unrecognised prepare result throws);
    - a bare 404 read as "deleted";
    - a gateway or timeout auth error could be claimed as "not deleted" while the delete still commits;
    - an unreadable 2xx showed the success toast;
    - an offline failure showed "Failed to fetch";
    - the client imported a server module;
    - stale SWR data after a refusal;
    - the ICU check missed type changes, a missing `other`, `''` in quotes, and quoted placeholders. The last of these was live: three category toasts rendered "{name}".
  - **Amended:** the Tasks above.
  - **Known-bad states avoided:** "deleted" on a proxy 404, and "not deleted" for an outcome nobody knows.
  - **KEEP:**
    - the four outcomes are read from prepare's own result;
    - names come from the person's own session;
    - nothing is stored;
    - the real-ICU render runs in a child process.

## Design Notes

- **Status 500, not 409.** The request was valid and the server could not finish it. The dialog keys on `error.code`, not on the status.
- **An unrecognisable prepare result never blocks a deletion.** It only means that a later refusal cannot be described, so that refusal gets `accountDeleteFailed` (matrix row "Prepare fails, or its result is malformed").
- **Names come from the person's session** (`household_members` -> `households` -> `household_members_list`), so RLS limits them to what the household page already shows. The owner's email is what that page lists.
- **Why not the next-intl mock for rendering.** It replaces `{k}` naively. `deletionRefusalMessage.test.ts` instead formats the chosen key with use-intl's real `createTranslator` in a child Node process, because use-intl is ESM-only and Jest on Node 22 cannot require it.

## Verification

**Commands:**
- `npx tsc --noEmit`, `npm run lint` -- expected: 0 errors.
- `npm run test:order`, then `bash scripts/ci/assert-test-run.sh` -- expected: `ok: N tests ran`.
- `npm run test:rls` (full) -- expected: `Test Suites: 14 passed`, all tests passed.
- `npm run build` -- expected: success.

**Evidence (local, 2026-11-20, after review 1):**
- `tsc` exit 0. Lint: `files linted: 655   errors: 0   warnings: 0 (max 0)`.
- `Tests:       77 skipped, 2807 passed, 2884 total`, and `ok: 2807 tests ran, in the pinned order 20261029`.
- RLS (full): `Test Suites: 14 passed, 14 total` and `Tests:       77 passed, 77 total`.
- `next build`: `✓ Compiled successfully`.
- **Mutants: 25 of 25 red, each on the test that names the guard. Every file was restored byte-identical.**
  - Service:
    - S1, no getUserById: 8 failed;
    - S2, a bare 404 read as deleted: `a bare 404 ... is NOT read as "deleted"`;
    - S3, an unrecognised result blocks the deletion: 4 failed, incl. `never blocks a deletion that succeeds`;
    - S4, an unknown outcome claimed: the 4 `UNKNOWN outcome` cases.
  - Module:
    - M1, `moved >= 0`: `reads the two flags`;
    - M2, outcomes swapped: 2 failed;
    - M3, the person still owning it: `flags and database disagree`.
  - Route:
    - R1, names looked up for `unchanged`: `no names are looked up`;
    - R2, raw details back: `details are not the raw error`.
  - Mapping:
    - C1, a named text without names: 3 failed;
    - C2, 4xx as 5xx: `a 4xx with details`;
    - C3, the 4xx fallback in English: 6 failed, incl. the key check.
  - Dialog:
    - D1, an unreadable 2xx as success;
    - D2, the network failure's raw text;
    - D3, no revalidation;
    - D4, revalidation on `unchanged`.
    
    Each fails its own test.
  - Language check:
    - T1, bg `{household}` -> `{hh}`: the parity test, and (T1b) the real-ICU bg render;
    - T2, a blinded parser: 2 failed;
    - T3, plural branches skipped: the nested must-find;
    - T4, quoted placeholders allowed;
    - T5, types ignored;
    - T6, `other` not required;
    - T7, a REAL bg plural made plain: the parity test;
    - T8, a category toast re-quoted: 2 failed.
  - RLS:
    - RL1, the blocker set to CASCADE: test 11, `Received value: true` (the deletion went through);
    - RL2, the service reading `categories_copied`: test 11, `sharedObjectsMoved: false` where the database shows the move.
- **Browser (dev server, QA account, every DELETE answered by a route intercept, `reachedServer: []`, deliberately wrong password).** The dialog rendered, verbatim:
  - **en, transferredShared:** "Your account was not deleted. Before the deletion stopped, Вкъщи passed to owner@example.test, who is now its owner. The shared categories, budgets and goals you created in it now belong to the new owner too. …";
  - **bg, the same outcome:** "Акаунтът ви не беше изтрит. Преди изтриването да спре, домакинството Вкъщи беше прехвърлено и сега owner@example.test е негов собственик. …";
  - **bg, shared, unchanged and generic:** the matching texts, with "Неуспешно изтриване на акаунта" instead of the raw error.
  
  Console: only the 5 intercepted 500s and the component's own `console.error`. Afterwards the stored language was still "en" and the cookie was restored to "en".
- **Real ICU, the fixed toasts:** `Category 'Храна' created successfully` / `Категория 'Храна' е създадена успешно` (before the fix: `Category {name} created successfully`).

## Suggested Review Order

**The claim: "your account was not deleted" only when verified**

- Entry point: a refusal is described only after getUserById confirms the user still exists.
  [`settingsService.ts:371`](../../src/lib/services/settingsService.ts#L371)

- A gateway/no-response error has an unknown outcome, so it is never claimed.
  [`settingsService.ts:414`](../../src/lib/services/settingsService.ts#L414)

- The four outcomes come from prepare's OWN result, never recomputed.
  [`accountDeletionRefusal.ts:49`](../../src/lib/services/accountDeletionRefusal.ts#L49)

- Outcome choice: the approved texts are only true when nothing shared moved.
  [`accountDeletionRefusal.ts:59`](../../src/lib/services/accountDeletionRefusal.ts#L59)

**The response: a code plus live names, nothing stored**

- Names through the person's own session; RLS bounds them to the household page's view.
  [`accountDeletionRefusal.ts:79`](../../src/lib/services/accountDeletionRefusal.ts#L79)

- The route maps a confirmed refusal to code + outcome; names missing means generic.
  [`route.ts:192`](../../src/app/api/user/account/route.ts#L192)

- The shared contract, safe for both server and client.
  [`accountDeletion.types.ts:8`](../../src/types/accountDeletion.types.ts#L8)

**The dialog: translated, never the server's English**

- Code -> key, exhaustive over the outcomes; 4xx keeps its details.
  [`deletionRefusalMessage.ts:36`](../../src/components/settings/deletionRefusalMessage.ts#L36)

- Network failure, an unreadable 2xx, and the SWR revalidation after a refusal that moved data.
  [`DangerZoneSection.tsx:43`](../../src/components/settings/sections/DangerZoneSection.tsx#L43)

- The four texts (two still awaiting Niki's yes).
  [`en.json:643`](../../messages/en.json#L643)

**The language check**

- The ICU parser: name:type pairs, nested plurals, 'other' required, quoted placeholders rejected.
  [`translations.test.ts:48`](../../src/i18n/__tests__/translations.test.ts#L48)

- The live bug it caught: the category toasts rendered a literal "{name}".
  [`en.json:479`](../../messages/en.json#L479)

**Tests**

- A REAL refusal (RESTRICT blocker) for creator, plain member and loner, plus GoTrue's real not-found shape.
  [`account-deletion.rls.test.ts:1107`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L1107)

- Exact text under the real ICU engine, rendered in a child Node process.
  [`deletionRefusalMessage.test.ts:37`](../../src/components/settings/__tests__/deletionRefusalMessage.test.ts#L37)
