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
