---
baseline_commit: 5f7a6bf
---

# Story 16.6: Dashboard Period Selector

Status: done

## Story

As a person reviewing my money over time,
I want a Week / Month / 3 Months / Year selector on the dashboard hero,
so that I can see my balance and flow for the period I care about.

## Problem

`BalanceFlowHero` is hardwired to the current calendar month. `useDashboardStats`
only accepts `month=YYYY-MM`, and `/api/dashboard/stats` computes exactly two
ranges: this calendar month and the previous one.

Two things follow from that:

- **No way to widen or narrow the view.** "How did this year go?" and "how is
  this week tracking?" are unanswerable from the dashboard.
- **The hero's biggest number is mislabelled.** It reads `TOTAL BALANCE`, but
  the API returns `balance = income − expenses` **for the current month only**.
  It has never been a total balance. Adding a selector makes the mislabel
  glaring, so this story corrects it.

## Decisions

Both settled with the user before implementation:

1. **The big number is the selected period's net**, and its label follows the
   period ("This week" / "This month" / "Last 3 months" / "This year"). This is
   what the number has always been; the label finally says so, and the selector
   visibly drives it.
2. **Scope is the hero only.** The epic says "a selector on the dashboard hero".
   The category chart, spending trends and month-over-month keep their own
   ranges — wiring those to the selector is a separate, larger story.

Not doing: persisting the choice across visits. The selector resets to Month on
each load. Reading a stored value during render is a hydration hazard, and the
epic does not ask for it — worth revisiting as its own change.

## Acceptance Criteria

