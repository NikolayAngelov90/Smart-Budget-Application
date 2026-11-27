---
title: 'A refused deletion: every real change it made is told neutrally, not only the household'
type: 'feature'
created: '2026-11-26'
status: 'in-review'
baseline_commit: 'b71e0a701b3e349403808647b03db6e5b108c1b0'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-refused-deletion-notice.md'
  - '{project-root}/docs/api-conventions.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** #109 tells a refused deletion's household transfer neutrally. The attempt's OTHER changes stay staged: shared categories moved to the owner and renamed, copies made for people who used the person's categories, and shared goals or budgets moved to the owner. They are real after a refusal, but they are told only if a retry succeeds, so with no retry nobody ever learns of them. Niki, 2026-11-26: the same treatment for these, as a separate story after #109.

**Approach:** On the CONFIRMED refusal (#109's call site, same condition), withdraw ALL of the person's staged notices and write NEUTRAL variants under NEW kinds, claiming only what changed and nothing about a deletion. Prove with a test what a later successful retry produces (Niki expects nothing for these: the preparation finds nothing left to move). Use #108's release order if a migration is needed.

## Boundaries & Constraints

**Always:**
- Publish only on #109's confirmed refusal: an outcome-known auth error, and `getUserById` finds the same user with no error. Never on an unknown outcome.
- Each staged row is withdrawn and its neutral notice written atomically, and only if the withdrawal took the row.
- New kinds that older apps do NOT recognise, so they hide them rather than mis-show them (#109 review, HIGH).
- No person is named, in the text or in the params. The payload must not reveal what the text withholds.
- Every present-tense claim is checked true at the moment of writing; otherwise the row stays staged.
- Every failure is recorded at stage `refusal` and never raised; the refusal stands.
- en/bg parity holds. The Bulgarian strings go in the report for Niki.

**Ask First:** the texts (Niki decides them; see Design Notes). Applying the migration to production (Niki's yes for the exact SHA).

**Never:**
- Edit the frozen migrations 20261125100000 and 20261126120000.
- Change what a SUCCESSFUL deletion or a removal publishes.
- Make the refusal answer wait more than #109's 3 s cap.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Refused creator | staged: transfer, rename, copy, plans | 4 neutral notices; 0 staged | N/A |
| Retry succeeds, nothing new | after the above | no new notice for anyone | N/A |
| Retry succeeds, something new | the member uses another of the person's categories after the refusal | exactly one `categories_copied`/`account_deleted`, for the new name only | N/A |
| Claim false now | owner changed, recipient not admin / not a member, renamed category gone, a copy renamed, the moved plans gone | that row is WITHDRAWN and told to no one (corrected in review 1, see the Change Log); the others are published; a later successful deletion tells nothing more | no marker (not a failure) |
| One write fails | a forced CHECK on one kind | the others are published; that row stays staged | marker (refusal, kind, sqlstate) |
| One household row locked | another session holds it | that household's rows recorded 55P03 after ONE wait; kept staged; the copies are still published | marker per row |
| The person's deletion in flight | auth row held | nothing published; all staged | marker (refusal, NULL, 55P03) |
| Failure log missing too | with any failure above | the call still returns cleanly | WARNING only |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261125100000_account_notices.sql` -- FROZEN. Staging writers: `move_member_shared_objects` (category_renamed {household,from,to} only when RENAMED; shared_plans_received {household,goals,budgets}; recipient = owner), `prepare_account_deletion` (household_transferred; categories_copied {categories[],shared_household}, household_id NULL, recipient = each user whose rows referenced the person's categories). `remove_household_member` takes `households FOR UPDATE`.
- `supabase/migrations/20261126120000_refused_deletion_notice.sql` -- FROZEN. `publish_refused_deletion_notices(uuid)`: household only. Its outer EXCEPTION block wraps the loop, so a mid-loop catch rolls back notices already written, while `v_published` still counts them. That contradicts its comment "what this call already published stands". Benign (withdrawals roll back with their notices; the app ignores the count), but the new function must not repeat it.
- `src/lib/services/settingsService.ts:388-461` -- confirmed-refusal call `publishRefusedDeletionNotices` -> `rpc('publish_refused_deletion_notices')`, capped at `REFUSED_NOTICE_TIMEOUT_MS`.
- `src/lib/accountNotices/noticeMessage.ts` -- kind/cause types, `NOTICE_PRIORITY`, `noticeMessage` (unknown kind -> null). Used by the card (`AccountNoticesCard.tsx:39`) and the push (`accountNoticeService.ts:75`): an unknown kind is hidden and skipped, never marked delivered.
- `messages/{en,bg}.json` `accountNotices` -- texts. `category_renamed`'s existing text never mentions a deletion; only its stored cause would be false.
- `scripts/account-notice-health/check.sh:58` -- the meaning of 'refusal' names only "the new owner".
- `src/lib/test-utils/__tests__/account-deletion.rls.test.ts` -- test 11 (1232: refusal + retry through the real service), 16 (function list ~1728), 20 (the old function; stays), helpers `noticesFor`, `stagedFor`, `failuresSince`, `dbNow`, `goal`, `category`, `tx`, `prepare`, `hold` (2208, returns `{ done }`).
- `src/lib/accountNotices/__tests__/{noticeMessage,noticeTexts.icu}.test.ts`, `src/lib/services/__tests__/settingsService.test.ts:550` (`PUBLISH` constant).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261126210000_refused_deletion_changes.sql` -- one ALTER widening both CHECKs (kinds `shared_plans_now_yours`, `shared_category_renamed`, `category_copies_made`; cause `copies_made`); a NEW function `public.publish_refused_deletion_changes(uuid)`, service_role only -- additive, apply-first, so old code is untouched and a rollback keeps #109's behaviour.
- [x] `src/lib/services/settingsService.ts` -- call the new function at the same site -- one call tells everything.
- [x] `src/lib/accountNotices/noticeMessage.ts`, `messages/{en,bg}.json` -- 3 kinds, the cause, priority, mapping, 6 keys.
- [x] `scripts/account-notice-health/check.sh` (+ its test if the text is pinned) -- 'refusal' covers every neutral notice.
- [x] Tests: RLS test 11 (4 neutral at the refusal; the retry adds nothing); 11b (the retry's must-find); test 21 (the new function, every matrix row, privileges); test 16's list; unit tests for mapping, ICU rendering and the service's rpc name.
- [x] Board: drop `publish_refused_deletion_notices` once no deployed code calls it; #109's rollback-comment error.

**Acceptance Criteria:**
- Given main b035f1d's code, when its full RLS suite runs on the new schema, then it passes and no new-kind notice is written.
- Given each guard, when it is mutated, then the test expected to kill it fails, with the red state recorded.

## Spec Change Log

- **2026-11-27, review 1** (blind hunter, edge-case hunter, verification gap; on the diff from b71e0a7).
  - **Finding (blind hunter + edge-case hunter, independently):** a row whose claim is false now stayed staged, so a later successful deletion would publish it unchecked, with its deletion text: a known-false claim (e.g. "the household passed to you" to someone who no longer owns it). **Amended:** the matrix row I wrote ("that row stays staged") contradicted Niki's own words ("withdraw ALL of the attempt's waiting notices ... claiming only what changed"). It is corrected to his wording: every staged row is withdrawn, and only a claim true now is told. Niki may reverse this at his yes. **Known-bad state avoided:** a stale or false notice published long after the refusal.
  - **Also fixed:**
    - one wait per locked household, not per row (the 3 s cap held with several rows), with the rows of an attempt taken in a fixed kind order;
    - the copies list only the names still owned as PERSONAL categories (a shared same-name category or a renamed copy no longer counts), and nothing is told with none left;
    - the plans claim also requires that the recipient holds shared plans there; the rename claim requires membership;
    - the plans params carry only the household (the staged counts could be stale and no text uses them);
    - a CHECK pairs each kind with its cause (`account_notices_kind_cause_check`), and the app mapping fails closed on a deletion kind with any other cause;
    - `RESET lock_timeout` at the end of the migration;
    - the health check explains the new failure shapes;
    - the hold helper ends its session if it fails early;
    - test 21 (6) proves the race through `pg_blocking_pids`, not timing;
    - new tests: two copied names with one renamed, a shared same-name category, the moved goal deleted, the later deletion telling nothing, the kind/cause pairs, and the push rendering every neutral kind.
  - **Rejected:**
    - locking the member and category rows a claim reads (edge-case hunter): tried, then removed. The per-household skip masks such locks (a skipped row never reaches its own lock, so no test can see one go missing), and a lock on one category row would lock its whole household out. The household row stays locked FOR SHARE, as in #109; a role change or a rename committed in the milliseconds between the check and the commit is accepted, since the claim was true when checked;
    - `NOT VALID` for the CHECK swap: the table is tiny, and validating in the same transaction would not shorten the lock;
    - falling back to #109's function when the new one is missing: the release order excludes it, and a failed call keeps every row staged;
    - extra params checks: the staging writers always set them, and `households.name` / `categories.name` are NOT NULL.
  - **KEEP:** a new function (expand/contract); the outer guard only before any write; plain types only; withdraw-before-write.

## Design Notes

**A new function, not a replacement:** expand now, contract later. Replacing #109's function would change what the deployed app does the moment the migration lands, writing kinds it hides and never pushes. The new function leaves old code exactly as it was.

**Per-row locks, not cursor locks:** under the outer guard, take the auth-row lock (serialised with the person's own deletion) and read only the staged rows' IDS into a `UUID[]`. Both come before anything is written, so a catch there records the failure and returns 0. Then, per id, in the row's own guarded block: re-read the row (gone means a parallel call took it: skip), check the claim with its household row locked `FOR SHARE`, withdraw, and write only if the claim holds. So one locked household loses only its own rows, after one wait. Plain types only: a table-row-typed variable would make the function fail to compile, and so raise outside every handler, if that table were missing.

**Claims checked:** household_now_yours (owner and admin); shared_plans_now_yours (still a member, and holds shared goals or budgets there); shared_category_renamed (still a member, and owns a category of that household with the `to` name); category_copies_made (lists only the names the recipient still owns as personal categories). Params: the household's CURRENT name; the copies carry only the listed names.

**Proposed texts (Niki decides):**
- plans: "Shared goals or budgets are now yours" / "They belonged to another member of {household}."
- rename: Niki's title, 'A shared category was renamed: "{from}" → "{to}"' / "It belonged to another member of {household} and is now yours. You already had a category with the original name."
- copies: "You now have your own copies of categories" / "You used someone else's categories ({categories}). Your entries point to the copies." ("now" dropped from the body: the title already says it.)

## Verification

**Commands:**
- `npm run test:rls`, with the local stack's credentials exported as `.github/actions/local-supabase` does -- expected: all suites pass.
- `npm run verify` steps, `npm run test:order`, `next build` -- expected: green.
- The mutation harness (scratch copies, sha256 check) -- expected: every mutant killed by its expected test.
- main b035f1d's RLS suite on the new schema -- expected: green, 0 new-kind rows.

**Results (local, 2026-11-27, after review 1):**
- Full RLS on a freshly reset stack: `Test Suites: 14 passed, 14 total` / `Tests:       93 passed, 93 total`.
- verify steps except `npm ci` (the VS Code Jest runner holds a file it needs): type-check, lint and format OK; `Tests:       93 skipped, 2981 passed, 3074 total`; coverage scope and threshold OK. `test:order`: the same tally. `next build`: compiled.
- Mutants: 41 of 41 killed by their expected test, the RLS ones in their expected case of test 21. The first run killed 35. Four were errors of mine, fixed and rerun: a harness pattern (D29) and a `test.each` title printing the wrong argument (A2-A4). Two were a real masking (D26, D27): a FOR UPDATE holder also blocks the notice's foreign-key check, so (5b/5c) now hold an uncommitted household RENAME, which only the claim's lock waits for.
- Old code x new schema: main b035f1d's full RLS suite on this migration: `Test Suites: 14 passed, 14 total` / `Tests:       91 passed, 91 total`. 0 new-kind notices were written. The 4 `refusal` failures recorded are exactly main's test 20 forced cases on #109's function: (3) 23514, (4) and (5) 55P03 with no kind, (7) 55P03 with its kind.

## Suggested Review Order

**The function: withdraw every staged row, tell only what is true now**

- Entry point: the one function the confirmed refusal calls; expand now, contract later.
  [`20261126210000_refused_deletion_changes.sql:144`](../../supabase/migrations/20261126210000_refused_deletion_changes.sql#L144)

- The outer guard holds only the auth-row lock and the id read, both before any write.
  [`20261126210000_refused_deletion_changes.sql:170`](../../supabase/migrations/20261126210000_refused_deletion_changes.sql#L170)

- Each claim per kind, under a FOR SHARE household lock; copies filtered to personal names.
  [`20261126210000_refused_deletion_changes.sql:228`](../../supabase/migrations/20261126210000_refused_deletion_changes.sql#L228)

- Withdraw first; write only if the claim holds and the row really was withdrawn.
  [`20261126210000_refused_deletion_changes.sql:269`](../../supabase/migrations/20261126210000_refused_deletion_changes.sql#L269)

- One wait per locked household; a failed withdrawal never locks the household out.
  [`20261126210000_refused_deletion_changes.sql:219`](../../supabase/migrations/20261126210000_refused_deletion_changes.sql#L219)
  [`20261126210000_refused_deletion_changes.sql:296`](../../supabase/migrations/20261126210000_refused_deletion_changes.sql#L296)

**Schema: the kinds, and which cause each may carry**

- A neutral kind can never carry a deletion cause, nor a deletion kind a neutral one.
  [`20261126210000_refused_deletion_changes.sql:68`](../../supabase/migrations/20261126210000_refused_deletion_changes.sql#L68)

**App: one call, and texts that claim nothing about a deletion**

- The confirmed-refusal site now calls the function that tells every change.
  [`settingsService.ts:397`](../../src/lib/services/settingsService.ts#L397)

- Neutral kinds map to their own keys; deletion kinds fail closed on any other cause.
  [`noticeMessage.ts:142`](../../src/lib/accountNotices/noticeMessage.ts#L142)
  [`noticeMessage.ts:108`](../../src/lib/accountNotices/noticeMessage.ts#L108)

- The six new strings (Niki decides the wording).
  [`en.json:1139`](../../messages/en.json#L1139)
  [`bg.json:1139`](../../messages/bg.json#L1139)

- What a 'refusal' failure means now, kinds and sqlstates included.
  [`check.sh:58`](../../scripts/account-notice-health/check.sh#L58)

**Tests**

- The real service, a real refusal, then a real retry that adds nothing.
  [`account-deletion.rls.test.ts:1272`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L1272)

- The retry's must-find: changes made after the refusal are told, and only those.
  [`account-deletion.rls.test.ts:1418`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L1418)

- The function, case by case: claims false now, failures, locks, the race, the pairing.
  [`account-deletion.rls.test.ts:2612`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L2612)
  [`account-deletion.rls.test.ts:2685`](../../src/lib/test-utils/__tests__/account-deletion.rls.test.ts#L2685)

- The exact rendered texts, with no deletion or removal wording in either language.
  [`noticeTexts.icu.test.ts:167`](../../src/lib/accountNotices/__tests__/noticeTexts.icu.test.ts#L167)

- The push renders every neutral kind (an unrenderable one would be skipped).
  [`accountNoticeService.test.ts:413`](../../src/lib/services/__tests__/accountNoticeService.test.ts#L413)
