# Story UX-1: Mobile Shell UX Overhaul

Status: done

> Standalone UX improvement (not part of Epics 11–15). Implements the finalized UX spines:
> `_bmad-output/planning-artifacts/ux-designs/ux-Smart-Budget-Application-2026-06-03/DESIGN.md` + `EXPERIENCE.md`.

## Story

As an iPhone user of the installed PWA,
I want the app shell to respect the Dynamic Island/home indicator and use one thumb-friendly navigation,
So that the app feels native and nothing is hidden or hard to reach.

## Acceptance Criteria

1. **Given** the installed PWA on an iPhone with a Dynamic Island, **When** any screen renders, **Then** the blue header fills the safe-area/Island region and its content (title, avatar) sits fully below the Island — never obscured. (`env(safe-area-inset-top)`)
2. **Given** the app shell, **When** it sizes to the viewport, **Then** it uses `100dvh` (not `100vh`) and the content region does not rubber-band the whole page (`overscroll-behavior-y: none`); content never hides behind the bottom tab bar or home indicator.
3. **Given** mobile (<768px), **When** the user navigates, **Then** the **bottom tab bar is the only primary navigator** (Dashboard · Transactions · +Add · Insights · Settings); the hamburger drawer is removed.
4. **Given** the header avatar on mobile, **When** tapped, **Then** an **account bottom-sheet** opens (email, Account/Settings, Sign out) instead of a top-right dropdown; dismiss by swipe/scrim/close; sign-out uses the existing logout flow.
5. **Given** the hamburger is removed, **When** on mobile, **Then** secondary destinations remain reachable: Categories (from Transactions, already; + Settings) and Goals (from Settings "Manage" links).
6. **Given** the bottom tab bar, **When** rendered on iOS, **Then** it has a translucent blurred background, safe-area bottom + left/right insets, active state shown by color **and** label weight, ≥48×48 targets.
7. **Given** accessibility, **When** the app loads, **Then** pinch-zoom is restored (no `maximumScale: 1`).
8. **Given** tablet/desktop (≥768px), **When** rendered, **Then** the Sidebar + FAB are unchanged (no regression).

## Tasks / Subtasks

- [x] Task 1: Viewport + globals (AC: #2, #7) — `layout.tsx` remove `maximumScale: 1`; `globals.css` add `overscroll-behavior-y` on scroll container + safe-area helpers.
- [x] Task 2: Header (AC: #1, #4) — top safe-area padding; remove hamburger on mobile; avatar opens account sheet; safe-area left/right.
- [x] Task 3: AccountSheet component (AC: #4) — Chakra bottom Drawer with email, Account/Settings, Sign out.
- [x] Task 4: BottomNav polish (AC: #6) — backdrop blur + translucent bg + safe-area left/right; active label weight (already color).
- [x] Task 5: AppLayout (AC: #2, #3) — `100dvh`; retire MobileNav; remove `onMenuClick` plumbing; keep content bottom padding clear of tab bar.
- [x] Task 6: Rehome secondary (AC: #5) — add "Manage" links (Categories, Goals) to Settings.
- [x] Task 7: Tests + i18n — update/extend layout tests; account sheet test; ensure no MobileNav references; lint + full suite.

## Dev Notes

- Spines win on conflict; tokens referenced by name from DESIGN.md.
- `MobileNav.tsx` is only imported by `AppLayout.tsx` (no tests) — safe to delete.
- Categories already linked from `transactions/page.tsx`; Goals currently only in desktop Sidebar → add to Settings.
- Keep `black-translucent` + `viewport-fit=cover` (correct once header pads the inset).
- Desktop Sidebar/FAB gated `display={{ base: 'none', md: 'block' }}` — leave as-is.

## Dev Agent Record

### Agent Model Used
claude-opus-4-8

### Completion Notes List

- All 7 tasks implemented; 4 new AccountSheet tests; 1349 total green. TypeScript + ESLint clean. No regressions (settings + BottomNav tests still pass).
- Header now fills the Dynamic Island region (`pt: calc(0.75rem + env(safe-area-inset-top))`) with content below it; hamburger removed; avatar opens the account bottom-sheet.
- AppLayout: `100vh` → `100dvh`; MobileNav.tsx deleted; `onMenuClick` plumbing removed.
- BottomNav: translucent blur + safe-area bottom/left/right; active state already color + weight.
- Settings gains a "Manage" card (Categories, Goals) so both stay reachable on mobile after the hamburger removal.
- **Refinement vs spec:** used `overscroll-behavior-y: contain` (not `none`) on the scroll container — `none` would disable the app's existing custom pull-to-refresh; `contain` still stops scroll-chaining. Documented as a deliberate functional deviation.
- **Scope note:** the account menu is now a bottom-sheet on all breakpoints (simpler than dual paths); Sidebar + FAB remain unchanged on ≥md per AC8.
- Pinch-zoom restored (removed `maximumScale: 1`).

### File List

- src/app/layout.tsx — MODIFIED (removed maximumScale; pinch-zoom restored)
- src/app/globals.css — MODIFIED (overscroll-behavior on scroll container)
- src/components/layout/Header.tsx — MODIFIED (safe-area top/left/right; hamburger removed; avatar → AccountSheet)
- src/components/layout/AccountSheet.tsx — CREATED (bottom-sheet account actions)
- src/components/layout/__tests__/AccountSheet.test.tsx — CREATED (4 tests)
- src/components/layout/AppLayout.tsx — MODIFIED (100dvh; retired MobileNav; removed onMenuClick)
- src/components/layout/MobileNav.tsx — DELETED (hamburger drawer retired)
- src/components/layout/BottomNav.tsx — MODIFIED (translucent blur + safe-area left/right)
- src/app/(dashboard)/settings/page.tsx — MODIFIED (Manage card: Categories + Goals)
- messages/en.json — MODIFIED (header.accountSettings; settings.manage* keys)
- messages/bg.json — MODIFIED (same keys, Bulgarian)
- _bmad-output/planning-artifacts/ux-designs/ux-Smart-Budget-Application-2026-06-03/ — UX spines (DESIGN.md, EXPERIENCE.md, .decision-log.md)

## Senior Developer Review (AI)

**Date:** 2026-06-03 · **Reviewer:** bmad-code-review (three-lens) on commit `cec9437` · **Outcome:** Approved after fixes

### Action Items

- [x] [MED] `100dvh` had no fallback for iOS < 15.4 (PRD targets iOS 14+) — the shell would lose its height. Fixed: `AppLayout` now uses `height: 100vh` with an `@supports (height: 100dvh)` override.
- [x] [LOW] Tab-bar blur lacked the spec's solid-white fallback — content bled through where `backdrop-filter` is unsupported. Fixed: `@supports not (backdrop-filter...)` → solid white in `BottomNav`.
- [ ] [LOW] Account sheet applies on desktop too — intentional simplification (Sidebar+FAB unchanged); left as-is.

Post-fix: 1349 tests green, TypeScript + ESLint clean. (Fixes committed separately.)
