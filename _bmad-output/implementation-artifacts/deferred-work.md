# Deferred work

> **Reviewed 2026-07-30.** Every item verified against the code, not taken on
> trust. Three were already fixed. Clusters A/B/D/F are now DONE (PR #21).
> What remains is listed under "Status" at the bottom, in the order to tackle it.
>
> The original entries are kept verbatim below, because the reasoning is still
> useful - several were mis-triaged as LOW when they changed user-visible numbers.

## Deferred from: code review of story 13-1 (2026-06-03)

- [LOW] `getCurrentHousehold` uses `maybeSingle()` — throws if a user is ever in >1 household. Acceptable while one-household-per-user holds; revisit with multi-household support.
- [LOW] One-household-per-user has a TOCTOU race — no `UNIQUE(user_id)` on `household_members` (kept open for future multi-household). Concurrent double-submit could create two memberships. Consider a partial unique index or advisory lock if it becomes an issue.

## Deferred from: code review of story 13-2 (2026-06-04)

- [LOW] invitationService `requireAdminHouseholdId` uses `.maybeSingle()` — throws if a user is ever in >1 household (gated by one-household-per-user; same root as the 13-1 item).
- [LOW] No guard against inviting an email that's already a household member or the admin's own — validate at accept (Story 13.3).
- [LOW] The `/join?token=…` invite link target doesn't exist until Story 13.3 — ship 13.2 + 13.3 together.

## Deferred from: code review of story 13-3 (2026-06-04)

- [LOW] invitationService `isUserInHousehold` uses `.maybeSingle()` — throws if a user is ever in >1 household (gated by one-household-per-user; same root as 13-1/13-2).
- [LOW] OAuth login does not return to `/join` after sign-in (only email/password honors the `redirect` param). Wire the redirect through the OAuth callback if needed.

## Deferred from: code review of 15-1-logging-streaks-with-streak-freeze (2026-07-02)

- [MED-latent] **App-wide: `import { mutate } from 'swr'` (global mutate) is provably inert under the app's localStorage cache provider** — it binds to SWR's default cache while all hooks read the provider cache (empirically verified against swr@2.3.6 by the 15-1 acceptance audit). The 15-1 patches fix the dashboard page via `useSWRConfig().mutate`; SWEEP the remaining global-mutate callers (grep `from 'swr'` for `{ mutate }`) — every such revalidation call has been a no-op, masked by revalidateOnFocus.
- [LOW] POST /api/transactions returns the authoritative `streak` but the client recomputes instead of seeding the scoped cache from it — needs an onSuccess signature change; do when next touching TransactionEntryModal.

## Deferred from: code review of 14-4-what-if-savings-simulations (2026-07-02)

- [MED-product] ~~What-if "3-month average" is the mean over months PRESENT~~ **DECIDED at epic-14 retro (2026-07-02) and IMPLEMENTED (spec-fixed-3month-average.md): fixed ÷3 window via `fixedWindowMonthlyAverage` in spendingAnalysis.ts** — consumers: nudge helper, forecastEngine, /api/what-if. Review follow-up RESOLVED for `recoveryPlanner` (adopted the fixed window, 2026-07-02 — avg only; min-based targets unchanged). Remaining holdout: `insightRules` budget-recommendation (≥2-month self-guard, persisted insights) still uses months-present — its "typical monthly" copy can disagree with nudge/forecast "usual" numbers after a spike month; decide when next touching insights.
- [LOW] Goal-earlier badge assumes the user saves at exactly the deadline-required pace and redirects 100% of simulated savings to the nearest goal; consider a copy nuance ("if these savings go toward the goal").
- [LOW] `/api/what-if` currency: stored-rate-only conversion + averages remain in the write-time base currency while the UI labels them with the CURRENT preference — same live-rate/relabel class as the /api/budgets and /api/wishlist items above; fix all three together.
- [LOW] `/api/what-if` derives the 3-month window and `todayKey` from the server clock (UTC on Vercel) — same client month/tz param class as budgets/forecast/wishlist; fix together.

## Deferred from: code review of 14-3-wishlist-with-budget-impact-analysis (2026-07-02)

- [LOW] `/api/wishlist` month window + engine `today` use the server clock (UTC on Vercel) — same class as the /api/budgets + budget-forecast items below; fix all three together with a client month/tz param.
- [LOW] `/api/wishlist` currency conversion uses stored entry-time `exchange_rate` only (NULL rate = assumed preferred currency) — same live-rate-fallback gap as /api/budgets below.
- [LOW] WishlistSection categories dropdown: fetch error renders a silently empty Select — add an unavailable hint (new i18n keys) when touching the form next.
- [LOW] `delay_days` is uncapped: a goal €1 short with a long horizon reports absurd delays ("30,000 days") — cap or reword; product decision.
- [LOW] History toggle stays open after the last history item is restored, so the next purchased/removed item auto-expands the history card — cosmetic.
- [LOW] Category-budget impact line depends on the categories name lookup; if that single query fails the line is suppressed even though budget+spend were fetched — acceptable graceful degradation, decouple if it recurs.

## Deferred from: review of spec-adr-025-category-budgets (2026-07-02)

- [LOW] `/api/budgets` and `/api/dashboard/budget-forecast` derive "current month" from the server clock (UTC on Vercel); the stats route accepts a client-supplied `?month=`. A UTC+3 user sees the old month's budget status for the first hours of a new month. Add a client month/tz param to both when touching these routes.
- [LOW] Budget spend conversion uses only the stored entry-time `exchange_rate`; foreign-currency transactions without a stored rate (pre-preference-era) are summed raw. The stats route has a live-rate fallback (`getExchangeRates`) — port it if mixed-currency budget users report drift.

## Deferred from: code review of story 13-5 (2026-06-04)

- [LOW] Deleting a shared category that holds other members' transactions: the route's orphan step is owner-only (RLS), so the delete may fail (FK) or partially orphan. Consider admin-only shared-category deletion or service-role orphaning (overlaps 13-11).
- [LOW] Any household member can rename/delete shared categories ("manageable by all" per AC). Confirm product intent; 13-4 transparency / admin roles may refine.

## Deferred from: code review of 15-2-budget-score (2026-07-13)

- Server-clock day/month boundaries in read paths (MED-latent): /api/gamification/score computes month windows, the goal-deadline `.gt` cutoff, and isStreakBroken from the SERVER clock (UTC on Vercel), while StreakBadge evaluates the same invariant with the CLIENT clock — for far-tz users the ring's consistency factor and the streak badge disagree for hours around midnight, and a just-logged tx on the user's "1st of month" can fall outside both query windows. Same server-clock class as every dashboard month-window route (stats, budget-forecast, etc.); 15-1 ruled "do NOT invent a tz parameter here". Fix belongs app-wide (user tz preference or client-supplied day key on reads), not per-route.

## Deferred from: code review of 15-3-achievement-badge-system (2026-07-13)

- One-shot unlock events over a cacheable GET have no redelivery story (LOW): if SCORE_KEY revalidates while BudgetScoreRing is unmounted, `newlyUnlocked` is returned to nobody and the celebration is lost (badge still appears in the Settings gallery). Largely self-healing (SWR doesn't fetch unmounted keys; the next dashboard mount delivers), but a notification-center/redelivery surface (15-5 territory) would close it properly.
- Shared-goal contributors never earn first_goal/goal_reached (LOW): the score route scopes goals to `.eq(user_id)` (15-2 data-scope decision), so a household member who jointly reaches a 13-9 shared goal they didn't create keeps those tiles locked forever. Whether contribution should count is a product decision.

## Deferred from: code review of 15-5-push-notifications (2026-07-15)

- One-shot fixed-time cron pushes vs quiet hours (MED-latent): the gate SUPPRESSES (never defers) — an opted-in user whose quiet window covers 10:00 UTC gets zero re-engagement pushes ever, and a window covering Monday 08:00 UTC kills every digest push. Same class: a missed cron day permanently skips that day's cohort (equality scan). Fix needs a sent-marker or scan-window design (defer + retry), not per-route hacks. Documented as accepted in the route comments for now.
- Preferences JSONB read-modify-write race (LOW, pre-existing 8.3): two quick toggle flips can resurrect each other's old values (each PUT merges from its own read). 15-5 quadrupled adjacent toggles, raising odds. Fix = server-side single-key patch endpoint or optimistic version column.

## Deferred from: code review of 15-6-gamification-opt-in-out (2026-07-21)

- Preferences JSONB read-modify-write race (LOW, pre-existing 8.3, re-confirmed): two quick flips of adjacent Settings toggles can resurrect each other's old values (each PUT merges from its own read; last writer wins). 15-6 added the gamification toggle adjacent to the weekly-digest + push toggles, raising the surface again. Fix = server-side single-key patch endpoint or an optimistic version column on user_profiles.preferences. (Same item first logged from 15-5.)

## Deferred from: code review of 16-3-categories-screen-redesign (2026-07-24)

- [LOW, pre-existing Epic 5] `/api/dashboard/spending-by-category` filters its month window with `monthStart/monthEnd.toISOString()` against a `DATE` column (`date DATE NOT NULL`) — the local→UTC shift can bleed the previous day's spend into "this month" for users east of UTC (bg = UTC+2/+3). Same tz-misbucket class as the `/api/budgets` + `budget-forecast` + `/api/what-if` server-clock items above (DATE cols must compare `yyyy-MM-dd` strings, per project convention). Story 16-3 only makes this endpoint newly user-visible via the per-category "spent this month" caption; the numbers stay CONSISTENT with the dashboard pie chart that already uses it. Fix the whole class together with a client month/tz param + `yyyy-MM-dd` bounds when next touching these dashboard routes.

## Deferred from: code review of 16-4-insights-screen-redesign (2026-07-26)

- [MED-product] The two Epic-12 insight types (`spending_anomaly`, `new_high_spend_category`) now have correct colour/icon/grouping, but `InsightMetadata` has no renderer for them: expanding one shows "No additional details available", a divider, then a bold "Why am I seeing this?" heading with nothing under it. Either add metadata renderers or hide "See details" when there's nothing to show.
- [MED-i18n] `InsightMetadata` is entirely hardcoded English ("Spending Details for", "Why am I seeing this?", "View these transactions"), and `InsightDetailModal` renders the RAW stored `insight.title`/`description` rather than the localized text `AIInsightCard.getLocalizedText()` builds. So expanding/opening any insight in the Bulgarian UI drops to English. Fix = extract `getLocalizedText` into a shared helper + translate the metadata panel (a story, not a patch).
- [LOW, pre-existing] `RefreshInsightsButton` calls the global `mutate` imported from `'swr'`, which is INERT under this project's localStorage cache provider — the refresh button very likely never revalidates the insights list. Same class as the 15-1 global-mutate sweep item; use `useSWRConfig().mutate`.
- [LOW] `getDateLocale` in `dateFormatter.ts` is private, so the `locale === 'bg' ? bg : undefined` mapping is now inlined in 5 components. Export it and dedupe.


---

# Status after the 2026-07-30 review

## DONE (PR #21)

- **DATE-column windows shifted into UTC** - `month-over-month`,
  `spending-by-category`, `trends`, `values/spending` (10 boundaries) sent
  `.toISOString()` against a DATE column, so users east of UTC silently got an
  extra day of spend. Now `toLocalISODate`. Logged from 16-3 as "[LOW,
  pre-existing Epic 5]" - it was not low; it changed dashboard numbers.
- **Server-clock month windows** - all six routes (`budgets`,
  `budget-forecast`, `what-if`, `wishlist`, `spending-by-category`,
  `gamification/score`) now take the client's local day as `?today=`, clamped
  +/-1 day, via a shared `resolveClientToday` helper extracted from Story 16-6.
  Ten exact-key `mutate` calls converted to prefix matches, since the keys now
  carry the date. Logged from 15-2, 14-3, 14-4 and the ADR-025 review.
- **Global-mutate sweep FINISHED** - the first pass missed the aliased
  `import { mutate as globalMutate } from 'swr'` form, which is equally inert.
  Eight more call sites across six files scoped via `useSWRConfig()`. One test
  was asserting the inert call, passing while realtime revalidation did nothing.
  Logged from 15-1 as MED-latent.
- **`getDateLocale` exported**, four inlined copies removed. From 16-4.

## Already fixed before this review

- `RefreshInsightsButton` global mutate - done, uses `useSWRConfig()`.
- Fixed 3-month average - `fixedWindowMonthlyAverage` shipped. One holdout
  remains: `insightRules` budget-recommendation still uses months-present.
- `/join?token=` target - Story 13.3 shipped it.

## Still open

> **Update 2026-07-31.** Items 1, 2, 10 and 11 shipped (DW-1..DW-4); the
> product decisions 4-9 were settled in DW-5 and implemented in DW-6/DW-7.
> Item 3 is now done — see the re-triage below, which also closes Epic 16 retro
> action #4. **The engineering backlog is empty.**

**Engineering, ready to do:**

1. **Currency live-rate fallback** - `/api/budgets`, `/api/wishlist` and
   `/api/what-if` convert using the stored entry-time `exchange_rate` only, so
   pre-preference-era rows are summed raw while the UI labels them with the
   CURRENT preference. Port the `getExchangeRates` fallback the stats route
   already has. Fix all three together, as the original entries say.
2. **Preferences JSONB read-modify-write race** - logged three times (15-5,
   15-6, and again here). Each PUT merges from its own read, so two quick toggle
   flips resurrect each other's values. Needs a server-side single-key patch
   endpoint, or an optimistic version column.
3. **`insightRules` months-present holdout** - its "typical monthly" can
   disagree with nudge/forecast "usual" after a spike month.

**Product decisions needed - cannot be implemented as written:**

4. `delay_days` is uncapped ("30,000 days" for a goal 1 EUR short). Cap, or reword?
5. Should shared-goal contributors earn `first_goal`/`goal_reached`? The score
   route scopes goals to the creator.
6. Shared-category deletion when it holds other members' transactions:
   admin-only, or service-role orphaning?
7. Any household member can rename/delete shared categories. Intended?
8. Epic-12 insight types have no `InsightMetadata` renderer - add renderers, or
   hide "See details" when there is nothing to show?
9. Goal-earlier badge copy nuance ("if these savings go toward the goal").

**Story-sized, per the original entries' own wording:**

10. `InsightMetadata` + `InsightDetailModal` are hardcoded English and render the
    RAW stored title/description, so the Bulgarian UI drops to English on
    expand. "A story, not a patch."
11. One-shot cron pushes vs quiet hours: the gate SUPPRESSES rather than defers,
    so a user whose quiet window covers the cron hour gets zero re-engagement
    pushes ever. "Needs a sent-marker or scan-window design."

**Gated on a feature that does not exist - do NOT implement as bug fixes:**

12. Four `maybeSingle()` / TOCTOU items (13-1, 13-2, 13-3) are all guarded by
    one-household-per-user and say "revisit with multi-household support".
    Implementing them means BUILDING multi-household.

**Accepted / low value:**

13. Wishlist history toggle stays open after the last restore (cosmetic).
14. Wishlist categories dropdown renders empty on fetch error.
15. Category-budget impact line suppressed if the name lookup fails - graceful
    degradation as designed.
16. One-shot unlock events over a cacheable GET have no redelivery story -
    largely self-healing; a notification centre would close it properly.
17. POST /api/transactions returns an authoritative `streak` the client
    recomputes instead of seeding the cache from it.

---

# Re-triage, 2026-07-31 (Epic 16 retro action #4)

> "Re-triage anything left marked LOW that touches money, dates or permissions —
> this epic found four such items that were not low. Each re-rated against user
> impact, not fix cost."

Every remaining item re-read against that test. Fix cost deliberately ignored.

## Re-rated UP and fixed

**Item 3 — `insightRules` months-present holdout. LOW -> MED, done.**
It touches money and it was mislabelled twice over. The rule averaged over the
months PRESENT while every other baseline in the app uses the fixed ÷3 window,
so a category with two months of history showed "typical 300" on the insight
card and "usual 200" on the forecast card — same category, same dashboard. And
the copy said "Based on your 3-month average" while dividing by 2.

Worth recording that **the fix as this file originally proposed it would have
made things worse.** "Port the fixed window" applied to a RECOMMENDATION turns a
steady `[300, 300]` spender into 200, so the app would recommend a 220 budget to
someone who reliably spends 300 and then flag them for overspending every month.
The ÷3 rule exists to stop a spike posing as "usual" — right for detection,
wrong for a recommendation.

Resolved by requiring the FULL window instead (guard 2 -> 3). At exactly three
buckets the two formulas are identical, so the disagreement cannot occur and the
copy is finally true. Decided with Nikit; the cost is a month's wait for a
category with only two months of history.

## Re-rated UP, not yet scheduled

**Item 14 — wishlist categories dropdown renders an empty `<Select>` on fetch
error. LOW -> MED-UX.** Not money, dates or permissions, so it falls outside the
retro's test — but it is a silent failure, which the project's own degradation
policy says should warn rather than render an empty control. The user sees a
category picker with no categories and no reason why. Small, and it belongs with
the next change to that form, as the original entry says.

## Confirmed LOW — re-read, unchanged

- **13. Wishlist history toggle stays open after the last restore.** Cosmetic;
  no money, date or permission surface.
- **15. Category-budget impact line suppressed when the name lookup fails.**
  This is the documented degradation policy working as designed — partial data
  suppresses the line rather than zero-filling it. Correctly accepted, not debt.
- **16. One-shot unlock events over a cacheable GET have no redelivery story.**
  Self-healing: SWR does not fetch unmounted keys, and the next dashboard mount
  delivers. A notification centre would close it properly; nothing is lost
  meanwhile except a celebration animation.
- **17. POST /api/transactions returns an authoritative `streak` the client
  recomputes.** The client advances optimistically via the same engine and then
  revalidates, so any disagreement is transient and self-correcting. Touches
  gamification, not money.

## Deliberately not scheduled

- **12. Four `maybeSingle()` / TOCTOU items.** All guarded by
  one-household-per-user. Implementing them means BUILDING multi-household, which
  is feature scope, not a bug fix. Unchanged from the 2026-07-30 review.

---

## hp-14 — CLOSED 2026-10-04 — `npm run test:rls` green-skips instead of failing loud (filed 2026-08-26)

**Closed by #70 (the preflight) and the mutation pass recorded in
`hp-14-rls-isolation-mutations-and-grant-matrix.md`.** The local green-skip is
gone — measured before/after: `exit 0` with `65 skipped` became `exit 1` naming
each missing variable. The isolation guarantees now have recorded red states:
mutation (a) reddens exactly `referenceIsolation › other user (user B) CANNOT
write into user A’s scope`, mutation (b) exactly `transparency › a member CANNOT
change another owner’s category visibility`, each reverted and confirmed green
again. The grant/policy matrix is in the same story.

The original filing, for the record:


**Found during 17-1.** `npm run test:rls` exited 0 having run **0 of 11 suites**.
Every RLS suite skipped, because the local Supabase stack was not running, and
the command reported success anyway.

**Why this one matters more than most.** The README names that suite as *"the
one worth running before touching a policy or a migration"* — so its green is
trusted precisely when the stakes are highest. RLS is what enforces household
transparency levels and the privacy of personal allowances. A developer who runs
it without Docker up gets a confident pass that tested nothing.

This is the same defect as every other green-that-tested-nothing this session,
and the workflow already knows it: `rls.yml` has a step called *"Verify RLS
credentials are set (fail loud — never green-skip in CI)"*. CI is protected; the
local command is not.

**Interim position, deliberate rather than accidental:** CI's RLS Integration
Tests job runs the suite properly with the stack up and fails loud, so RLS is
genuinely covered on every PR. Local `test:rls` output should not be quoted as
evidence until this is fixed.

**Likely fix:** make the local script detect an unreachable stack and exit
non-zero with "start Supabase first", rather than letting jest skip its way to a
pass — mirroring what `rls.yml` already does in CI.

**Priority: behind hp-8 and hp-10.** Filed explicitly so it does not jump the
queue ahead of the insights work, which is what was asked for first.

### Also in this batch — duplicated sub-page heading

`/household/goals` renders an h1 "Споделени цели" directly above a card headed
"Споделени цели". Any sub-page whose single card carries its own heading shows
its title twice, and Settings has the same shape, so this is a pattern-level
tidy-up rather than a 17-1 defect. Appended here rather than opened as its own
story, to keep one small cleanup batch instead of a backlog of one-line items.

### Also in this batch — remove the hp-8 42703 escape hatch

`readLastGeneratedAt` degrades to "never generated" for Postgres error 42703
(undefined_column), so the insights routes do not 500 during the window between
the hp-8 migration applying and Vercel deploying. That window is minutes; the
branch as written lives forever and would happily mask the column being dropped
in 2027.

It logs at ERROR level with an explicit "migration not applied yet" message, so
its firing is visible rather than silent — but visible is not the same as
removed. Delete the branch once the hp-8 migration is confirmed applied in
production, and let 42703 throw like every other error.

### Also in this batch — the hp-8 RLS marker test is already written

`src/lib/test-utils/__tests__/insights-marker.rls.test.ts` landed with hp-8
rather than waiting, because CI's RLS job runs properly even though the local
command green-skips. When hp-14 fixes the local skip, that suite becomes
runnable locally too — no new test needed, just a working runner.

### Also in this batch — the column-grant audit (filed, NOT scheduled ahead of hp-10)

hp-8 found that `user_profiles` granted table-wide UPDATE/INSERT to
`authenticated` AND `anon`, which made `analytics_viewer` — an access-control
flag the analytics dashboard enforces server-side — settable by any user on
their own row. Closed in #50, and confirmed never exploited: 0 of 3 profiles had
it set.

**The root cause is a three-part coincidence, not a table.** A wide table-level
GRANT, plus an RLS UPDATE policy permissive enough to match the user's own row,
plus a privilege-bearing column. All three had to line up.

**Worked example 1 — `anon` on `user_profiles`, found by the same query.**
Before #50, `anon` (UNAUTHENTICATED) held table-wide UPDATE and INSERT on
`user_profiles`. It was harmless only because the RLS policies match on
`auth.uid()`, which is NULL for anon — so the table was protected by exactly one
mechanism, and the missing one was the grant. That is the pattern in its clearest
form: safe by a single layer, with the second absent.

**Worked example 2 — the latent case,** blocked today by an absence rather than a
control:
`household_members.household_role` ('admin' | 'member', `020_households.sql:15`)
has SELECT and INSERT policies but **no UPDATE policy**, so RLS default-denies
self-promotion to admin. The grants are still wide. The day someone adds a
legitimate UPDATE policy for an unrelated reason, `role` comes with it — on the
most consequential column in the app.

Done correctly already, with explicit REVOKEs: `036_user_achievements.sql:39-43`
and `037_comeback_challenges.sql:34-36`. **036's comment states the exact lesson
hp-8 walked into.** The knowledge was in the repo; what was missing was a test
that would fail without it. That is the finding worth carrying, more than the
SQL.

**Deliverable:** a per-table matrix of (table-level grants x RLS UPDATE policy
breadth x privilege-bearing columns), flagging every table where two of the three
line up as latent. It belongs here with the RLS-suite fix because both are about
privileges being untestable locally.

**Deliberately not scheduled ahead of hp-10.** The live issue is closed; what
remains requires a future policy change to become real.

### NEW — `anon` holds table-wide INSERT/UPDATE on 24 of 26 tables (filed 2026-10-04)

Found by the hp-14 matrix. Supabase's default privileges grant table-wide rights
to `anon` as well as `authenticated`, and grants are additive, so a REVOKE naming
one role leaves the other intact. **Including on the two tables the matrix note
above cites as having been done correctly:**

```sql
REVOKE UPDATE, DELETE ON user_achievements FROM authenticated;      -- 036
REVOKE INSERT, UPDATE, DELETE ON comeback_challenges FROM authenticated;  -- 037
```

Measured in production: `user_achievements` — `anon` still holds `INSERT, UPDATE`;
`comeback_challenges` — the same. Both are server-derived lifecycle tables whose
entire point is that they must not be forgeable through PostgREST.

**Not exploitable today.** Both have RLS on with no INSERT/UPDATE policy, so
writes are denied whatever the grant says — which is exactly the pattern named
above: safe by a single layer, with the second absent. Now found on the exemplars.

**DECIDED YES, 2026-10-05, gated on two verification checks — both now done.**

**Check 1 — does anything write as `anon`? No.**
- Both client factories (`lib/supabase/client.ts`, `lib/supabase/server.ts`) use
  the publishable key, but `@supabase/ssr` attaches the user's JWT, so the role
  is `authenticated` after login and `anon` only before it.
- The `(auth)` route group — the only pre-login UI — makes **zero** PostgREST
  table writes. It calls `supabase.auth.*` only, which is GoTrue, not PostgREST.
- **Signup, the case to look at hardest:** `user_profiles` rows are created by
  `on_auth_user_created`, an `AFTER INSERT ON auth.users` trigger running
  `handle_new_user()` (`004_user_profiles_table.sql:102-104`). That function is
  `SECURITY DEFINER` and, since 038, has EXECUTE revoked from `anon` and
  `authenticated` and granted only to `supabase_auth_admin`. **Registration does
  not depend on an anon grant.**
- `/api/analytics/track` returns 401 without a user, so its `analytics_events`
  insert always runs as `authenticated`.
- `exchange_rates_cache` has no application writer at all.

**Check 2 — is it actually latent? Yes, confirmed behaviourally.** Probed
production as `anon` with the publishable key, using a `user_id` absent from
`auth.users` so the FK made a row impossible to create either way:

| probe | result |
| --- | --- |
| `POST /rest/v1/user_achievements` | `42501` new row violates RLS policy |
| `POST /rest/v1/comeback_challenges` | `42501` new row violates RLS policy |
| `POST /rest/v1/transactions` | `42501` new row violates RLS policy |

`42501` and not `23503` — the rows never reached the foreign key, so RLS refused
them rather than the constraint. The key was confirmed live first (`GET` returned
`200 []`), so a 401 could not masquerade as a denial.

**The migration is written and HELD:**
`supabase/migrations/20261005090000_revoke_anon_write_grants.sql` — one file, all
tables, list derived from the catalog rather than typed, idempotent, plus
`ALTER DEFAULT PRIVILEGES` so the next table created does not re-introduce the
grant. It carries a per-table verification query, because it touches ~24 tables
and a spot check would not be evidence.

**SEQUENCING, and it is not the usual order.** Merging the file before it is
applied turns the drift check RED in the dangerous direction: the local stack
would build without these grants while production still has them, so production
would hold grant entries the migrations do not — `PRODUCTION_ONLY`, a hard fail
on the first run rather than a pending item that ages out. **Apply to production
first, then merge the file to record it**, the same sequence as #68.

Ranked after the order-dependent-tests item: a bounded item that finishes comes
before a production change with zero live risk.

### Also in this batch — mean/sigma outlier detection MASKS multiple outliers

The other edge of the mechanism that bounds the outlier count. `isOutlier` uses
mean and population sigma, both computed over a set that INCLUDES the outliers,
so each large value raises its own threshold. That is what keeps the count small
(measured: max 2 per category, 6 per account) — and it is also what makes the
rule go QUIET in the case that matters most.

Two EUR 700 charges in Shopping instead of one: both lift the mean, both inflate
sigma considerably more, and the 2-sigma bar can end up above BOTH. Nothing is
reported, precisely when several large unusual charges are a worse situation than
a single one. Shopping already shows the mechanism at one outlier — mean 98.46,
sigma 181.74, bar at ~462, put there by the EUR 700 itself.

This is the classic weakness of mean/sigma outlier detection. Robust methods use
the MEDIAN and MAD, or a modified Z-score, precisely because those are not
dragged by the points they are meant to detect.

PRE-EXISTING, not caused by hp-10, and it was not a reason to widen that story.
It follows directly from the argument that justified leaving the emission
uncapped, which is why it is filed rather than left as a footnote to good news.

---

## Test-order dependence — the classification has a TIME dimension

Filed 2026-10-06, correcting a demotion made on 2026-10-05.

The order-dependence work was split into **3a** (fix the seven suites, pin the
seed) and **3b** (an isolation sweep for a larger population). 3b was demoted
partly on this argument:

> order-dependent but passing in CI = a FALSE GREEN, which can hide a defect;
> isolation-only failing = a FALSE RED, which hides nothing.

**"Hides nothing" is too strong. It hides nothing YET.** `exchangeRateService`
is the counter-example: a latent false red today, because in declaration order
every assertion genuinely establishes its property and only pure formatting
tests follow the block that leaks. But the `convertCurrency` describe sets
`mockFetch.mockResolvedValue(...)` persistently, so **the first test anyone
appends to that file silently inherits a mocked successful fetch** — and they
would have no reason to suspect it, because the file is green.

So the classification is not a terminal state. It is a current state with a
trajectory, and the useful form carries the arrow:

| suite | classification |
| --- | --- |
| `exchangeRateService` | false red → **false green on append** |
| `OfflineBanner` | false red → false green on append (same shape: a leaked implementation its tests rely on) |
| `BalanceFlowHero` | false red, no trajectory — the collision is bounded and closed |

**The remedy is the part that matters.** `mockReset()` does not merely fix
today's symptom; it removes the trajectory. A fix that made the current tests
pass without draining the queue and dropping the implementation would have left
the file a false green waiting for its next commit.

The demotion of 3b still stands — the cost argument and the one-file bound on the
prototype collision are unchanged — but anyone re-weighing it should weigh "hides
nothing yet", not "hides nothing".

### The size of this item is NOT KNOWN, and has grown every time the instrument improved

"Bounded and finishable" was the stated reason for ranking 3a where it is. That
claim has now been unsupported three times, each time by a better measurement
rather than by new code:

| when | instrument | what it said |
| --- | --- | --- |
| 2026-10-04 | full-suite `--randomize`, 15 seeds | 27 tests / 8 suites; **"plateau — eight consecutive seeds added nothing"** |
| 2026-10-05 | per-file isolation, during diagnosis | the composer fails 6–9 of 10 alone while appearing in 0 of 15 full-suite seeds — **the sweep under-detects** |
| 2026-10-06 | the same sweep, with a **fixed extractor** | the `●`-line regex truncated at the first parenthesis and had been silently dropping tests. An entire suite — `insightService.generationMarker` — was invisible for the whole item |
| 2026-10-06 | 15 seeds re-measured with `×` lines | union **6**, where the 6-seed re-measurement had said 5 |

**So the 2026-10-04 plateau was a plateau of the extractor's visibility, not of
the population.** An estimate that moves in one direction every time the
instrument improves is not converging, and that is information in itself.

The seven suites found and fixed are real defects and fixing them was right. What
is NOT established, and has been asserted twice, is that they are the whole of
it. The honest statement is: **we do not know the size of this item.** The next
measurement should be the per-file `--randomize` sample (twenty files, five
seeds, chosen by something other than convenience), and until then no number here
should be quoted as the population.

---

## Deferred: locale-aware DISPLAY of amounts (2026-10-08) — DECIDED, not open

**Decision: DEFER.** Niki's call, recorded here so the estimate is not
re-derived the next time someone notices a dot in a Bulgarian UI.

**What was fixed instead, and why that was the whole of the harm.** A bg-locale
iPhone keypad's decimal key is a COMMA, and `parseFloat("12,50")` is `12` — no
NaN, no throw, and `.toFixed(2)` then renders `"12.00"`. A user entered
twelve-fifty and the database stored twelve. That is now fixed at every input
site by `parseDecimalInput` (`src/lib/utils/parseDecimalInput.ts`), with an
ESLint rule behind it. **The silent data loss is gone.**

**What is deferred is the other half: OUTPUT.** The app still renders amounts
with a dot — `"12.50"` — to a user whose keyboard types a comma. So the entry
field accepts `12,50` and the ledger shows `12.50`. That is an inconsistency, not
a loss.

**Estimate: a day's work, and its own PR.** It is not a one-line change:

- every `.toFixed(2)` and every hand-built currency string becomes one
  locale-aware formatter (`Intl.NumberFormat` against the `next-intl` locale);
- the blur handler in `TransactionEntryModal` reformats the field itself, so it
  has to agree with the formatter or the field will fight the user as they type;
- CSV export is the opposite requirement — a comma decimal inside a
  comma-separated file needs the delimiter or the quoting decided deliberately;
- chart axis labels, the goal/wishlist progress strings and the household
  allowance cards each format independently today;
- the snapshot and text-matching tests assert dotted strings, so the test suite
  moves with it.

**The stated risk, which is the actual reason to wait:** a half-migrated state is
WORSE than consistent dots. If the transaction list localises and the dashboard
hero does not, the same number appears two ways on one screen, and a user cannot
tell whether they are looking at a formatting difference or a different figure.
That argues for one deliberate pass, not an opportunistic one riding on a bug fix.

**Why it is not urgent:** three users, and no correctness consequence — polish.

**Re-open it when** either the app takes a user outside the two current locales,
or someone is already touching the formatting layer for another reason, so the
all-at-once pass is not a standalone cost.

---

## ON THE BOARD: two CI dependencies that are warnings today and failures later

Both found on 2026-11-16 while diagnosing why a docs-only PR went red. Neither
is urgent, both have someone else's timetable attached, and that is exactly why
they get a dated line rather than a fix today.

### Playwright 1.57 does not support Ubuntu 26.04 — becomes due the day someone wants 26.04

`npx playwright install chromium` fails outright on `ubuntu26.04-x64`:

```
Cannot install dependencies for ubuntu26.04-x64 with Playwright 1.57.0!
Error: ERROR: Playwright does not support chromium on ubuntu26.04-x64
```

The runners are now pinned to `ubuntu-24.04`, which keeps it working, so an
upgrade on the critical path to unblock a step that is already non-blocking
would be the wrong order. It becomes due when something else needs 26.04 — a
newer Node, a newer Postgres client, a security bulletin against 24.04.

Also note the pin is the thing holding this closed. If anyone un-pins a runner,
this reopens immediately and the first symptom will again be an unrelated PR
going red.

### actions/cache@v4 and actions/github-script are being forced onto Node 24

From the same run:

```
Node.js 20 is deprecated. The following actions target Node.js 20 but are being
forced to run on Node.js 24: actions/cache@v4, actions/github-script@60a0d83...
```

A warning now, a failure when GitHub stops forcing. Attach it to the next CI
change rather than opening a second front for it: the next time a workflow is
edited, bump those two and verify by effect that the warning is gone.

## ON THE BOARD, NOT STARTED: 89 catch blocks where a failure leaves NO TRACE ANYWHERE

**The sentence that matters:** a `catch` that neither rethrows nor logs produces
a failure **no instrument can see** — not the test, not the migration, not the
masked-failure detector.

That is a different claim from "89 catches the detector does not cover", and only
the first conveys why it matters. Every other population found this month is
invisible *by accident* — a wrong grep, a short-circuiting TypeError, a stale
floor — and became visible once the instrument improved. **This one is invisible
by construction.** There is nothing for an instrument to read.

**The measurement**, from `src` excluding tests:

| | |
| --- | --- |
| `catch` blocks | **256** |
| rethrow | 10 |
| swallow, and LOG (`logger.*` or `console.*` in the body) | **157** |
| swallow, and are SILENT | **89**, across **64** files |

**CORRECTED 2026-11-18 — this item first said 32 across 25 files.** The census
behind it matched only `catch (e) {`, so every bare `catch {` was invisible: 58
of them, and 57 of those are silent, because a catch that never binds the error
cannot log it. The population this item exists for was undercounted by nearly a
factor of three by the instrument meant to size it. The corrected census is
paired with a must-find control; the original was not.

The worst concentrations: `src/app/layout.tsx` (3), then
`HouseholdInvites.tsx`, `SharedGoalsCard.tsx`, `InsightsPageContent.tsx`,
`ValuesPlanSection.tsx` and `usePushNotifications.ts` at 2 each.

**Why it is not started, and what starting it would mean.** This is not a sweep
with a known defect at the end of it — there is no evidence any of the 32 is
currently hiding anything, and by their nature there could not be. The work is
to make the population readable rather than to fix instances: add a log line to
each swallowing `catch` so that the detector (and a human reading CI output) can
see when one fires. That is a one-line change in 32 places, and the value is
entirely in what it makes *possible* later rather than in anything it fixes now.

**Ranking note:** it should be weighed against the fact that
`scripts/ci/detect-masked-failures.sh` keys on the `(non-fatal)` marker. A
swallowing catch that logs *without* that marker is also partly invisible, so
the related and cheaper question is whether the detector's vocabulary should
widen before the silent 89 are touched at all.

---

## ON THE BOARD, NOT STARTED: goal progress is arithmetic over possibly-different currencies

**The finding, in one sentence:** `goals.current_amount`, `goals.target_amount`
and `goal_contributions.amount` are UNITLESS — there is no currency column on
either table — so a goal's progress is raw addition over amounts that may have
been entered in different currencies.

**Verified against production, not inferred** (2026-11-16):

```
goals:              id, user_id, name, target_amount, current_amount,
                    deadline, created_at, updated_at,
                    milestones_celebrated, household_id
goal_contributions: id, goal_id, user_id, amount, note, created_at
```

and the whole accumulator is `goalService.ts`:
`const newAmount = Number(current.current_amount) + Number(input.amount);`
Nothing converts, and nothing *could*: neither table records the unit.

**The most plausible way to reach it needs no household.** One user switching
`preferences.currency_format` mid-goal — say EUR to USD — gets the same unitless
sum in their own goal. The household case (two members, different currencies,
one shared goal) is real too, but needs a second member; the single-user path
needs only a settings change.

**Why it is latent, not live:** production had 0 goals and 0 household-shared
goals at the time of measurement, with 3 users. Nothing in the data is wrong
today; the schema simply cannot express the right answer if anyone does this.

**Why it was NOT pinned in a test:** the savings-expense seam tests in
`src/lib/services/__tests__/goalService.test.ts` assert the ledger entry's
currency (the contributor's, correctly) and deliberately stop there. Pinning
that while the accumulator is unitless would pin half of a broken pair — and a
pinned test becomes the reason a bug survives.

**This is a schema and PRD question, not a code fix:** whether a goal has ONE
currency (and contributions convert into it) or records per-contribution
currencies and converts at read time. Either needs a migration. Do not build for
it until that is decided.

**Provenance, recorded because of how this item nearly failed to exist:** it was
found and agreed on 2026-11-16, and a test comment pointed readers to "the board
item in deferred-work.md" — but the item was not written until 2026-11-18, when a
check of that pointer found nothing. A pointer in code to a board item is a claim;
it was unverified for two days.

**Residual holes in `current_amount == SUM(goal_contributions)`** (added
2026-11-19, from `spec-household-creator-account-deletion`). Migration
`20261119100000` adds an AFTER DELETE statement trigger that recomputes a
SHARED goal's total from its remaining rows whenever contributions are deleted:
by an account deletion, by a goal deletion, and (a side effect) by a member
deleting their own contribution through PostgREST. It does not close these two,
re-derived against the local stack's live `pg_policies` on 2026-11-19:

1. **The personal-goal increment can half-apply.** `goalService.addContribution`
   inserts the contribution, then reads, increments and writes `current_amount`
   in a second statement with no rollback; its own comment, at the line
   `// Step 3: Increment current_amount.`, says so. A failed UPDATE leaves a row
   the total does not include.
   Personal goals are outside the trigger on purpose: the invariant was never
   established for them.
2. **Direct PostgREST writes bypass both services.** `goals` carries
   `Users can update own goals`, so an owner can set `current_amount` to any
   non-negative number. `goal_contributions` carries
   `Users can insert own contributions`, so a member can insert a row no service
   recomputes from. Nothing corrects an INSERT or an UPDATE.

Not measurable from production data (0 goals on 2026-11-18). If it is decided:
recompute on INSERT/UPDATE too, or take `current_amount` off the client-writable
surface. For personal goals, decide first whether the invariant is meant to hold.

## ON THE BOARD, NOT STARTED: account deletion's data removal has never been tested

**The finding:** deleting an account is meant to remove every row the user owns.
Nothing checks that it does: not the unit suite, not the RLS suite.

**A guard we believed we had.** From `81997a9` (2025-12-21) until 2026-11-18,
`settingsService.test.ts` carried a test named *"cascade deletes auth.users
record (verified through RLS and FK constraints)"*. It was a mocked unit test
and verified neither. For eleven months the name sat where the real test would
have gone. It was renamed on 2026-11-18 to what it checks: that
`deleteUserAccount` calls `admin.deleteUser`.

**The claim was also backwards.** The production comment at
`settingsService.ts:316` (`3f90790`, 2025-12-16) said deleting the profile
"cascades to auth.users via ON DELETE CASCADE". The FK is
`user_profiles.id REFERENCES auth.users(id) ON DELETE CASCADE`, so the cascade
runs FROM `auth.users` TO the profile. The code was right anyway, because it
calls `admin.deleteUser` explicitly two statements later. The comment was wrong
and the behaviour correct. Corrected in the same commit.

**What the RLS suite does instead:** two teardowns
(`households.rls.test.ts:79`, `referenceIsolation.rls.test.ts:70`) RELY on the
cascade to clean up, and say so in comments. Neither asserts it. Neither could
notice a failure either: `deleteTestUser` (`src/lib/test-utils/rlsClient.ts:126`)
awaits `admin.auth.admin.deleteUser(userId)` and discards the result, so a
blocking FK would fail the delete and the teardown would still pass. That is a
silent swallow in test infrastructure.

**Production, verified 2026-11-18 (read-only catalog queries):**

```
FKs from public.* to auth.users:   26
  ON DELETE CASCADE                24
  ON DELETE SET NULL                2   household_invitations.invited_by / .accepted_by (deliberate)
uuid columns named like a user reference (MUST-FIND)   26
  of which carry an FK to auth.users                   26   -> no orphan column today
```

So today the schema provides the cascade. The risk is the next migration: a new
`user_id` column without an FK would orphan rows on account deletion, and
nothing would notice.

**Noticed, not decided:** `households.created_by` is ON DELETE CASCADE, and
`households` cascades to `household_members`, `household_invitations`,
`category_budgets` and `personal_allowances` (`categories`, `goals` and
`transactions` go to SET NULL). So when a household's CREATOR deletes their
account, the household disappears for every other member. That is what the FKs
say; whether it is intended is a product question. Also untested: the
`admin.deleteUser` failure path in `deleteUserAccount`, i.e. "Failed to delete
user account" after the profile row is already gone.

**WHAT MECHANISM WOULD CARRY THIS.** None is built. Ranked by what each covers:

1. **A catalog check in the drift job**, which already reads production's
   catalog: every public uuid column that references a user has an FK to
   `auth.users` with CASCADE or a deliberate SET NULL. It is the only option
   that covers a table that does not exist yet. The query above is most of it.
2. **An RLS test**: create a user, insert into each user-owned table, delete the
   user, assert zero rows remain. It covers behaviour, but only for the tables
   it lists.
3. **`deleteTestUser` throws on error.** Cheap. Every RLS teardown would then
   exercise "the delete succeeds", but nothing would assert that the rows are gone.

**STATUS 2026-11-19: options 2 and 3 are built; option 1 is not.** Option 3
landed in #102. Option 2 landed, in a wider form, with
`spec-household-creator-account-deletion`: `account-deletion.rls.test.ts` deletes
six accounts and scans EVERY uuid column of every public table, enumerated from
the catalog at test time, for each deleted id. The auth.users FKs are its
must-find, and a still-living user is its presence control. It scans more than the
FKs because for an FK column the answer is guaranteed by referential integrity;
only a column WITHOUT an FK can still hold a deleted id. That covers the local
stack at test time. Option 1, the production-catalog check in the drift job (the
only one that sees production's schema), is still not built.

## DECISION FOR NIKI: what a household creator's account deletion takes from the other members

Measured read-only on 2026-11-18, from the production FK graph and counts. The
only multi-member household today has 2 members.

**The other member keeps all personal data:**
- their own transactions (12 today). The 1 they shared into the household
  survives and becomes unshared (`household_id` SET NULL)
- their own categories, with the 1 shared one becoming personal
- their goals (shared ones become personal) and their savings-expense rows

**The shared layer is deleted:** the household, every membership row, pending
invitations (3 today), shared budgets (0 today), and personal allowances in that
household (1 today, the creator's own). Household insights are computed, not
stored, so nothing is lost there.

**Lost only if it has been created:** another member's contributions to a goal
the creator owns are deleted with that goal (`goal_contributions` CASCADE). The
member's matching savings-expense transactions survive. There are 0 today.

**A defect, not a product question:** `transactions.category_id` is
ON DELETE RESTRICT. If another member has tagged a transaction with a category
the creator owns (a shared category), the creator's account deletion FAILS
outright, and it fails half-way. `deleteUserAccount` deletes the `user_profiles`
row first and the auth user second, so the profile is gone while the account
and all its data remain; the next login recreates a default profile. There are
0 such transactions today, but the shared-categories feature makes the path
reachable in normal use.

Nobody's personal transactions can be deleted by this cascade. The RESTRICT
blocks first. So the shared-layer loss is a design default to confirm or
change, and the half-deleted profile is a bug to fix.

**STATUS 2026-11-19: DECIDED by Niki and BUILT** in
`spec-household-creator-account-deletion` (migration `20261119100000`). The
household transfers to the longest-standing member. Members keep copies of the
creator's categories they used. Shared objects go to the owner, through the
function `removeMember` now also uses. The half-deletion is fixed by ordering:
the preparation runs first, `admin.deleteUser` runs last, and there is no
explicit profile delete. Production apply is pending, under the standing rule.

## ON THE BOARD (one line): `deferred-work.md` is not Prettier-clean, and that is by scope - `format:check` covers `src/**` only, so docs and `_bmad-output/` are deliberately outside it (decided 2026-11-18, not reopened).

## ON THE BOARD, NOT STARTED: the masked-failure detector is blind in 76 of 261 test files

**The finding (2026-11-18, item 4):** the detector reads only what reaches the
console. **76 of 261 test files mock `@/lib/utils/logger`**, so a swallow routed
through the logger in those files never prints, and the detector cannot see it.
Must-finds for the count: `shared-category-permissions` is among the 76, and
`goalService`, whose swallow the detector did see, is not.

**How it was found:** `shared-category-permissions` had three PUT tests
("is allowed for an admin", "does not gate a PERSONAL category", "does not gate
a colour-only edit") passing on a 500. The hand-rolled chain had no `update`,
the route's catch swallowed the TypeError, and the tests asserted only
`status not 403`. The detector was clean on that file. A probe that asked for
200 found it. The chain migration removed that cause in every hand-rolled file,
so it cannot recur. The bound applies to everything else a mocked logger can
hide.

**WHAT MECHANISM WOULD CARRY THIS:** none is built. A candidate is a
`jest.setup.js` `afterEach` that inspects the mocked logger's recorded `error` /
`warn` calls (`jest.isMockFunction(logger.error)`) for an `Error` whose message
matches the detector's signatures, and prints a line naming
`expect.getState().currentTestName`. That would make the 76 files visible
without un-mocking anything. Until it exists, "detector clean" means clean in
the 185 files whose logger prints.

## ON THE BOARD (one line): a fresh clone HALTs every BMAD 6.11 skill render - the per-user config layer `_bmad/config.user.toml` is gitignored and the 6.8 -> 6.11 upgrade migrated the install but not it (recreated locally 2026-11-19 with `communication_language` only; `user_name` and `user_skill_level` from the old YAML are likewise unmigrated and will HALT any skill that needs them).

## DEFERRED FROM REVIEW: spec-household-creator-account-deletion (2026-11-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md`
  summary: Account deletion is two calls, `prepare_account_deletion` and then `admin.deleteUser`, and a write landing between them is not covered. Each of these is lost or detached without any refusal:
    - another member's new `category_budgets` / `value_categories` row on the deleting user's category (CASCADE), or a `wishlist_items` row on it (SET NULL);
    - an invitation to a sole-member creator's household accepted in the gap (the household then cascades);
    - a concurrent deletion by the member just chosen as new owner.
  evidence: The two calls are separate transactions by Niki's approved design ("one Postgres function makes all preparatory writes; `admin.deleteUser` runs last"). Test 2 proves only the RESTRICT case (`transactions.category_id`), which refuses instead of losing data. The window is the time between two sequential calls in one request. Closing it means either deleting the auth row inside the same SQL transaction, which changes the approved design, or a "deletion pending" marker that the other writers respect. Both are decisions, not patches. The same class, already present: `reassign_member_shared_objects` checks name collisions without locking the owner's categories (a concurrent insert aborts the call: fail-closed, retryable), and `householdGoalService`'s SUM-then-UPDATE can race the trigger.
  decision: 2026-11-19, Niki: ACCEPTED FOR NOW. Revisit if users grow.
- source_spec: `_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md`
  summary: Nobody is told what the deletion changed for them. A member becomes owner and admin without notice, other members find shared categories renamed ("Groceries 3"), and a user whose auth delete was refused gets a 500 after their household ownership has already moved.
  evidence: Product questions, not defects. The refused-delete state is valid and approved (matrix row 40: "prepared writes stand (valid by design)"), and `removeMember` already notifies the removed member through `dispatchCategorizedPush`, so the mechanism exists. Whether to notify, whom, and in what words (en+bg) is Niki's to decide.
  decision: 2026-11-19, Niki: a SEPARATE STORY, later. Not in this one.
- source_spec: `_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md`
  summary: An ACCEPTED invitation keeps the invitee's email address after the invitee deletes their account. `household_invitations.email` is NOT NULL and survives, and only `accepted_by` goes NULL. That is personal data left behind, against P2.
  evidence: This predates the story: invitations were never touched by deletion, and the story's decision ("invitations kept; invited_by/accepted_by NULL") covered attribution, not the address. The test 4 residue scan looks for ids, not emails, so it cannot see this. Options: blank or hash the email of accepted invitations when the acceptor is deleted, or delete accepted invitations, which are history and not pending work. Needs Niki's call.
  decision: 2026-11-19, Niki: NOT for later. It breaks P2, which is already approved, and the migration was still unapplied. FIXED in this story: the BEFORE DELETE trigger `on_auth_user_deleted_remove_invitations` on `auth.users` deletes every invitation the person accepted (`accepted_by`, which also catches an address they later changed) or that is addressed to their email (any status, case-insensitive). Invitations they SENT stay. The residue scan was extended to look for the deleted person's email first, and it went red on exactly those invitation rows before the fix.

## DEFERRED FROM REVIEW, ROUND 2 (the auth.users email trigger): spec-household-creator-account-deletion (2026-11-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md`
  summary: SECURITY QUESTION FOR NIKI. If production lets users sign in without confirming their email, anyone can register an invitee's address, read that invitation's TOKEN from `GET /api/invitations/mine`, and accept it, joining a household they were never invited to.
  evidence: This predates the story; the account-deletion work only touched the deletion side. `listMyPendingInvitations(user.email)` (src/app/api/invitations/mine/route.ts) selects `id, token, ...` for pending invitations whose email equals the signed-in user's email, and nothing checks `email_confirmed_at`. `acceptInvitation` checks only `inv.email === userEmail`. Local `supabase/config.toml` has `enable_confirmations = false`. The production setting cannot be read through the MCP. Read-only data shows 2 of 3 users confirmed within 5 seconds of sign-up, which fits either autoconfirm or Google OAuth. Check: Dashboard -> Authentication -> Providers -> Email -> "Confirm email". A mechanical guard in code (refuse to list or accept unless `email_confirmed_at` is set) would make the dashboard setting irrelevant.
  decision: CHECKED 2026-11-19 by Niki in the dashboard. "Confirm email" is ENABLED in production, so an unconfirmed registration cannot claim an invitee's address. CLOSED.
  dependency: the invitation flow's safety RELIES on that setting staying on. It is a dashboard setting that cannot be read through the database tools, so the drift check cannot guard it, and turning it off would silently reopen this. The code guard above remains the way to remove the dependency.
- source_spec: `_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md`
  summary: The drift dump does not compare function ACLs, so a dropped REVOKE (anon/authenticated EXECUTE on a SECURITY DEFINER function) passes the drift gate.
  evidence: `dump-catalog.sql`'s FUNCTION rows carry `prosecdef` and `proconfig` but not `proacl`. Adding it was measured read-only on 2026-11-19: production and the migrations agree on every function's ACL except `public.seed_user_categories(uuid)`, which is already allowlisted for body and proconfig drift. So adding ACLs means a comparator change and an allowlist update for that one function. For THIS migration's five functions, the grants are asserted locally (account-deletion.rls.test.ts, test 8) and in the production after-snapshot. (The TRIGGER blind spot, auth.* triggers on app functions, was fixed in this story.)
- source_spec: `_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md`
  summary: P2 QUESTION FOR NIKI. GoTrue's own `auth.audit_log_entries` keeps a deleted user's email (the `user_deleted` entry's traits), so the address outlives the account there.
  evidence: Found by the edge-case reviewer: 2310 local rows. The residue scan deliberately excludes the `auth` schema, because GoTrue owns its tables, including its audit log, and the app does not clean them. The options are a decision, not a patch: accept it as a security log with retention as a legitimate interest, or purge audit entries older than N days on a schedule.
  decision: 2026-11-19, Niki: KEEP it as a security log. Do not purge, for now.
- source_spec: `_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md`
  summary: The allowlist entry `migration-ledger-divergence` says 20260924100000 is NOT recorded in production's `schema_migrations`, but a read-only query on 2026-11-19 shows it recorded (`20260924100000 | close_drifted_production_policies`).
  evidence: Its own `resolves_when` says to delete the entry once the version is recorded. Seen in passing while checking how production records migration versions; not verified when or how the row got there.
- source_spec: `_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md`
  summary: INDEX DRIFT, invisible to the drift gate. Production's `idx_invitations_active` is `UNIQUE (household_id, email) WHERE status = 'pending'`, but `021_household_invitations.sql` (and the local stack) define it on `(household_id, lower(email))`. `dump-catalog.sql` has no INDEX kind, so no check compares indexes at all.
  evidence: Read-only `pg_indexes` on production, 2026-11-19, while checking that the new `idx_invitations_email_normalised` collides with nothing (it does not). Harmless in practice today, because `invitationService.normalizeEmail` lowercases before every write. But a write that skipped it could insert a case-variant duplicate pending invitation in production that the migrations would refuse. Fix options: a migration that recreates the index as defined (needs the standing rule), and an INDEX kind in the drift dump.
- source_spec: `_bmad-output/implementation-artifacts/spec-household-creator-account-deletion.md`
  summary: The Supabase MCP `apply_migration` tool CANNOT apply a migration that contains DROP or REVOKE from a non-interactive Claude session. It was declined twice on 2026-11-19 (`"Migration was declined."`), and Niki was never shown a confirmation dialog.
  evidence: The tool describes itself as possibly requiring user confirmation for destructive statements. This session runs non-interactively, so that confirmation can never be shown and every such apply is declined automatically. The tool also takes no version, so it cannot record the repo file's version in `schema_migrations`. Use the CLI instead: `supabase db push` after `supabase login` and `supabase link`, gated by `--dry-run` listing exactly the expected migration. That is how 20261119100000 was applied, and the ledger still matches the repo 48/48.

## ON THE BOARD, from the dependency audit (2026-11-20, `docs/dependency-audit-2026-11-20.md`)

What `npm audit` still reports after the audit PR: 20 (19 moderate, 1 high). None of it is runtime code. Every advisory in code that runs for users or on the server was fixed.

- **`postcss` 8.4.31 (high, four advisories) and `next` (moderate, through it).** Next 15.5.29 pins `postcss` EXACTLY at 8.4.31. npm's only fix is Next 16, a framework major. The advisories need attacker-controlled CSS or source maps at BUILD time; ours are our own stylesheets. Overriding a framework's exact pin across a minor it was not tested with is not cheap-and-safe. **Resolves with:** the Next 16 upgrade, which is its own story (App Router and caching changes), or a 15.x release that moves the pin. Re-check on each Next release.
- **jest chain (18 moderate entries, TWO advisories: glob GHSA-3g3m-2fjr-6pw4, minimatch GHSA-g3hv-75wg-m249).** Even jest 30.5.2 depends on `glob ^13`, and npm marks glob vulnerable through 14.0.1. npm's only fix is a DOWNGRADE to jest 29, which is excluded. Overriding glob across a major inside the test runner is not safe. Dev-only: the inputs are our own test configuration. **Resolves with:** a jest release on a fixed glob. Re-check with `npm view @jest/reporters@latest dependencies.glob`.
- **`next-pwa` 5.6.0 is unmaintained** (its last release is from 2022). It is the reason the `serialize-javascript` override exists (its build chain wants `^4`), and the reason `npm audit fix --force` "fixed" things by downgrading it to 2.0.2. Replacing it (e.g. Serwist) is a change to how the service worker is generated, so it needs a story, not a dependency bump.
- **`@lhci/cli` is an unused devDependency.** No npm script, workflow or lighthouserc invokes it; it was upgraded to 0.16.1 in the audit only because removing it is Niki's call, not a security fix. Removing it would drop a large dev-only dependency tree.
  status: REMOVED 2026-11-20 on Niki's call (unused tooling is attack surface): 293 packages left the tree, 0 added, 0 changed. CORRECTION to the line above: a `lighthouserc.json` DOES exist (added 2025-12-09). My grep searched file contents and this is a filename. What was true is narrower: nothing RUNS lhci, since `09c6690` (2026-06-04) removed the Lighthouse workflow. The config stays for the manual audit in `docs/performance-testing.md`, which installs lhci globally. README and that doc had claimed Lighthouse CI runs on every PR; both corrected.
- **Local npm (11.6.3) and CI npm (10, bundled with Node 22) disagree on lockfiles.** In PR #104 a lockfile written by npm 11 passed every local gate and failed `npm ci` in CI. The cause was an optional peer the two majors resolve differently. Nothing pins the npm major: no `packageManager` field, no `engines.npm`, and CI takes whatever Node 22 bundles. Options: pin one npm major everywhere (`packageManager` with corepack, or an explicit npm install step in CI), or add a pre-push check that runs `npx npm@10 ci --dry-run`. Until then, any lockfile change should be dry-run with CI's npm major before pushing.
  status: RESOLVED 2026-11-20 with a mechanism, not a rule. `package.json` pins `"packageManager": "npm@11.6.3"`. Every CI job installs exactly that npm before `npm ci`, through ONE composite action (`.github/actions/pinned-npm` -> `scripts/ci/pinned-npm.sh`), which fails unless `npm --version` matches. `scripts/__tests__/pinned-npm.test.ts` fails if any job installs from the lockfile without the action first. Mutation-tested: a job missing the step, a blinded parser, a missing pin (in the test and the script), and npm 10 on PATH all go red. Local side: the pin matches Niki's npm; packageManager is enforced locally only with corepack.

- source_spec: `_bmad-output/implementation-artifacts/spec-account-deletion-refused-message.md`
  summary: The notice system for account deletion and member removal (moments 1 and 2, shared goals/budgets to the owner, removeMember), planned as PR 2 in `spec-account-deletion-notifications.md` with Niki's decisions of 2026-11-20.
  evidence: Niki chose [S] on 2026-11-20. Moment 3 stores nothing and needs no table or migration, and it fixes a visibly broken raw English error, so it ships alone as PR 1. The notice system is PR 2.

- source_spec: `_bmad-output/implementation-artifacts/spec-account-deletion-refused-message.md`
  summary: The deletion dialog's 4xx messages (wrong password, missing password) are still the route's English `details` strings, shown to Bulgarian users too.
  evidence: route.ts returns `details: 'The password you entered is incorrect'` / `'Password is required for account deletion'`, and `deletionFailureMessage` shows a 4xx `details` verbatim (PR 1 kept that behaviour; it fixed only the 5xx path). Same class as the raw-error bug PR 1 fixed, but pre-existing.
- source_spec: `_bmad-output/implementation-artifacts/spec-account-deletion-refused-message.md`
  summary: Every existing push notification title and body is hardcoded English, whatever the recipient's language.
  evidence: found while investigating the notifications story (2026-11-20). The push senders build English strings inline and do not read `preferences.language`. PR 2's notice pushes must not copy that pattern. Niki (2026-11-20): PR 2's pushes are localised from the start; localising the existing ones is a separate follow-up.

- source_spec: `_bmad-output/implementation-artifacts/spec-account-deletion-notifications.md`
  summary: A notice push claimed but never sent (the function frozen or killed between claim and dispatch) reads as delivered, so it is never retried.
  evidence: `claimDelivery` inserts the `notification_deliveries` marker before the push, and only an explicit release gives it back. Fixing it needs a lease (claimed_at + confirmed) on that table, which means a schema change. The in-app notice, the channel that reaches everyone, is unaffected.
- source_spec: `_bmad-output/implementation-artifacts/spec-account-deletion-notifications.md`
  summary: The notice push run has no time budget inside the crons; a very large owed backlog could eat the digest's duration.
  evidence: it is capped at 100 notices and 3 per recipient per run, so at today's scale (3 users) it is negligible. A deadline parameter would bound it.
- source_spec: `_bmad-output/implementation-artifacts/spec-account-deletion-notifications.md`
  summary: PRODUCT QUESTIONS for Niki from the PR 2 review. Only the owner is told about a renamed shared category, although every member sees "Food 2". One event can produce up to four notices and three pushes for one person, with no consolidation. A removed person gets no in-app notice, only the existing (English) push.
  evidence: All three are outside the approved scope, so they were raised, not built.
- source_spec: `_bmad-output/implementation-artifacts/spec-account-deletion-refused-message.md`
  summary: Category names must match `/^[a-zA-Z0-9\s]+$/`, so a Bulgarian user cannot create or rename a category in Cyrillic ("Храна"), and nobody can use "&", "-" or "'".
  evidence: found during the #106 production toast check (2026-11-20). The rule is the same in three places: `src/components/categories/CategoryModal.tsx:58`, `src/app/api/categories/route.ts:181` (create) and `src/app/api/categories/[id]/route.ts:27` (rename). Pre-existing, and user-visible for every Bulgarian user.
