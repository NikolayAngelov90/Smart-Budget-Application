---
baseline_commit: 1515d55
source: deferred-work.md (15-5 — "needs a sent-marker or scan-window design, not per-route hacks")
---

# Story DW-4: Quiet hours should defer a push, not delete it

Status: done

## Story

As someone who set quiet hours,
I want notifications to arrive after my quiet window rather than never,
so that choosing "don't wake me" doesn't silently opt me out entirely.

## Problem

The quiet-hours gate **suppresses**; it never defers. Combined with cron jobs
that fire at one fixed time, that turns a "not now" preference into a permanent
opt-out that the user never agreed to and cannot see:

- A user whose quiet window covers **10:00 UTC** gets **zero** re-engagement
  pushes, ever.
- A window covering **Monday 08:00 UTC** kills **every** weekly digest push.

The same shape causes a second loss: the cron matches its cohort with an
**equality scan** on the day, so if a cron run is missed (deploy, incident,
platform blip), that day's cohort is skipped permanently — there is no catch-up.

Both were documented as accepted in the route comments, which is honest, but the
user-visible effect is that a mild preference silently disables a feature. The
deferred entry is explicit that this needs a design, not a patch: suppressing at
send time cannot be fixed at send time.

## Why this is `needs-design`, not `ready-for-dev`

The fix requires choosing a delivery model, and the options differ in cost and
in failure behaviour. That decision should be made deliberately rather than
discovered mid-implementation:

