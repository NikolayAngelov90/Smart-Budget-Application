---
baseline_commit: 1515d55
source: deferred-work.md (15-3) — decided in dw-5-product-decisions.md #2
---

# Story DW-6: Shared-goal contributors earn the goal achievements

Status: done

## Story

As a household member who helped reach a shared goal,
I want the goal achievements to unlock for me too,
so that contributing counts, not just being the person who created the goal.

## Decision

**Contributors earn them** (DW-5 #2, decided 2026-07-30). Anyone who contributed
to a shared goal that reaches its target unlocks `first_goal` and `goal_reached`.

The two alternatives were rejected: creator-only is what makes the feature feel
unfair, and separate "team" achievements would mean new catalogue content, copy
and icons for a problem that is really about scoping.

## Problem

`/api/gamification/score` scopes goals with `.eq(user_id)`. That was a deliberate
Story 15-2 choice — gamification data is personal, so a member should not see
progress driven by someone else's private goals.

For **shared** goals (Story 13-9) it produces the wrong result. Two people save
into one goal, it completes, and only whoever created it gets the badge. The
other person's tiles stay locked **permanently** — there is no later event that
can unlock them, because the goal is already complete.

The tension is real and this story has to resolve it rather than ignore it: the
scoping exists to protect privacy, and widening it must not leak anything.
A shared goal is by definition visible to the household, so including it is not a
privacy change — but the query must widen to *shared goals in my household*, not
to *all goals of my household members*.

## Acceptance Criteria

1. **Given** a shared goal that reaches its target **When** a member who contributed to it opens the app **Then** `goal_reached` unlocks for them, not only for the creator.
2. **And** `first_goal` unlocks for a contributor whose first reached goal is a shared one.
3. **Given** a member who did NOT contribute to a shared goal that completed **Then** nothing unlocks for them — being in the household is not participation.
4. **Given** a member's own PERSONAL goals **Then** nothing about their existing behaviour changes.
5. **Given** another member's PERSONAL goals **Then** they remain invisible to the score route — the Story 15-2 privacy scoping still holds for everything that is not shared.
6. **Given** a user with gamification opted out (15-6) **Then** no achievement evaluation happens at all, unchanged.
7. **Given** the achievement is already unlocked **Then** re-evaluating does not duplicate it or re-fire the celebration.
8. **Given** a shared goal reached BEFORE this change ships **Then** contributors get the achievement on their next evaluation — the fix must be retroactive, or the people who prompted this stay locked out.
9. **Given** verification **Then** `tsc`, `lint`, full `jest` (baseline 2287 — zero regressions) and `next build` pass.

## Tasks / Subtasks

- [x] **Task 1: Widen the goal query precisely (AC: 1, 3, 4, 5)**
  - [x] In the score route, fetch own goals OR shared goals in the caller's household — not all household members' goals.
  - [x] Establish "contributed" from the contributions data, not from membership.
- [x] **Task 2: Achievement evaluation (AC: 1, 2, 7)**
  - [x] Feed the widened set into the achievement engine.
  - [x] Confirm the existing idempotency holds for a goal with several eligible members.
- [x] **Task 3: Retroactive unlock (AC: 8)**
  - [x] Verify an already-complete shared goal unlocks on the next evaluation. No backfill migration should be needed if evaluation is derived rather than event-driven — confirm which it is before assuming.
- [x] **Task 4: Tests (AC: 1-8)**
  - [x] Contributor unlocks; non-contributor does not; another member's personal goal stays invisible; opted-out user evaluates nothing; double evaluation does not duplicate.
- [x] **Task 5: Verify (AC: 9)**

## Dev Notes

- **The scoping decision being changed is Story 15-2's**, and it was deliberate.
  Widen to *shared goals in my household* only. `.eq(user_id)` → an OR that
  includes `household_id = <mine> AND is_shared`, whatever the 13-9 shape is —
  check it rather than assuming a column name.
- **AC3 is the one to get right.** "Contributed" must come from the contributions
  table. If it is derived from household membership instead, every member earns
  every shared goal's badge and the achievement stops meaning anything.
- **AC5 is the privacy guard.** A widening that accidentally pulls in other
  members' personal goals would leak private data into a gamification response.
  Assert it in a test with a household member who has a private reached goal.
- Achievements are **server-derived lifecycle state**: service-role writes,
  SELECT-only RLS. A client that could forge an unlock is the 2× occurrence rule
  in this codebase. Do not relax that while touching the write path.
- The one-shot `newlyUnlocked` payload rides a cacheable GET; the deferred item
  about lost celebrations (15-3) is separate and stays deferred. Just do not make
  it worse — several members unlocking the same achievement should not multiply
  celebrations for one person.
- 15-6 opt-out gates the whole score fetch with a null SWR key; nothing here
  should cause a fetch for an opted-out user.

## Implementation notes

- **A separate query, not a widened one.** `allGoals` fed BOTH the achievement
  evaluation and the score's consistency factor, so widening it in place would
  have moved the score - which Story 15-2 deliberately scopes to personal goals.
  Own goals keep their query; contributed shared goals get a second one, and only
  the achievement evaluation sees the union. A test asserts the goals factor
  stays `unscored` when the only reached goal is a shared one.
- **Two independent layers keep AC5 (privacy).** `household_id IS NOT NULL`
  excludes every personal goal, and migration 027's dual-path SELECT policy only
  exposes shared goals in the caller's own household. Participation comes from
  `goal_contributions` scoped to the caller - never from household membership,
  which would have handed every member every shared goal's badge.
- **AC8 (retroactive) needed no backfill.** Achievements are DERIVED on each
  score fetch from current data, not fired from events, so an already-complete
  shared goal unlocks on the next evaluation. The first test is exactly that
  case: a reached goal, no unlock history, unlock happens.
- The contributions lookup is enrichment: on failure it warns and the evaluation
  falls back to own goals, never 500ing the score.

## Deferred / not changed

- The **score** still ignores shared goals. Arguably a contributed shared goal
  should count toward the consistency factor too, but that changes the number for
  existing users and was not what DW-5 #2 decided. Worth revisiting deliberately.
- The one-shot `newlyUnlocked` celebration still rides a cacheable GET (15-3
  item). Unchanged - several members unlocking the same achievement does not
  multiply celebrations for any one of them.
