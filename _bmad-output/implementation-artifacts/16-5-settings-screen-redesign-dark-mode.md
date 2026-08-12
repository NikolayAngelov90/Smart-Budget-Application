---
baseline_commit: 322b5d2
---

# Story 16.5: Settings Screen Redesign + Dark Mode

Status: done

<!-- Epic 16 "Design System Rollout" (Phase 3). Brings Settings onto the Quiet
Ledger design system AND makes dark mode real app-wide. -->

## Story

As a person managing my account,
I want grouped, mobile-native settings and a Light/Dark/System appearance toggle,
so that settings are simple and I can use the app in the mode I prefer.

## Context / scope decision

The epic assumed "the semantic tokens are already dark-ready". They are *defined*
dark-ready (21 `_dark` values), but **394 hardcoded colour hits across ~35
components bypass them** — AI insight panels, analytics charts, goals, household,
and Settings itself. The app shell and the four redesigned screens (16-1..16-4)
are clean. Shipping a toggle without converting the rest would put a dark frame
around white cards and grey-on-grey text. Scope confirmed with the user: **do the
full job** — redesign Settings, ship the toggle, AND convert the remaining
hardcoded colours so dark mode is genuinely usable.

## Acceptance Criteria

1. **Given** the Settings page **When** it renders **Then** it is grouped and mobile-native on Quiet Ledger tokens — no `gray.*`, `bg="white"`, `blue.*`, `colorScheme="blue"`; sections read as cards with clear headings, ≥44px controls, and the existing 6 groups (Manage, Account, Preferences, Export, Sync status, Privacy & security) remain findable.
2. **Given** an Appearance control in Settings **When** the user picks **Light / Dark / System** **Then** the app switches immediately, the choice **persists across a reload**, and **System** follows the OS preference live (`prefers-color-scheme` changes apply without a reload).
3. **And** the choice does not flash the wrong theme on load: `ColorModeScript` runs before hydration, and the document background is theme-aware (today `globals.css` hardcodes `#f6f5f2`, which would keep the canvas light in dark mode).
4. **Given** dark mode is active **When** the user visits Dashboard, Transactions, Categories, Insights, Goals, Household, Analytics and Settings **Then** every surface is legible: no white-on-white cards, no grey-on-grey text, AA contrast for body text and amounts. The ~394 hardcoded colour hits are converted to semantic tokens.
5. **And** charts (recharts) are readable in both modes — they take raw colour strings, so they must read theme values (e.g. `useToken`/CSS vars) rather than hardcoded hex.
6. **Given** the mobile browser chrome **When** dark is active **Then** `themeColor` reflects the active mode (currently pinned to `#F6F5F2`).
7. **Given** ALL existing behavior **When** exercised **Then** it is preserved: profile edit + picture upload, currency/date/language preferences, weekly-digest + push + gamification toggles, CSV/PDF export, sync status, active devices + revoke, GDPR delete, achievements, and the Manage links.
8. **Given** the redesign **When** verified **Then** `tsc`, `npm run lint`, full `jest` (baseline 2104 pass / 54 skip — zero regressions) and `next build` pass; new strings exist in BOTH `messages/en.json` and `messages/bg.json`.
9. **Given** mobile + desktop **When** viewed **Then** no 320px overflow, ≥44px touch targets, visible focus, AA contrast, `minmax(0,1fr)` grid tracks.

## Tasks / Subtasks

- [x] **Task 1: Dark-mode infrastructure (AC: 2, 3, 6)**
  - [x] Add `ColorModeScript` (matching `initialColorMode`) to `app/layout.tsx` body so the stored mode applies pre-hydration — currently ABSENT, so dark would flash light and not persist.
  - [x] `globals.css`: replace the hardcoded `html { background-color: #f6f5f2 }` with a theme-driven canvas (Chakra `styles.global` or a `_dark`-aware CSS var) so the page background follows the mode.
  - [x] Tri-state Light/Dark/System: Chakra's `colorMode` is binary, so persist the user's *preference* separately (`system` included) and resolve it to a colour mode, subscribing to `prefers-color-scheme` changes while on System.
  - [x] Make `themeColor` mode-aware (light `#F6F5F2` / dark canvas).

