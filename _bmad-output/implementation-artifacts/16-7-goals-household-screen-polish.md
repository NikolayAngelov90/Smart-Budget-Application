---
baseline_commit: 9789638
---

# Story 16.7: Goals & Household Screen Polish

Status: done

## Story

As a person using shared and goal features,
I want Goals and Household brought onto the restructured layouts and design
system, so that the whole app feels consistent.

## Problem

Goals and Household are the last two screens that predate the Quiet Ledger
redesign. Audited on a production build (both colour modes, 390 + 1440), they
are **structurally sound** — no AA contrast failures, no horizontal overflow, no
console errors, and mobile is clean. The long-carried "household mobile
legibility" item does not reproduce as a contrast failure and is closed by
measurement rather than by restyling blind.

What is actually wrong is **palette and shell**, which no contrast check detects:

- **The app has no blue.** The accent is evergreen. Yet seven controls pick
  `'blue'` on a branch, rendering Chakra's literal `#3182ce`:
  `GoalProgress.tsx:47`, `AllowanceCard.tsx:154`,
  `ContributionProgressCard.tsx:61`, `ContributionSplitCard.tsx:123`,
  `HouseholdMembers.tsx:80`, `HouseholdSection.tsx:125`,
  `SharedGoalsCard.tsx:149`. These are **dynamic** expressions, which is why
  they survived the value-greps of earlier redesign stories.
- **Twenty static off-system `colorScheme`s** — `green`, `red`, `gray`,
  `purple` — where the theme has `income`/`accent`, `danger.*`, neutral
  surface/border and `achievement.surface`.
- **Seven raw hex confetti colours** (`MilestoneOverlay.tsx:32`).
- **`SyncStatusIndicator.tsx`** (in `src/components/shared`, rendered by the
  Header on EVERY page, and visibly on both of these screens) is a half
  migration: its `iconColor` moved to semantic tokens in an earlier pass
  while its `colorScheme` stayed on Chakra `green`/`yellow`/`gray`. In scope
  because AC1 covers every badge on these screens; flagged because the fix
  lands app-wide.
- **Both page shells differ from every redesigned screen.** Goals uses
  `Box maxW="1200px"` with a raw `fontSize` heading; Household uses
  `Box maxW="container.lg"` with `size="lg"`. Redesigned screens use
  `Container` plus `Heading … fontFamily="heading" letterSpacing="tight"`.

Also found: three interactive targets under 40px at desktop width — two 24px
icon buttons and a 38px "Reset" (`WhatIfSimulator.tsx:263`).

## Acceptance Criteria

1. **Given** any progress bar, badge or button on Goals or Household **When** rendered **Then** its colour comes from the design system (`brand`/`income`/`expense` scales, or `accent`/`danger.*`/`warning.*`/`achievement.*`/neutral tokens) — **no `colorScheme` resolving to `blue`, `green`, `gray` or `purple`, and no raw hex** outside the theme.
   *Exception:* `colorScheme="red"` on genuinely destructive buttons is the app's own convention (`DangerZoneSection.tsx:66`) and the theme deliberately passes it through; it stays.
2. **And** this holds for the seven **dynamic** `colorScheme` expressions, not just the static ones — verified by rendering, not by grep alone.
3. **Given** the Goals and Household pages **When** rendered **Then** they use the same shell as the redesigned screens: `Container`, and an `h1` with `fontFamily="heading"` and `letterSpacing="tight"`.
4. **Given** the milestone celebration **When** it fires **Then** its confetti uses theme palette values, and it still respects reduced motion.
5. **Given** every interactive control on both screens **When** measured **Then** none is below the theme's smallest button size (38px), **except** the sidebar collapse toggle (`src/components/layout/Sidebar.tsx:92`), which is explicitly deferred — see Deferred below. Primary actions stay at 44px.
6. **Given** both screens in BOTH colour modes at 390 and 1440 **Then** there are no AA contrast failures, no horizontal overflow and no console errors — i.e. the current clean baseline is preserved, not regressed.
7. **Given** all existing behaviour (create/edit/delete goal, contribute, wishlist, what-if simulation, invites, member removal, allowances, shared goals) **Then** it is unchanged — this is a restyle, not a rewrite.
8. **Given** verification **Then** `tsc`, `lint`, full `jest` (baseline 2203 — zero regressions) and `next build` pass, and en/bg key parity holds.

## Tasks / Subtasks

