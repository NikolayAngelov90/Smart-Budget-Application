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

## hp-14 — `npm run test:rls` green-skips instead of failing loud (filed 2026-08-26)

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
