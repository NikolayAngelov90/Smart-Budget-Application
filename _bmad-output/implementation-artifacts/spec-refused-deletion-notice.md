---
title: 'A refused deletion still transferred the household: tell the new owner, neutrally'
type: 'feature'
created: '2026-11-26'
status: 'in-progress'
baseline_commit: 'e6302731f53ad7ba75592b5ffc563ca91946e934'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-account-deletion-notifications.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-account-deletion-refused-message.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

When an account deletion is refused AFTER `prepare_account_deletion` transferred the household, the transfer stands, but the new owner was never told. The deletion notices only publish if the deletion happens (#108). Niki, 2026-11-26: the new owner gets a NEUTRAL notice, in a small separate story:

> "{household} is now yours. You are its owner and admin." / "Домакинството {household} вече е ваше. Сега вие сте собственик и администратор."

It claims only the transfer, which really happened, and nothing about a deletion.

## Niki's conditions (2026-11-26)

1. Reuse the notice system. If the existing server-side writer can do it, no migration; check that first and say which it is. If a migration IS needed, use #108's release order and rule.
2. Publish only when the refusal is CONFIRMED (the account verifiably still exists), never on an ambiguous timeout. This is the same condition PR 1 uses for "not deleted".
3. The staged deletion notices of that refused attempt must not ALSO publish later: a successful retry would otherwise tell the new owner twice. Decide what a later successful retry does with them, and test it.
4. The Bulgarian strings go in the report for Niki.

</frozen-after-approval>

## Decisions (Claude: mechanics), as built after review 1

- **A migration IS needed** (checked read-only against production on 2026-11-26):
  - `private.record_account_notice` cannot be reached by the app: there is no EXECUTE for service_role, and `private` is not exposed.
  - The app could INSERT into `account_notices` (service_role has INSERT), but its kind and cause CHECKs allow neither a neutral kind nor a true cause.
  - Withdrawing the staged transfer means a write to `private.pending_account_notices`, in the same transaction as the neutral notice.
- **The migration** (additive, apply-first; 20261125100000 stays frozen):
  - ONE `ALTER TABLE` widens both CHECKs, with no `IF EXISTS` (both names verified in production): kind `household_now_yours`, cause `ownership_transferred`;
  - a new function, `public.publish_refused_deletion_notices(uuid)`, service_role only;
  - the apply waits at most 500 ms for its lock, so a deletion's notice publish never queues behind it.
- **Why a NEW KIND** (review 1, HIGH; blind hunter, edge-case hunter and verification gap): every app version before this maps `household_transferred` to "Its creator deleted their account..." whatever the cause. An open tab from before the deploy, or a rollback, would show the neutral notice as exactly that false claim. For an unknown kind those versions return no message. Checked at e630273: the card drops it, the push skips it, the mapping's `default: return null`.
- **Why cause `ownership_transferred`** and not `deletion_refused` (edge-case hunter): the recipient's API payload, persisted in their browser, must not reveal what the text withholds, namely that someone tried to delete their account.
- **What the function does,** under ONE outer guard:
  - it locks the person's auth row FOR NO KEY UPDATE, which serialises it with their own deletion and with a parallel call;
  - per staged `household_transferred` row of THAT person, whose recipient still OWNS and still ADMINISTERS the household (read FOR SHARE, so neither can change mid-call), ONE guarded block WITHDRAWS the staged row first, and writes the neutral notice, under the household's CURRENT name, only if a row really was withdrawn;
  - every failure (the lock, reading the rows, one notice) is recorded at stage `refusal`, and a failed notice keeps its staged row;
  - a person who no longer exists needs no check: their staged rows cascade away with their auth row.
- **When it runs:** the service calls it inside the existing CONFIRMED branch (an outcome-known auth error, and `getUserById` finds the same user with no error).
  - It is awaited, so the push after the response finds the notice, but capped at 3 s, so a slow database never delays the refusal answer.
  - It is best-effort: a failure never changes what the dialog says.
  - It is never called on an unknown outcome, a "user is gone", an inconclusive lookup, a different user, or the same user returned with an error.
- **Push:**
  - the route schedules `after()` delivery after an AccountDeletionRefusedError;
  - a confirmed refusal whose preparation result was unreadable publishes the notice but is answered with a generic error, so its push comes from the daily crons (02:00 / 09:00 UTC), not at once.
- **A later successful retry:**
  - the transfer was withdrawn, so it is told ONCE, neutrally;
  - the attempt's OTHER staged notices (renames, copies, moved plans) stay staged and publish on that successful retry, when "deleted their account" becomes true. This meets Niki's wording ("the staged deletion notices of that refused attempt must not ALSO publish later") literally only for the transfer; the edge-case hunter flagged it.
  - **DECIDED by Niki, 2026-11-26:** the same treatment for the others, in a SEPARATE small story after this one. The renamed or copied categories and the moved goals and budgets are real changes after a refusal; only the reason "deleted their account" is false, and holding them until a retry means nobody is told if no retry comes. That story: on a confirmed refusal, withdraw ALL of the attempt's staged notices and write neutral variants under NEW kinds (the old-client reason); test what a later successful retry produces (Niki expects nothing for these, because the preparation finds nothing left to move: verify, don't assume); Bulgarian strings for Niki; #108's release order if it needs a migration. This story is unchanged by that decision.
