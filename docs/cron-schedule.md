# Cron schedule — why only two jobs are declared

`vercel.json` cannot carry comments, so the reasoning lives here. **Read this
before adding a cron entry.**

## The rule

**This project is on the Vercel Hobby plan, which registers at most TWO cron
jobs.** Declaring more does not fail the deploy and does not warn anywhere you
will see it. The surplus jobs simply never fire, and every one of them fails by
doing nothing — which is indistinguishable from "ran and found nothing to do".

Four were declared between 2026-06 and 2026-09-16. Two of them never ran.

## What was measured (2026-09-16)

| Cron | Verdict | How it was established |
| --- | --- | --- |
| `generate-insights` | was DEAD | hp-8's `insights_last_generated_at` marker on all three profiles. It advances on every run regardless of what the run produces, so it cannot be explained by "ran and found nothing". The QA profile still read `2026-08-28`; a third read `NULL`. |
| `subscription-detect` | was DEAD | `detected_subscriptions` had ZERO rows ever — and the production data contains subscriptions it should have found. |
| `weekly-digest` | ALIVE | Deliveries on a clean weekly cadence at a fixed UTC time: 08-31, 09-07, 09-14 09:41. Cron-driven, not user-driven. |
| `reengagement-push` | undetermined | One delivery ever (2026-08-23). It targets a day-7-lapsed cohort drawn from a single push subscription, so silence is explained without the cron being dead. |

The two dead ones were the first two declared; the live one and the plausibly
live one were the last two. Consistent with a two-slot cap taking the last two.

### Zero rows is not evidence on its own

`detected_subscriptions` being empty proves nothing by itself: the detector
writes only when it finds something, and skips transactions with no notes. What
makes it a finding is that the rule's own thresholds were replayed against the
real data (241 of 246 expenses have notes; 15 merchant groups of >= 3), and
three groups clear every threshold it applies:

| account | merchant | n | median amount | median gap | amount consistency |
| --- | --- | --- | --- | --- | --- |
| dd9be3b3 | monthly rent | 3 | EUR 900.00 | 30.5d | 100% |
| dd9be3b3 | electricity & water | 3 | EUR 116.70 | 30.5d | 100% |
| b11f65b7 | интернет и телевизия | 3 | EUR 33.00 | 30.5d | 100% |

A EUR 900/month rent at 100% amount consistency with 30.5-day gaps is not a
marginal call. That turns an absence into a positive finding: not "no evidence
it ran" but "evidence it did not run". Only the second is actionable.

## Why these two

- **`subscription-detect` must run.** It is cron-only with no fallback, and it
  is a README feature. Nothing else in the app invokes it.
- **`weekly-digest` must run.** Same: cron-only.
- **`generate-insights` is covered without a schedule.** User-triggered
  regeneration fires in practice — observed on 2026-09-03, 09-08 and 09-10 — and
  the route no-ops on 29 days out of 30 anyway (`getUTCDate() === 1`).
- **`reengagement-push` has nobody to re-engage.** Its cohort is drawn from one
  push subscription in the entire system.

**Both routes still exist, still have tests, and are still callable with
`CRON_SECRET`.** A schedule was removed; a feature was not. Re-adding an entry
is a one-line change — but you must drop another one in the same edit, or you
will silently kill whichever job loses the draw.

## The lesson this feature paid for

`subscription-detect` has tests, they pass, and the route logic is correct. It
had never produced a row in production. It was verified at the layer of "does
the handler work" and never at the layer of "does anything invoke it" — the same
shape as a guard whose evidence any code could produce, or an env check that
read a file the build never saw. Correct at the layer examined, wrong about the
system.

So: **a green deploy proves the configuration changed. It does not prove the
cron runs.** Verify a schedule change by its EFFECT — a row appearing in the
table the job writes — not by the deploy going green.

---

## 2026-09-23 - the Hobby-cap hypothesis was WRONG, and the schedule was the cause

Pruning to two crons did not make `subscription-detect` run. `detected_subscriptions`
was still empty two days after the Sunday it was scheduled for.

### The controlled comparison

Same plan, same config file, same deployment, same `CRON_SECRET`, same Sunday:

| cron | schedule | | result |
| --- | --- | --- | --- |
| `weekly-digest` | `0 9 * * *` | **daily** | fired 2026-09-21T09:00:13, all 3 users, `notification_deliveries` period 2026-W39 |
| `subscription-detect` | `0 2 * * 0` | **weekly** | no trace at 02:00, table still 0 rows |