**Option A — sent-marker + scan window.** Record per user per notification
kind that a send happened for a period. The cron scans a WINDOW ("anyone owed
this who has not been sent it, whose quiet hours are now over") instead of
matching a single instant. Fixes both the quiet-hours loss and the missed-cron
loss with one mechanism. Needs a table and a migration.

**Option B — a queue.** Enqueue on generation, drain respecting quiet hours.
Most general, most infrastructure.

**Option C — more frequent cron + idempotency.** Run hourly, let the sent-marker
prevent duplicates. Simplest, but only works if a marker exists — so it is
really Option A with a different trigger cadence.

A is the likely answer, and C composes with it. B is probably more than this
needs. **Do not start until the model is chosen.**

## Acceptance Criteria (to firm up once the model is chosen)

1. **Given** a user whose quiet hours cover the cron's fire time **When** their quiet window ends **Then** the notification is delivered — not dropped.
2. **Given** a notification already delivered for a period **When** any later run considers the same user and period **Then** it is not sent again. Idempotency is non-negotiable: a scan window means multiple runs will see the same eligible user.
3. **Given** a cron run that never happened **When** the next run executes **Then** the missed cohort is still served, within a stated staleness bound.
4. **Given** a notification that has become pointless (a digest for a week now long past) **Then** it EXPIRES rather than arriving late and confusing. The bound belongs in the AC once chosen.
5. **Given** quiet hours spanning midnight (22:00-07:00) **Then** the window is evaluated correctly — the wrap case is where this kind of logic usually breaks.
6. **Given** a user in a timezone far from UTC **Then** quiet hours are evaluated in THEIR local time, consistent with the cluster-B principle that windows belong to the user's day, not the server's.
7. **Given** the never-throwing send path **Then** it still RETURNS an outcome (`'sent' | 'suppressed' | 'deferred' | 'failed'`) so telemetry stays truthful — the existing rule is that a gate which swallows outcomes makes the logs lie.
8. **Given** best-effort sends on Vercel **Then** they are AWAITED — a fire-and-forget push is dropped when the function freezes after the response.

## Tasks / Subtasks

- [x] **Task 0: Choose the model (blocking).** A, B or C above; record the reasoning in this file.
- [x] **Task 1: Schema + migration** for the sent-marker (if A/C).
- [x] **Task 2: Replace suppression with deferral** in the quiet-hours gate; keep a real `'deferred'` outcome.
- [x] **Task 3: Convert the cron's equality scan to a window scan** with idempotency from Task 1.
- [x] **Task 4: Expiry** per AC4.
- [x] **Task 5: Tests** — midnight-wrap quiet hours, a far-timezone user, a missed run, and a double run proving no duplicate send.

## Dev Notes

- **Per-ACCOUNT preferences must not be gated on per-DEVICE state** — an
  existing rule in this codebase; quiet hours are an account preference.
- **Timezone**: `resolveClientToday` (`src/lib/utils/date.ts`) exists for read
  paths, but a cron has no client to ask. This story likely needs a **stored
  user timezone**, which the codebase has so far deliberately avoided ("15-1
  ruled: do NOT invent a tz parameter here"). That is part of the design
  decision, and it is the piece most likely to expand scope.
- Migrations 020-040 are applied in prod. New tables: RLS with the
  `(select auth.uid())` initplan form, and REVOKE explicitly — Supabase grants
  ALL to `authenticated` by default and GRANTs are additive.
- Server-derived lifecycle state like a sent-marker should be **service-role
  writes with SELECT-only RLS**. A forgeable "already sent" marker would let a
  client suppress its own notifications; this project has hit that class twice.
- Toast/notification batches cap at 3 — respect it if deferral can cause several
  notifications to become due at once. A user emerging from quiet hours to nine
  pushes is a worse outcome than the bug.


---

# Decisions (2026-07-30) and outcome

| Question | Decision |
|---|---|
| Quiet-hours timezone | **Store a user timezone**, evaluate in local time |
| Delivery model | **Sent-marker + scan window** (Option A) |
| Expiry | **End of the period** the notification describes |

## A second defect, found while implementing

`isWithinQuietHours` compared against `new Date().getUTCHours()` and nothing
stored a timezone, so "22:00-08:00" was applied in UTC — 01:00-11:00 for a
Sofia user. This was NOT in the deferred entry, and it is the prerequisite for
the rest: deferring "until quiet hours end" is meaningless while the window sits
on the wrong hours. (The Settings labels did read "(UTC)", so the behaviour was
at least honestly labelled; they now show the user's zone.)

## Implementation notes

- **Hourly, not daily.** Option A alone is not sufficient with a once-a-day
  cron: the retry lands at the same hour, so a user asleep at 10:00 UTC is
  deferred forever — indistinguishable from the suppression it replaced. A is
  therefore combined with C, exactly as the story predicted it would need to be.
- **Only a SEND is marked.** A deferred user must stay eligible for the next
  run; an opted-out user is also left unmarked, so the marker means precisely
  "this user was served".
- **The delivery lookup fails CLOSED** (500, retried next hour). Sending without
  knowing who was already served risks duplicating the whole cohort.
- **Expiry is free** from the period key — once it rolls over, the old key is
  never consulted again.
- Migration 042 applied to production and verified: RLS on, `authenticated` has
  SELECT only, no anon/PUBLIC grants, one SELECT policy, writes service-role
  only.

## Deferred / not changed

- The weekly digest scans hourly **on Mondays only** (`0 * * * 1`). A user quiet
  for all 24 Monday hours still misses that week. Bounded and documented rather
  than scanning all week for a once-weekly notification.
- The digest's own generation is an idempotent upsert on `(user_id, week_start)`,
  so re-running it while a push is still pending is safe — it simply stops once
  the marker lands.
- AC4's "re-check relevance at send time" was NOT taken; expiry is by period,
  per the decision. A re-engagement push can still arrive later the same day to
  someone who returned in the meantime.


---

## Platform constraint discovered at deploy (2026-07-30)

The hourly schedules failed `vercel deploy`:

> Hobby accounts are limited to daily cron jobs. This cron expression
> (`0 * * * 1`) would run more than once per day.

Hourly was chosen because a daily retry cannot recover a deferral — the next
attempt lands at the same hour. The reasoning holds; the frequency simply is not
available on this plan, and I did not check before merging. Every local gate
passed, because the constraint only exists at deploy time.

**Reworked within one run per day:**

- `reengagement-push` → `0 10 * * *`, with the cohort widened from "last log
  EXACTLY 7 days ago" to a **7-10 day window**. Widening the window is the only
  way to get a second attempt once frequency is capped. The marker is keyed by
  the inactivity **episode** (`last_log_date`), so a four-day window is still
  one push per episode.
- `weekly-digest` → `0 9 * * *`, **daily** rather than Monday-only, gated by the
  ISO-week marker. One delivery per user per week, but seven chances instead of
  one — a missed Monday no longer loses that week's cohort.

**What survives and what does not:**

| | |
|---|---|
| Missed cron run no longer skips a cohort permanently | ✅ Fixed |
| Quiet hours evaluated in the user's local time | ✅ Fixed |
| `deferred` distinct from `suppressed` in telemetry | ✅ Fixed |
| A user quiet at the cron's local-equivalent hour receives it later | ❌ **Not possible** on one run/day |

The last row is a genuine limitation, not a workaround. One fixed daily UTC hour
is one fixed local hour for a given user; reaching them needs a second trigger
the plan does not permit. It remains a large improvement on the original
behaviour: before DW-4 those users were **woken at 02:00 local** because quiet
hours were compared in UTC. Not-woken beats woken-at-2am, even if
delivered-later would be better still.

Lifting this properly needs the Pro plan (hourly crons), at which point the
hourly schedules and the day-based period key can be restored.

A guard test (`src/lib/utils/__tests__/cron-schedules.test.ts`) now parses
`vercel.json` and fails on any schedule that could run more than once per day.
