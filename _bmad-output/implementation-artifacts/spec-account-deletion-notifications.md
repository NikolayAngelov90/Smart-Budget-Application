---
title: 'Tell people what an account deletion changed for them'
type: 'feature'
created: '2026-11-20'
status: 'draft'
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

## Plan

**To be re-derived at PR 2's plan step.** The earlier draft plan was removed on 2026-11-20 because it predated Niki's decisions and PR 1. It had:
- an `expires_at` column, which Niki dropped;
- no goals/budgets notices and no `removeMember` notices;
- the refused-deletion dialog work, which PR 1 (`spec-account-deletion-refused-message.md`) shipped differently, as a 500 with `code` + `outcome` and the `settings.deletionRefused*` keys, plus the ICU parity test.

Carry forward from the investigation (2026-11-20, read-only):
- push reaches 1 of 3 production users (2 devices);
- there is no email channel;
- `dispatchCategorizedPush` is the single push gate, and `notification_deliveries` is a marker table with no payload, so notices need their own table;
- the daily `weekly-digest` cron is the only place a push retry can ride (two crons max on this plan);
- the dashboard's one-shot card mount is at `src/app/dashboard/page.tsx` (the `FeatureIntroCard`/`ReengagementSummary` pattern);
- `prepare_account_deletion` and `reassign_member_shared_objects` (FROZEN migration 20261119100000) return counts only, so a NEW migration must make them report who got what;
- every existing push title is hardcoded English (on the board).