Two jobs, one variable. Everything else that could differ is eliminated:

- **the cap** - only two crons were declared;
- **the deployment** - #56 deployed 2026-09-16 and #60 has been the live
  production deployment since 2026-09-17, four days before the Sunday;
- **the secret** - both routes authenticate against the same `CRON_SECRET`, and
  `weekly-digest` authenticated successfully;
- **the algorithm** - proven to work, below.

The cron expression is the only thing left standing. Vercel's own docs, searched
for Hobby cron limits, returned configuration snippets and no statement of the
limit, so this is NOT settled by documentation - it is settled by the comparison.
Cron *registration* could not be read either: no MCP tool exposes it, and the
local CLI's stored token is invalid (`vercel login` is interactive).

**So: on this plan, use a DAILY expression and gate inside the route if you need
a longer period.** That is what `weekly-digest` already does - it is scheduled
daily and computes an ISO-week key internally.

### The algorithm was never the problem

The real `classifyFrequency`, `normalizeMerchant`, `amountsMatch` and real
constants, driven over the real 6-month window behind the real
`hasEnoughHistory` gate, find three subscriptions:

| account | merchant | n | median | intervals | freq |
| --- | --- | --- | --- | --- | --- |
| dd9be3b3 | monthly rent | 3 | EUR 900.00 | [31,30] | monthly |
| dd9be3b3 | electricity & water | 3 | EUR 116.70 | [31,30] | monthly |
| b11f65b7 | internet i televiziya | 3 | EUR 33.00 | [31,30] | monthly |

**SOME VERIFICATIONS CONSUME THEIR OWN EVIDENCE.** `detectSubscriptions` UPSERTS
into `detected_subscriptions` - the table whose emptiness *is* the evidence.
Calling it would have produced rows and left no way to tell whether the cron or
the check wrote them. So the real exported pure functions were driven instead,
with the unexported `groupByMerchant` reproduced verbatim from source. A
read-only path has to be built BEFORE a check like that is run, not after.

The same applies to triggering the route by hand with `CRON_SECRET`: it would
prove the route works end to end and destroy the observation in the same call.

### WHY NO INTERNAL DAY GATE - the reason did not transfer

The obvious move was to copy `generate-insights`: daily schedule plus an internal
`getUTCDate() === 1` gate. That is the house style, and it would be wrong here.

`generate-insights` gates because regenerating monthly insights every day would
churn the insights table for no benefit. `subscription-detect` has no equivalent
reason:

- **It is idempotent.** It upserts on (user_id, merchant_pattern), updates only
  rows that are `active` or `unused`, and leaves user-dismissed or kept rows
  alone. A daily run writes the same values.
- **Daily is strictly BETTER for `flagUnusedSubscriptions`**, which runs in the
  same handler and marks a subscription unused once its next charge is overdue by
  more than 1.5x the interval. That is a time-based transition: weekly checking
  means a subscription can be up to seven days late being flagged.
- **It is cheap.** Three users, and the largest 6-month window is 143 expense
  rows.
- **A gate would destroy this job's observability.** A job whose healthy state
  produces the same signal as its dead state cannot be monitored - that rule and
  its full argument now live in `docs/api-conventions.md`, under Scheduled Work
  (cron) - Observability, because it applies to any conditional early return in
  scheduled work and not just to this job.
- Nothing depends on "weekly" semantics. There is no per-period dedup for
  subscriptions the way `notification_deliveries` period keys exist for digests.

So: daily, no gate. One fewer moving part, and the only argument for the gate was
symmetry with a file whose gate exists for a constraint this job does not have.

### Verification is by effect, as always

`detected_subscriptions` must gain rows after the next 02:00 UTC run:
`monthly rent` (~EUR 900, monthly), `electricity & water` (~EUR 116.70, monthly)
and the internet/TV line (~EUR 33, monthly). The algorithm has already been shown
to produce exactly those three, so a miss now would mean something new.

### A note on the probes used here

The read-only checks ran through the project's own `SUPABASE_SECRET_KEY` from
`.env.local`, because the Supabase MCP had disconnected. **That is a service-role
connection and it BYPASSES RLS.** It is the same mechanism the RLS suite uses, so
the precedent exists - but it should not be reached for casually, and this
sentence belongs next to any future use of it rather than in a separate document.