1. **Given** the dashboard hero **When** it renders **Then** it shows a period selector with **Week, Month, 3 Months, Year**, defaulting to **Month**.
2. **And** selecting a period updates the hero's net figure, the flow bar, the In / Left / Out figures and the caption to that period's data.
3. **Given** the hero's primary figure **When** any period is selected **Then** its label names that period, and the figure is that period's net (in − out) — the `TOTAL BALANCE` label is gone.
4. **Given** the trend chip **When** a period is selected **Then** it compares against the **immediately preceding window of equal length** (week vs previous week, year vs previous year) and its label says so.
5. **Given** `/api/dashboard/stats` **When** called with `period=week|month|quarter|year` **Then** it returns that period's aggregates plus the preceding equal-length window; **and** calls with no `period` (or with `month=YYYY-MM`) keep their current behaviour exactly.
6. **Given** date ranges **When** computed **Then** they use local-time `yyyy-MM-dd` strings — never `toISOString()` — because `transactions.date` is a DATE column and UTC conversion misbuckets transactions near midnight.
7. **Given** a transaction is added, or pull-to-refresh runs **When** the hero is on any period **Then** it revalidates. (The hero's SWR key now carries the period, so exact-key `mutate('/api/dashboard/stats')` calls no longer match it — see Dev Notes.)
8. **Given** the selector **When** used on mobile **Then** controls are ≥44px, reachable at 390px with no horizontal overflow, keyboard-operable with visible focus, AA contrast in BOTH colour modes; the selected option is exposed to assistive tech.
9. **Given** verification **Then** `tsc`, `npm run lint`, full `jest` (baseline 2152 pass — zero regressions) and `next build` pass; new strings exist in BOTH `messages/en.json` and `messages/bg.json`.

## Tasks / Subtasks

- [x] **Task 1: API period support (AC: 5, 6)**
  - [x] Add `period` to `/api/dashboard/stats`; derive current + previous equal-length ranges with `date-fns` on local time, formatted `yyyy-MM-dd`.
  - [x] Keep `month=YYYY-MM` and the no-param default working unchanged.
  - [x] Return the resolved `period` (and range) in the response.

- [x] **Task 2: Hook + hero wiring (AC: 1, 2, 3, 4)**
  - [x] `useDashboardStats` accepts a period.
  - [x] Period selector control in `BalanceFlowHero`; relabel the primary figure per period; trend chip compares to the previous equal window.

- [x] **Task 3: Revalidation (AC: 7)**
  - [x] Replace the exact-key `mutate('/api/dashboard/stats')` calls in `src/app/dashboard/page.tsx` with the predicate form so every period key revalidates.

- [x] **Task 4: i18n + verify (AC: 8, 9)**
  - [x] Period labels, per-period figure labels, per-period trend labels and captions in en + bg.
  - [x] Gate + live QA in both modes at 390/1440.

## Dev Notes

- **Source files**: `src/components/dashboard/BalanceFlowHero.tsx` (267 lines),
  `src/lib/hooks/useDashboardStats.ts`, `src/app/api/dashboard/stats/route.ts`.
- **The SWR-key trap (AC7)**: `src/app/dashboard/page.tsx:76` (pull-to-refresh)
  and `:329` both call `mutate('/api/dashboard/stats', …)` with an EXACT key.
  Today the hero's key is exactly that, so it works. Once the key becomes
  `/api/dashboard/stats?period=week&currency=EUR` those calls silently stop
  matching and the hero goes stale after adding a transaction — with no error.
  `AppLayout.tsx:80-88` already has the predicate form and is safe; copy it.
- **Week start**: use `weekStartsOn: 1` (Monday). The app defaults to EUR and
  ships en + bg; a locale-dependent week start would make the same data render
  two different totals.
- **"3 Months"** means the current month plus the two before it (inclusive),
  compared against the three months before that.
- **Caption keys** are month-worded today (`keptShare` = "…came in this month",
  `flowEmpty`, `overspentMonth`). They need per-period variants or a
  period-name interpolation.
- `DashboardStats.tsx` also calls `useDashboardStats`, but it is referenced only
  by its own test — it is not rendered anywhere in the app. Leave it alone;
  changing the hook must not break it.
- Degradation policy (`docs/api-conventions.md#Error-Handling`): a core-input
  failure returns 500 rather than an empty result, so the SWR localStorage cache
  is never poisoned with a zero-filled period.

- [Source: `_bmad-output/planning-artifacts/epics.md:934` — Story 16.6]

## Review outcome (3 parallel reviewers)

Patched:

1. **Duplicate eyebrow** - `netThisMonth` and `thisMonth` are the same string,
   so the hero printed "THIS MONTH" twice, ~40px apart. Dropped the second
   eyebrow; the figure above already names the period. (Visible in my own QA
   output before review; I missed it.)
2. **Mislabelled money during a switch** - `keepPreviousData` holds the old
   period's figures while the new ones load, and `isLoading` stays false
   because data is present, so the hero showed e.g. last month's 905 EUR under
   "THIS YEAR". Now labelled from `data.period` (the server echoes the window
   it aggregated), with a dimmed `aria-busy` state while switching.
3. **Trend compared a partial window against a complete one** - every current
   window runs to the END of the period, so on the Monday of a new week one
   day's data was compared with a full previous week: "down 85.8% vs last
   week", in red, for most of every window. `previous` is now truncated to the
   same elapsed days, with a clamp so a 31-day month-to-date cannot spill past
   a 28-day February. Opt-in, so the pre-16.6 API paths are untouched.
4. **Windows derived from the server's UTC clock** - `transactions.date` is
   written as the client's LOCAL day, so a Sofia user (UTC+3) adding a
   transaction at 00:30 Monday had it fall outside BOTH windows and vanish.
   The client now sends its local date; the server clamps it to +/-1 day.
5. **One failing period trapped the user** - the error card replaced the whole
   hero including the selector, leaving no way back to a period that works.
   The selector now stays mounted in the error state.
6. **"You kept -0%"** - `Math.round(-0.4)` is `-0` and `-0 >= 0` is true, so a
   0.40 EUR overspend was reported as a saving. Branches on the amount now.
7. **Trend chip vanished when the previous window netted exactly zero** -
   1,000 in and 1,000 out is real activity worth comparing. Gated on total
   activity instead; far likelier over a week than a month.
8. **Layout at the extremes** - "3 Months" (and the Bulgarian labels)
   overflowed its segment at 320px; the big figure overflowed its clipping
   container from 123,456.78 upward at 390px, which Year makes ordinary. Both
   measured in-browser, fixed, and re-measured.
9. **Duplicate request** - the hero's key gained `?period=`, so it no longer
   deduped with the dashboard page's call: two identical aggregations per load.
10. **Test hardening** - the route stub ignored column names and the user
    filter, so a dropped `.eq('user_id')` or a wrong column would have kept
    every test green. Both asserted now.

Deferred (noted, not fixed):

- **Cached window replay.** A page reloaded the morning after browsing on Week
  briefly renders the previous week's cached figures under "This week" until
  revalidation lands (~1 request). Detecting it needs a client/server date
  comparison that risks false positives across timezones; SWR revalidates on
  mount, so it self-heals.
- **Page section eyebrow.** "Where it's going" still reads "This month" while
  the hero may say "This year". Correct - those charts are month-scoped - but
  it follows from the deliberate hero-only scope and is the likeliest thing to
  be reported. Worth folding into a follow-up that widens the selector's reach.