- [x] **Task 2: Settings redesign + Appearance control (AC: 1, 2, 7)**
  - [x] Regroup `settings/page.tsx` (1201 lines) into token-based section cards with `Heading` on `fg`/`fontFamily="heading"`; convert its 32 raw-colour hits.
  - [x] Add an **Appearance** section: a 3-way Light/Dark/System control (segmented, ≥44px, keyboard + SR accessible), wired to Task 1's preference.
  - [x] PRESERVE every existing control and its handler (see AC7).

- [x] **Task 3: App-wide token conversion (AC: 4, 5)**
  - [x] Convert the remaining hardcoded colours (~394 hits) prop-aware: text `gray.500/600/700/800` → `fg.subtle`/`fg.muted`/`fg`; borders `gray.200/300` → `border`/`border.strong`; `bg="white"`/`gray.50` → `surface`/`surface.sunken`; `blue.*` → `accent`; `colorScheme="blue"` → `brand`. Keep true red for genuine errors/destructive only.
  - [x] Charts: feed recharts theme-resolved colours (`useToken`) so axes/grids/series are legible in dark.
  - [x] Do NOT regress the already-clean shell + 16-1..16-4 screens.

- [x] **Task 4: Verify (AC: 8, 9)**
  - [x] `tsc`, `npm run lint`, full `jest`, `next build`.
  - [x] Live QA **in both modes** across Dashboard, Transactions, Categories, Insights, Goals, Household, Analytics, Settings at 390 + 1440; check no white-on-white, AA contrast, persistence across reload, and System following the OS.

## Dev Notes

- Theme config today: `initialColorMode: 'light'`, `useSystemColorMode: false` (`src/theme/index.ts:12-14`). Semantic tokens already carry `_dark` values (surface/fg/border/accent/income/expense/warning).
- The shell (`components/layout/*`) and 16-1..16-4 screens are already token-clean — use them as the reference for the conversion.
- Chakra `colorMode` is binary (`light`/`dark`); "System" must be a separate stored preference resolved at runtime (and re-resolved on `matchMedia('(prefers-color-scheme: dark)')` change).
- Prior-story lessons that apply: `minmax(0,1fr)` grid tracks (16-3), `borderLeftWidth` not the `borderLeft` shorthand (16-4), and grep the PROP name not just literal values — dynamic `colorScheme={x ? 'blue' : 'gray'}` hides from a value grep (16-4).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-16.5]
- [Source: memory redesign-quiet-ledger] — tokens, gotchas, prior stories.

## Dev Agent Record

### Agent Model Used

claude-opus-5 (dev-story)

### Debug Log References

### Completion Notes List

- Scope decision (with the user): the epic assumed tokens were dark-ready, but 394 hardcoded hits bypassed them, so a toggle alone would have shipped a broken dark mode. Did the full conversion.
- Infrastructure: NO ColorModeScript existed; globals.css hardcoded the light canvas; Chakra's colorMode is binary. Fixed with an inline pre-hydration script, a mode-aware canvas, and a tri-state preference in an external store applied app-wide by `<AppearanceSync/>`.
- ~410 conversions across 70+ files; money red/green -> income/expense; 6 charts onto a mode-aware palette; heatmap ramp onto tokens.
- TWO adversarial passes. Edge Case Hunter: P0 invisible text on fixed `orange.50` cards (the same bug I fixed in AchievementsSection and re-introduced in three others), System tracking only on /settings, radios with no accessible name, heatmap dark ramp collapsing at 1.06:1, inverted error semantics. Blind Hunter (run at the user's request after it was lost twice): Chakra's provider effect overriding the mode when its storage key was unreadable, three missed auth links at 2.46:1, and a pressed-button regression (1.71:1) caused by the fg.onAccent flip itself.
- Verified live, measured in-browser: dark low-contrast 23 -> 0 (Settings) and 6 -> 0 (Dashboard); light 0; themeColor follows the mode; storage-blocked scenario stays dark.
- Deferred: chart first-frame light flash (needs a CSS-var palette, not useColorModeValue); CategoryBadge swatch ring invisible for dark user colours in dark mode.

### File List

- NEW `src/lib/hooks/useAppearance.ts` (+2 test files), `src/lib/hooks/useChartColors.ts`, `src/components/settings/AppearanceSection.tsx`
- MODIFIED `src/app/layout.tsx` (pre-hydration script, themeColor), `src/app/providers.tsx` (AppearanceSync + colorModeManager), `src/app/globals.css`, `src/theme/index.ts` (new tokens), `public/manifest.json`
- MODIFIED ~80 components/pages for the token conversion; `__tests__/pwa/manifest.test.ts`
