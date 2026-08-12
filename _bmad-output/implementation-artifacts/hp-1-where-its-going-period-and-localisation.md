# HP-1 — "Where it's going": period reach, tz correctness, localisation

**Type:** Hardening pass (post-Epic-16). Not new feature scope.
**Source:** Epic 16 retrospective §7 — "The natural follow-up is widening the
period selector's reach."
**Status:** in review
**Created:** 2026-07-31

---

## Why

The dashboard's "Where it's going" section is the last region the Quiet Ledger
rollout never reached. Epic 16 shipped the period selector with a deliberate
**hero-only** scope (16-6, agreed with Nikit), which left a visible seam. While
scoping that seam, two further defects surfaced in the same three components.

### 1. The period seam (known, from the retro)

The section eyebrow is hardcoded `t('thisMonth')`. Switch the hero to "Year" and
the page reads **"This year"** above a section captioned **"This month"**, with a
donut underneath showing month figures. Nothing tells the user which is which.

### 2. A half-landed timezone fix (NEW — found while scoping)

The deferred-work batch gave `/api/dashboard/spending-by-category` a `?today=`
parameter so the month window comes from the user's **local** day rather than the
server's UTC clock. `src/app/categories/page.tsx:125` sends it. The dashboard's
own hook, `useSpendingByCategory`, **never did** — it still builds a bare URL.

So the fix is live on one screen and inert on the other, and the two disagree:

> A UTC+3 user opens the app at 01:30 on the 1st. The categories screen says
> they've spent 0 лв. this month. The dashboard donut says they've spent
> 1,240 лв. — the whole of the previous month. Same endpoint, same user, two
> different answers, no error anywhere.

This is the exact class the batch set out to close. It was closed halfway.

### 3. All three widgets are hardcoded English

`CategorySpendingChart`, `SpendingTrendsChart` and `MonthOverMonth` predate
next-intl and were never migrated: titles, empty states, error states, chart
legends, tooltips and the visually-hidden a11y tables are all literal English.

Worse, the page renders a **localized** `h3` immediately above the chart's **own
English** `h3`, so a Bulgarian user sees the heading twice in two languages:

```
Разходи по категория          <- page.tsx, t('spendingByCategory')
┌──────────────────────────┐
│ Spending by Category     │  <- CategorySpendingChart, hardcoded
│ Total: 1,240 лв.         │
```

`spendingTrends` also reads "(Last 6 Months)" while the chart renders **3**
months on mobile (`useBreakpointValue`) — the label states a window the chart
isn't showing.

---

## Scope decision

Asked and settled with Nikit before building: **the pie follows the period; the
other two state their own windows.**

| Widget | Window | Why |
|---|---|---|
| Spending by category | **Follows the hero** | "Where did my money go" is exactly the question the period modifies. |
| Spending over time | Fixed 6-month series (3 on mobile) | It IS a time axis; re-deriving granularity per period is a different feature. Now labelled with its real count. |
| This month vs last month | Month-over-month | Self-titled and inherently month-paired. Rewriting it into period-over-period was the rejected wider option. |

Rejected: making all three follow the period (three endpoints + a Month-over-Month
copy rewrite in two languages), and relabelling only (kills the lie, delivers
nothing).

---

## Acceptance criteria

**Period reach**
1. The hero's period selection drives the category donut. Selecting "Year"
   re-aggregates it over the year.
2. The section eyebrow names the period actually **shown**, derived from the
   server's echoed `period`, never from the pending selection — the 16-6 lesson:
   `keepPreviousData` keeps the previous figures on screen while the next window
   loads, so labelling by selection prints "This year" over last month's money.
3. `/api/dashboard/spending-by-category` accepts `?period=week|month|quarter|year`,
   defaulting to `month`. An explicit `?month=YYYY-MM` still wins (drill-down).
4. An unknown `?period=` value falls back to `month` rather than erroring.

**Timezone**
5. `useSpendingByCategory` always sends the client's local `?today=`, so the
   dashboard donut and the categories screen resolve the same window.
6. Period windows are compared as `yyyy-MM-dd` strings against the `date` DATE
   column — never `toISOString()`, which shifts local midnight into the previous
   UTC day.

**Localisation**
7. No user-visible English literal remains in the three components: titles,
   totals, empty states, error states, tooltips, chart legends, ARIA labels and
   the hidden data tables.
8. The duplicate heading is gone — one title per card.
9. The trends label states the window actually rendered (3 on mobile, 6 on
   desktop), not a hardcoded 6.
10. `en.json` and `bg.json` stay at full key parity (CI-enforced).

**Non-regression**
11. The page's `hasNoTransactions` empty-state gate stays month-scoped whatever
    the hero shows — it decides whether a user has *any* data, which is not a
    period question.
12. Existing prefix-based `mutate` calls still match the donut's key after it
    grows `?period=`.

---

## Implementation notes

- Period state lifts from `BalanceFlowHero` to `DashboardPage` and is passed to
  both the hero and the donut as explicit props. Chosen over a context because
  there are exactly two consumers on one page; context would hide the coupling
  for no benefit.
- The route reuses `resolvePeriodRanges` from `lib/utils/dashboardPeriod.ts`
  (Story 16-6) rather than growing a second copy of the range arithmetic. Note
  it is called **without** `comparePartial` — that option exists to make a
  *trend* comparison like-for-like, and this endpoint has no previous window.
- The response keeps `month` for back-compat (the categories screen reads it)
  and adds `period`.
