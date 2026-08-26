# 17-1 — Household screen becomes an index with sub-pages

**Epic 17 — Information Architecture.** Starts the epic. Mirrors what Story 16.8
did for Settings.

Status: in progress

## Problem

`src/app/household/page.tsx` renders one column: three read-only aggregate cards
then `HouseholdSection`, which nests create/join, the transparency preset,
invitations, member management, the personal allowance and the contribution
split editor. 1333 lines across `src/components/household/*.tsx`. Shared
read-only views and destructive management actions share a scroll with no
hierarchy; on mobile, member removal is a long way down.

## Survey — what the code actually looks like

Seven findings, four of which change the proposed design.

1. **`src/app/household/layout.tsx` already exists**, as a SERVER component
   exporting `metadata` and wrapping `AppLayout`. The realtime subscription
   therefore CANNOT simply move into it — `'use client'` and `export const
   metadata` are mutually exclusive. It needs a client child component inside
   the layout.

2. **The transparency preset is INLINE** in `HouseholdSection` (~45 lines: a
   `Select`, a hint, and an active-preset label). It is not a component and must
   be extracted before it can move.

3. **The create/join form is INLINE too**, in the same file's `else` branch,
   together with `PendingInviteBanner`. That is the not-in-a-household state and
   belongs on the index.

4. **Per-category transparency is NOT in the household area.** It is
   `visibility_level` on `CategoryModal` (`src/components/categories/
   CategoryModal.tsx:104`), edited where a category is edited, on `/categories`.
   The spec proposed `/household/sharing` = "transparency preset and
   per-category transparency"; the second half does not live here, and moving it
   would mean editing category visibility away from categories. **Challenged —
   see decisions.**

5. **`SharedGoalsCard` is not a summary.** 201 lines: create a goal, contribute
   to it, per-member breakdown, progress. The spec said to leave goals on the
   index "if it has no more than a summary to show" — it has considerably more,
   so `/household/goals` is justified.

6. **Navigation needs no changes.** `Sidebar.tsx:32` and `BottomNav.tsx:52` both
   match with `pathname === href || pathname.startsWith(href + '/')`, so
   `/household/members` keeps the household item and the More tab active. No
   deep links into household sub-content exist to go stale.

7. **`SettingsSubPage` wraps `AppLayout`** and there is no `(dashboard)/
   layout.tsx`, so that is correct for settings. Household's `layout.tsx` ALREADY
   wraps `AppLayout`, so a shared shell must not wrap it a second time.

## Decisions needing review

**D1 — generalise the shell rather than duplicate it.** Extract the inner chrome
of `SettingsSubPage` (back link, title, description, spacing) into
`src/components/layout/SubPageShell.tsx`, parameterised by `backHref`,
`namespace`, and the back-link label/aria keys. `SettingsSubPage` keeps its
current public API and becomes `AppLayout > SubPageShell(...)`, so all eight
settings routes are untouched. Household sub-pages use `SubPageShell` directly,
since their `AppLayout` comes from `layout.tsx`.

*Alternative rejected:* copy it as `HouseholdSubPage`. Two shells drift, and the
a11y details (44px target, `boxShadow: 'focus'`) are exactly the kind that drift
silently.

**D2 — `/household/sharing` holds the preset only**, plus one line pointing at
`/categories` for per-category visibility. Per finding 4, per-category
transparency is a property of a category. Duplicating that control here would
give two places to set one value.

*If you would rather not have a page for a single `Select`*, the alternative is
to leave the preset on the index and drop `/household/sharing` — say so and it
is a small change either way.

**D3 — the realtime subscription becomes
`src/components/household/HouseholdRealtimeProvider.tsx`**, a client component
rendered by `layout.tsx` around `{children}`. Per finding 1 this is forced. It
keeps the scoped `useSWRConfig` mutate (the global `mutate` is inert against the
localStorage provider — 15-1), the 150ms trailing guard, and the unmount
cleanup, verbatim.

## Route plan