- **Text:** Niki's two sentences, split into the card's title and body, with his words only:
  - title `householdNowYoursTitle`: "{household} is now yours" / "Домакинството {household} вече е ваше";
  - body `householdNowYoursBody`: "You are its owner and admin." / "Сега вие сте собственик и администратор."
  - The rendered text is pinned to exactly that, in both languages.

## Spec Change Log

- **2026-11-26, review 1** (blind hunter, edge-case hunter, verification gap; the three ran on commit 601abc5 through git while mutants ran).
  - **HIGH:** the reused kind would be mis-rendered as "its creator deleted their account" by older app code. Fixed by the new kind.
  - **Also fixed:**
    - the cause no longer reveals the refusal;
    - the CHECK swap is one statement, with no `IF EXISTS`;
    - the apply's lock wait is 500 ms;
    - withdraw-then-tell, with a check that a row was withdrawn;
    - ownership and admin are read FOR SHARE, and the current household name is used;
    - an outer guard over the lock and the read;
    - the 3 s cap on the call;
    - per-stage meanings in the health check's text;
    - tests: person scoping, the household-row lock, concurrent withdrawal, a failed withdrawal, "record impossible" (both levels), the `await`, the cap, the `!lookupError` conjunct, the exact rendered strings, and two households (one failure loses only itself).
  - **To the board:**
    - RPC-level failures (network, timeout) are only logged, not recorded nightly, because the app cannot write the private failure log. The staged transfer then survives and is told on a successful retry.
    - Exotic chains (a household handed back and forth across refusals) can leave a stale staged transfer that #108's trigger publishes later. This is pre-existing (#108), already on the board as stale notices.
    - The present-tense neutral text can go stale if the household later changes hands; #108's texts share this.
    - Benign concurrency `refusal` markers (55P03) also turn the nightly check red, by design.
  - **Not tested, argued:** the serialisation's success path (the function first, a deletion arriving while it holds the lock). That holds by Postgres semantics: DELETE takes FOR UPDATE on the auth row before the BEFORE trigger fires. Withdraw-first makes it hold even if that ever changed.

## Tasks

- [x] `supabase/migrations/20261126120000_refused_deletion_notice.sql`
- [x] `noticeMessage.ts`: the `household_now_yours` kind (review 1 replaced the planned `deletion_refused` cause) and its keys. `messages/{en,bg}.json`: 2 keys.
- [x] `settingsService.deleteUserAccount`: call the function in the confirmed branch only, best-effort.
- [x] The account route: `after()` delivery on a confirmed refusal.
- [x] Tests:
  - RLS test 11 (the refusal now tells the new owner neutrally; the retry tells the transfer once);
  - new RLS test 20 (the function: a deleted person; ownership changed; a contained failure keeps the staged row; privileges);
  - test 16's function list;
  - unit tests (service, route, mapping, real-ICU rendering).
- [x] Mutants, old × new, three-layer review, then #108's release order.

## Verification

- Local: full RLS 14/14 suites, 91/91 tests; mutants 30/30 killed, each by its expected test; old code (main e630273) × new schema 14/14, 90/90.
- CI on 485a148: `Tests:       91 skipped, 2952 passed, 3043 total`; pinned order `ok: 2952 tests ran, in the pinned order 20261029`; RLS `Tests:       91 passed, 91 total`.
- **APPLIED to production on 2026-11-26** from `485a1484fad1b3b634ce71f07fe2f5f98bd4d73f`, on Niki's yes for sha256 `84a8e6781d780a5310e14ca18f88475431118853f14bc1acdc95caaf9b1a0034` (asserted, with the blob and a clean tree, in the same command as the push). The migration file is now FROZEN.
  - Dry run listed only `20261126120000_refused_deletion_notice.sql`.
  - Before → after: the two CHECKs gained `household_now_yours` / `ownership_transferred`; the function appeared with EXECUTE for service_role only (ACL `postgres=X/postgres,service_role=X/postgres`); ledger 49 → 50. 22 of 31 snapshot rows unchanged.
  - All 9 function definitions (owner, definer, config, md5) identical to the local stack the full RLS suite ran on, rebuilt from 485a148.
  - Ledger matches the repo one-for-one, 50/50.
  - Drift run 45883950221 on this branch: `hard failures : 0`, `pending : 0`, `DRIFT CHECK PASSED.`
  - schema_reader can execute only `public.account_notice_failure_summary()`, holds 0 relation privileges, no USAGE on `private`. No client EXECUTE on any notice function; no client writes on the three notice tables. 0 rows of the new kind; no unacknowledged failures.
