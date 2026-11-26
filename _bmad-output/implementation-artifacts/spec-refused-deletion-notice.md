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

## Decisions (Claude: mechanics)

- **A migration IS needed** (checked read-only against production on 2026-11-26):
  - `private.record_account_notice` cannot be reached by the app: there is no EXECUTE for service_role, and `private` is not exposed.
  - The app could INSERT into `account_notices` (service_role has INSERT), but its `cause` CHECK allows only `account_deleted` and `member_removed`. Reusing `account_deleted` would store a false fact.
  - Discarding the staged transfer means a write to `private.pending_account_notices`, in the same transaction as the neutral notice.
- **The migration** (additive, apply-first; 20261125100000 stays frozen):
  - `account_notices.cause` gains `deletion_refused`;
  - a new function, `public.publish_refused_deletion_notices(uuid)`, service_role only.
- **What the function does, per staged `household_transferred` row of that person,** in ONE guarded block: write the neutral notice (kind `household_transferred`, cause `deletion_refused`, params `{household}`) AND delete the staged row, or neither. A failure is recorded (stage `refusal`), and the staged row is then kept.
- **Only when the text is true now:** the recipient still owns that household. Otherwise nothing is published and the staged row is left as it was. A person who no longer exists needs no check: their staged rows cascade away with their auth row. An "exists?" check could never change an outcome, so there is none (Rule 6).
- **Serialised with the person's own deletion:** the function first locks their auth row FOR NO KEY UPDATE, inside a guard. A deletion (which takes FOR UPDATE) therefore cannot publish the staged transfer in the window between "read" and "withdraw". A deletion already in flight makes the function give up after the 1 s lock_timeout; that is recorded, and the deletion tells the new owner truthfully, once.
- **When it runs:** the service calls it inside the existing CONFIRMED branch of `deleteUserAccount` (an outcome-known auth error, and `getUserById` finds the same user). It is best-effort: its failure never changes what the dialog says. It is never called on an unknown outcome, a "user is gone", or an inconclusive lookup.
- **Self-healing:** it acts on whatever transfer is still staged for that person. A transfer staged by an earlier attempt, whose confirmation failed, is published neutrally on the next confirmed refusal. A second refusal finds nothing staged and publishes nothing.
- **A later successful retry:**
  - the staged transfer is gone, so the trigger cannot publish "its creator deleted their account", and the new owner is told the transfer ONCE, neutrally;
  - the attempt's OTHER staged notices (renames, copies, moved plans) stay staged and publish on that successful retry, when "deleted their account" becomes true. Each change is told once, and only when its text is true.
- **Push:** the route schedules `after()` delivery on a confirmed refusal too, as a notice now exists. The daily crons retry, as for every notice.
- **Text:** the card shows a title and a body. Niki's two sentences are split, using his words only:
  - title `householdTransferredRefusedTitle`: "{household} is now yours" / "Домакинството {household} вече е ваше";
  - body `householdTransferredRefusedBody`: "You are its owner and admin." / "Сега вие сте собственик и администратор."
  - Read together, they are exactly his text.

## Tasks

- [ ] `supabase/migrations/20261126120000_refused_deletion_notice.sql`
- [ ] `noticeMessage.ts`: the `deletion_refused` cause and its keys. `messages/{en,bg}.json`: 2 keys.
- [ ] `settingsService.deleteUserAccount`: call the function in the confirmed branch only, best-effort.
- [ ] The account route: `after()` delivery on a confirmed refusal.
- [ ] Tests:
  - RLS test 11 (the refusal now tells the new owner neutrally; the retry tells the transfer once);
  - new RLS test 20 (the function: a deleted person; ownership changed; a contained failure keeps the staged row; privileges);
  - test 16's function list;
  - unit tests (service, route, mapping, real-ICU rendering).
- [ ] Mutants, old × new, three-layer review, then #108's release order.

## Verification

(filled in as the work lands)