| Route | Contents |
| --- | --- |
| `/household` | In a household: the three aggregate cards + a nav list. Not in one: `PendingInviteBanner` + create form, and NO nav rows into pages that cannot do anything yet. |
| `/household/members` | `HouseholdInvites` (admin) + `HouseholdMembers`. Destructive removal sits apart. |
| `/household/sharing` | Transparency preset (extracted) + pointer to `/categories`. |
| `/household/money` | `AllowanceCard` + `ContributionSplitCard`. |
| `/household/goals` | `SharedGoalsCard`. |

Every sub-page is membership-gated: a non-member is redirected to `/household`
rather than shown a broken shell. No household API route, RPC or RLS policy is
touched — this is presentation only.

## Verification

- Jest: mirror `settings/__tests__/sub-routes.test.tsx`; keep existing
  `src/app/household/__tests__` green, moving assertions to the sub-route rather
  than deleting them.
- Playwright: walk index → each sub-page → back, at phone and desktop; confirm
  the realtime revalidation still fires after the lift, via
  `browser_network_requests` rather than assuming the hook runs.
- Gate: lint, type-check, test, build, plus `test:rls` because household
  transparency is the most policy-sensitive area.

---

## Results

### D4 — a contradiction in the brief, resolved

The brief listed `SharedGoalsCard` in the index's read-only overview AND proposed
`/household/goals`. Building both put **"Shared goals" on the page twice** — once
as the card, once as a row linking to a duplicate of that card. The jest failure
`Found multiple elements with the text: Shared goals` is how it surfaced.

Resolved by taking it off the index: `SharedGoalsCard` creates goals and accepts
contributions, so it is not a read-only aggregate. The index keeps
`HouseholdInsightsCard` and `CombinedSpendingCard`, which are.

### Regression I introduced and fixed

The index derived `inHousehold = !isLoading && !!household`, which collapses
"still loading" into "has no household". **A member on a cold load was shown
"You're not in a household yet. Create one."** The old `HouseholdSection` had its
own skeleton branch; carving it up lost that. Now a skeleton.

Mutation-tested: restoring the collapsed flag turns the new guard red
(1 failed, 3 passed); with the fix, 4 passed.

### Where the moved assertions went

Nothing was deleted with `HouseholdSection.tsx`:

| Was | Now |
| --- | --- |
| `page.test.tsx` realtime AC#5 | `HouseholdRealtimeProvider.test.tsx`, +burst-collapse and +unmount-cleanup cases the original never had |
| `page.test.tsx` shared-goals rendering | `sub-routes.test.tsx` (`/household/goals`) |
| `household-forms.render.test.tsx` create form | `HouseholdCreateCard` |
| `household-forms.render.test.tsx` preset | `TransparencyPresetCard` |
| `mobile-form-layout` 44px on `<Input>`/`<Select>` | follows both new files |
| `designSystemGuards` role-badge recipe | `HouseholdSummaryCard.tsx` |

The tap-target guard's own non-vacuity assertion (`buttons.length > 0`) caught
that `TransparencyPresetCard` has no `<Button>` — it is a `<Select>`. Rather than
drop it from the guard, the button list was split, plus a test asserting the
excluded file genuinely has no `<Button>`, so the exclusion cannot become a hole.

### Verified in a browser

- **Membership gate, end to end.** Navigating directly to `/household/members`
  while not in a household landed on `/household` with the create form. No
  broken shell.
- **The realtime lift works.** `[RealtimeManager] Subscription status:
  SUBSCRIBED` is now emitted from `app/household/layout-*.js` — the layout
  chunk, not the page chunk. Confirmed without writing anything.
- All five routes return 200 server-side; zero `window is not defined` in the
  server log.

### Not verified, and why

**The member-side visual walk did not happen.** The QA account is not in a
household, and creating one is a write to the production database, which needs
sign-off. So the sub-pages were verified by mounting (14 jest cases) and by the
gate redirect, but nobody has yet *looked* at `/household/members`,
`/household/sharing`, `/household/money` or `/household/goals` with real data.

**`npm run test:rls` green-skipped locally** — it reported success having run 0
of 11 suites, because the local Supabase stack is not up. That is the same
false-green the workflow guards against with its "fail loud — never green-skip in
CI" step, so the real signal is CI's RLS job, not this.

### Gate

lint clean · tsc clean · jest **2568 passed** (2546 → 2568) · production build
clean, all five household routes emitted.