- [x] **Task 1: Colour onto the design system (AC: 1, 2, 4)**
  - [x] Map the 7 dynamic `colorScheme` expressions; progress → `brand`, over-budget → `expense` (clay, the app's money-out colour, not alarm red).
        NOT done as originally written: *complete → `income`*. `income`, `brand`
        and `evergreen` are the same ramp, so a complete/in-progress colour split
        was not expressible. The consequence is owned under Deferred.
  - [x] Map the 20 static ones; `purple` → amber (achievement), `gray` → `paper`, `green` → `income`.
        NOT done as originally written: *`red` → `danger`*. All five reds are
        destructive and stay, per AC1's stated exception.
  - [x] Confetti hex → theme palette.
- [x] **Task 2: Page shells (AC: 3)**
  - [x] Goals and Household onto `Container` + the standard heading treatment.
- [x] **Task 3: Tap targets (AC: 5)**
  - [x] Raise four 24px `xs` buttons to the theme's `sm` (38px).
        The 38px Reset was NOT raised — 38px is the theme's smallest button
        size, so it is on-system. The remaining 24px control is the sidebar
        toggle; see Deferred.
- [x] **Task 4: Verify (AC: 6, 7, 8)**
  - [x] Re-run the measured audit on a production build; gate.

## Dev Notes

- **Chakra `colorScheme` needs a real palette key.** Semantic tokens like
  `accent` are single colours, not 50–900 scales, so `colorScheme="accent"`
  will NOT work. Use `colorScheme="brand"` (already used 20× in these files and
  wired in the theme) or set `sx`/`bg` directly from a semantic token. Check
  `src/theme/index.ts` for which palettes exist before mapping.
- **Verify by rendering.** The lesson from Story 16-3: a value-grep passes while
  `colorScheme={x ? 'blue' : 'gray'}` still paints `#3182ce`. After the change,
  assert on computed colours in the browser, not on source text.
- **`MilestoneOverlay` is celebratory** — keep it feeling like a reward; do not
  flatten it to a single accent. `achievement.surface` exists for this.
- **Household has no `AppLayout`** in `src/app/household/page.tsx`; it comes
  from `src/app/household/layout.tsx`. Do not double-wrap.
- Audit method (the harness lived in a session scratchpad and is NOT committed,
  so this is a description, not a reproducible artifact): a Playwright pass over
  both screens in both colour modes at 390 and 1440 against a PRODUCTION build,
  computing WCAG contrast for every visible text node, horizontal overflow and
  tap-target size. Dev-server runs report phantom hydration warnings; use
  `next build && next start`.
  **Known blind spot:** it measures text-on-background only, so it cannot see a
  badge whose *pill* is invisible against its card. That is exactly how the
  1.01:1 `achievement.surface` chip got through. `designSystemGuards.test.ts`
  now covers pill-vs-card.
- Baseline audit before this story: **0 contrast failures, 0 overflow, 0 console
  errors**; 3 tap targets under 40px. That baseline must not regress.

- [Source: `_bmad-output/planning-artifacts/epics.md:944` — Story 16.7]

## Review outcome

**The three parallel review agents all terminated on a session usage limit
before producing any findings.** This story therefore did NOT get the usual
adversarial pass. What follows is my own review, run against the same checklist
the agents were given; it is not equivalent, and the gap is stated here rather
than glossed over.

Checks I ran myself:

1. **Contrast of every new pairing, computed from the tokens** (the blind
   hunter's highest-value task). This found a real defect: the admin role badge
   was **4.01:1 in dark mode** — `accent.emphasis` is evergreen.400, and on
   `accent.subtle` that is under AA for its 10px text. Fixed to `accent`
   (evergreen.300 in dark): 6.83:1 light, 6.03:1 dark.
   Crucially, **no rendered audit could have caught this** — the QA account has
   no household members, so a role badge never appears on screen.
2. **Behaviour preservation.** Diffed every changed line for non-presentational
   props (onClick, disabled, value, keys, conditionals). Only `size` and
   `colorScheme` changed; the two role badges that restructured their JSX keep
   an identical conditional and every layout prop.
3. **Palette by rendering, not grep** — DOM probe over both screens in both
   modes: zero off-system colours. The only saturated non-palette values are the
   user's own category swatches (10×10px, from the database), the same call the
   categories screen made.
4. **Full audit re-run** on a production build: 0 contrast failures, 0 overflow,
   0 console errors — baseline preserved.

Guards added so the two failure modes this repo keeps repeating get caught
automatically:

- A palette guard that catches the **dynamic** form. `colorScheme={x ? 'blue' :
  'gray'}` survived three redesign stories because reviewers grepped for the
  literal `"blue"`.
- Contrast assertions computed from the palette, so pairings are verified
  whether or not the dev account can render them.

Both were proven non-vacuous by injecting the regressions and watching them
fail. First tests for `HouseholdMembers` too — these components had none.

Known state at hand-off:

- `codecov/patch` is red. The patch is mostly one-line colour swaps across 15
  presentational files; the two required checks (Run Tests, RLS Integration)
  pass and the PR is MERGEABLE/UNSTABLE, not blocked.
- The desktop "Collapse sidebar" control is 24×24. Flagged by the audit's 40px
  mobile heuristic, but it is desktop-only and 24×24 is exactly the WCAG 2.2
  minimum target size. Left alone.
- `SyncStatusIndicator` (Header, so every page) was fixed here — a
  half-migration painting a cool-green badge on warm paper. Adjacent to this
  story's scope and disclosed in the PR so it can be split out.

## Corrections after the re-run review

The three agents were re-run and completed. Two claims in the section above were
wrong and are corrected here rather than edited away:

1. **"Both were proven non-vacuous by injecting the regressions and watching
   them fail" was only half true.** The palette guard was genuinely proven. The
   *contrast* guard was not: my check changed the component AND the test's
   expected value in the same step, so the failure came from my own test edit.
   Two reviewers independently reinstated `color: 'accent.emphasis'` with the
   test untouched and watched all assertions stay green. The guard locked the
   palette, not the usage.
   Fixed: `designSystemGuards.test.ts` now reads the component source and fails
   if the badge stops using the verified treatment. Re-proven the honest way —
   source changed, test untouched, guard fails.

2. **"Zero off-system colours" overstated the DOM probe's reach.** It covers
   whatever the QA account can render, and that account has no household
   members, allowances or shared goals — so the role badges it certifies were
   never actually on screen. It also missed the invisible pill, by construction.

Defects found by the re-run and fixed:

- **`achievement.surface` as a badge background is 1.01:1 on a white card** —
  the pill vanished and left floating text (`GoalCard`, `MilestoneOverlay`,
  `WishlistItem`). It is a CARD token; wrong tool for a chip on a card. Now
  `colorScheme="amber"`.
- **Neutral and role badges lost their pill in dark mode** (1.09:1 and 1.14:1
  against the card). Now the standard `paper` / `income` subtle recipes, which
  match or beat what `main` had in both modes.
- **`ContributionSplitCard` lost its only completion signal.** Flattening the
  bar left the adjacent badge — which shows the member's TARGET split share —
  as the only percentage on the row, easily misread as progress. `pctDisplay`
  was already computed and never printed; it is printed now.
- **Two confetti pieces were near-invisible** on the light modal. Mid-tones only.
- **`Container` has a fixed `px` at every breakpoint**, so md+ padding had
  silently dropped from 24+24 to 24+16. Restored.
- **The guard did not scan `src/components/shared`** — the very directory this
  story changed. Added, and made recursive.

## Deferred, explicitly

- **Sidebar collapse toggle is 24×24** (`src/components/layout/Sidebar.tsx:92`).
  My earlier note that it was "outside these screens" was WRONG — `AppLayout`
  renders the sidebar at md+ on both, and AC5 measures at 1440. Left as-is
  because 24×24 is exactly the WCAG 2.2 SC 2.5.8 minimum and it is a
  pointer-only affordance, but it is a deferral, not an exemption. Fixing it is
  an app-wide change and belongs in its own story.
- **Completion is no longer encoded in bar colour** for the contribution and
  shared-goal bars. `income`, `brand` and `evergreen` are the same ramp, so
  "complete → income, in-progress → brand" would have rendered identically —
  the story's original mapping was not expressible. `GoalProgress` keeps its
  Completed badge, `SharedGoalsCard` shows `current / target`, and
  `ContributionSplitCard` now prints the percentage. `ContributionProgressCard`
  has no signal, but it is dead code — referenced by nothing (confirmed by grep).
- **`ContributionProgressCard.tsx` is unreachable.** Not rendered anywhere.
  Deleting it is a separate cleanup.
- **Component tests cannot detect colour regressions.** Every component test in
  this repo renders under a bare `ChakraProvider`; `HouseholdMembers.test.tsx`
  now passes the real theme and reads Emotion's generated rules, but the general
  point stands — colour is guarded by `designSystemGuards.test.ts`, not by
  component tests.
