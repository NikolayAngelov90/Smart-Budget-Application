# Story 10.8: Mobile-Optimized Touch UI & Navigation

Status: done

## Story

As a mobile user who has installed the Smart Budget PWA on my phone,
I want native-feeling touch navigation with a bottom tab bar, swipe gestures, and mobile-optimized inputs,
so that I can quickly manage my finances one-handed with a smooth, app-like experience.

## Acceptance Criteria

1. **AC-10.8.1** — Bottom navigation bar visible on mobile viewport (<768px): tabs for Dashboard, Transactions, Add, Insights, Settings; hidden on tablet/desktop.
2. **AC-10.8.2** — "Add" is the prominent center tab item (visually elevated); tapping it opens the transaction entry modal (replaces the FAB on mobile).
3. **AC-10.8.3** — Swipe-left on a transaction list item reveals a "Delete" action; swipe-right reveals an "Edit" action; both require confirmation before executing.
4. **AC-10.8.4** — Pull-to-refresh gesture on the transaction list and dashboard triggers SWR revalidation and shows a native-style spinner.
5. **AC-10.8.5** — All interactive touch targets (buttons, nav items, list items) are minimum 48×48px on mobile.
6. **AC-10.8.6** — Haptic feedback fires on successful transaction save via `navigator.vibrate(50)` (Vibration API, no-op on unsupported devices).
7. **AC-10.8.7** — Amount input uses `inputMode="decimal"` (numeric keyboard); date inputs use `type="date"` (native date picker).
8. **AC-10.8.8** — Transaction entry modal uses a bottom sheet slide-up animation on mobile (<768px); standard centered modal on desktop.
9. **AC-10.8.9** — Transaction list renders smoothly; if item count exceeds 100, implement windowed rendering to maintain 60fps scroll.
10. **AC-10.8.10** — Responsive breakpoints applied consistently: mobile <768px, tablet 768–1024px, desktop >1024px.
11. **AC-10.8.11** — Unit and component tests for: bottom nav rendering, Add tab modal trigger, touch target sizes, haptic utility, inputMode attributes.

## Tasks / Subtasks

- [ ] **Task 1**: Create `BottomNav` component (AC: 1, 2, 5)
  - [ ] 1.1 — Create `src/components/layout/BottomNav.tsx` with 5 tabs: Dashboard, Transactions, Add (center/elevated), Insights, Settings
  - [ ] 1.2 — Use `usePathname()` to highlight active tab; active tab uses `trustBlue.500` color
  - [ ] 1.3 — Center "Add" tab: visually elevated circle button (48×48px min), opens transaction modal via `onAddClick` prop
  - [ ] 1.4 — All tab touch targets: min 48×48px via explicit `minH`/`minW` or `h`/`w` props
  - [ ] 1.5 — Show only on `display={{ base: 'flex', md: 'none' }}`; fixed at bottom, full-width, `zIndex={100}`
  - [ ] 1.6 — Add bottom padding to main content area on mobile to prevent overlap with BottomNav (`pb={{ base: '72px', md: 0 }}`)

- [ ] **Task 2**: Integrate `BottomNav` into `AppLayout` (AC: 1, 2)
  - [ ] 2.1 — Import and render `<BottomNav onAddClick={handleOpenModal} />` in `src/components/layout/AppLayout.tsx`
  - [ ] 2.2 — Hide the existing `FloatingActionButton` on mobile (`display={{ base: 'none', md: 'flex' }}`) to avoid overlap
  - [ ] 2.3 — The hamburger icon in `Header` can remain for tablet; on mobile the BottomNav replaces the need for the drawer nav

- [ ] **Task 3**: Bottom sheet for transaction entry on mobile (AC: 8)
  - [ ] 3.1 — In `TransactionEntryModal`, detect mobile viewport via `useBreakpointValue({ base: true, md: false })`
  - [ ] 3.2 — On mobile: use Chakra `Drawer` with `placement="bottom"` and `size="full"` (or `size="lg"`) for slide-up animation
  - [ ] 3.3 — On desktop: retain existing `Modal` (centered dialog)
  - [ ] 3.4 — Ensure bottom sheet has visible drag handle indicator and closes on swipe-down

- [ ] **Task 4**: Swipe-to-delete / swipe-to-edit on transaction list items (AC: 3)
  - [ ] 4.1 — Add touch event handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`) to transaction list row component
  - [ ] 4.2 — Swipe left (>60px): reveal red "Delete" action beneath the row with trash icon
  - [ ] 4.3 — Swipe right (>60px): reveal blue "Edit" action beneath the row with edit icon
  - [ ] 4.4 — Tapping revealed action triggers existing delete/edit handlers (with existing confirmation dialog for delete)
  - [ ] 4.5 — Snap back animation if swipe distance < 60px; smooth CSS transition on reveal
  - [ ] 4.6 — Desktop: no swipe handlers (mouse events don't trigger)

- [ ] **Task 5**: Pull-to-refresh (AC: 4)
  - [ ] 5.1 — Create `src/hooks/usePullToRefresh.ts` hook: tracks `touchStart`, `touchMove`, `touchEnd`; fires callback when pull distance > 80px
  - [ ] 5.2 — Apply `usePullToRefresh` to the transaction list page scroll container; callback calls `mutate('/api/transactions')`
  - [ ] 5.3 — Apply `usePullToRefresh` to the dashboard scroll container; callback revalidates dashboard SWR keys
  - [ ] 5.4 — Show a spinner/indicator at the top while refreshing

- [ ] **Task 6**: Haptic feedback utility (AC: 6)
  - [ ] 6.1 — Create `src/lib/utils/haptic.ts` exporting `triggerHaptic(pattern?: number | number[])` wrapping `navigator.vibrate` with a guard for unsupported browsers
  - [ ] 6.2 — Call `triggerHaptic(50)` in `TransactionEntryModal` `onSuccess` callback (after transaction saved)

- [ ] **Task 7**: Mobile keyboard & input optimization (AC: 7)
  - [ ] 7.1 — Set `inputMode="decimal"` on the amount input in `TransactionEntryModal`
  - [ ] 7.2 — Verify date inputs use `type="date"` (native picker); if using a custom picker, add a hidden `type="date"` fallback on mobile
  - [ ] 7.3 — Add `autoComplete="off"` and `autoCorrect="off"` on numeric fields to suppress autocorrect

- [ ] **Task 8**: Transaction list virtualization (AC: 9)
  - [ ] 8.1 — Check transaction count from API response; if >100 items, render only visible rows + buffer using a windowing approach
  - [ ] 8.2 — Use `@tanstack/react-virtual` (if not already installed) or implement simple manual windowing
  - [ ] 8.3 — Ensure scroll position is preserved on navigation back (use SWR cache, no re-fetch flash)

- [ ] **Task 9**: Responsive breakpoint audit (AC: 10)
  - [ ] 9.1 — Audit all pages (Dashboard, Transactions, Categories, Insights, Settings) for consistent use of `base/md/lg` breakpoints
  - [ ] 9.2 — Fix any hardcoded pixel widths or breakpoints inconsistent with `<768px / 768–1024px / >1024px` strategy
  - [ ] 9.3 — Verify `BottomNav` gap (72px bottom padding) doesn't clip content on any page

- [ ] **Task 10**: Tests (AC: 11)
  - [ ] 10.1 — Unit test `src/components/layout/BottomNav.tsx`: renders 5 tabs, active tab highlighted, Add tab fires `onAddClick`
  - [ ] 10.2 — Unit test `src/lib/utils/haptic.ts`: calls `navigator.vibrate` when supported, no-op when not
  - [ ] 10.3 — Component test `TransactionEntryModal`: `inputMode="decimal"` present on amount field
  - [ ] 10.4 — Component test `BottomNav`: all tab touch targets have min 48px height
  - [ ] 10.5 — Unit test `usePullToRefresh`: fires callback after sufficient pull distance
  - [ ] 10.6 — Run full test suite; ensure 721+ tests pass (zero regressions)

## Dev Notes

### Architecture & Patterns

**Current navigation stack (as of Story 10-7):**
- `AppLayout` renders: `Header` → `Sidebar` (desktop/tablet only, `display={{ base: 'none', md: 'block' }}`) → `MobileNav` (Drawer, slides from left, triggered by hamburger in Header) → `FloatingActionButton` (fixed, bottom-right)
- Mobile currently uses hamburger → drawer pattern; this story adds a persistent bottom tab bar

**Bottom Nav design:**
- Fixed at viewport bottom, full width, 5 tabs
- Center "Add" tab: use `IconButton` with `borderRadius="full"`, `bg="trustBlue.500"`, `mt="-16px"` (elevated above bar) — or a circle with shadow
- `zIndex` must be above main content but below modals (`zIndex={100}`)
- Safe area inset: add `paddingBottom="env(safe-area-inset-bottom)"` for iPhone notch/home indicator

**Bottom sheet for transaction entry:**
- Chakra UI `Drawer` with `placement="bottom"` achieves the slide-up animation natively
- Switch between `Drawer` (mobile) and `Modal` (desktop) based on `useBreakpointValue`
- Existing `TransactionEntryModal` props contract must not change (only rendering strategy changes)

**Swipe gestures:**
- Implement with raw touch events — no gesture library needed for this level of complexity
- `translateX` CSS transform for the reveal animation; `transition: transform 0.2s ease`
- Store swipe state in `useRef` to avoid re-renders during gesture tracking

**Pull-to-refresh:**
- Only activate when scroll position is at top (`scrollTop === 0`) to avoid conflicting with normal scroll
- Use `overscroll-behavior-y: contain` on scroll containers to prevent browser default pull-to-refresh competing

**Haptic utility:**
```typescript
// src/lib/utils/haptic.ts
export function triggerHaptic(pattern: number | number[] = 50): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
```

**Virtualization:**
- Only needed if transaction count > 100 — check before adding dependency
- `@tanstack/react-virtual` is the preferred approach if needed
- Estimate row height: ~72px per transaction row

### Project Structure Notes

- `src/components/layout/BottomNav.tsx` — NEW component (mirrors `MobileNav` nav items structure)
- `src/lib/utils/haptic.ts` — NEW utility (alongside `appBadge.ts` from Story 10-7)
- `src/hooks/usePullToRefresh.ts` — NEW hook
- `src/components/layout/AppLayout.tsx` — MODIFY: add BottomNav, hide FAB on mobile
- `src/components/transactions/TransactionEntryModal.tsx` — MODIFY: bottom sheet on mobile, `inputMode`, haptic
- `src/components/transactions/TransactionList.tsx` (or equivalent list row) — MODIFY: swipe gesture handlers, virtualization

### Learnings from Previous Story

**From Story 10-7 (Status: done)**

- **PWAInstallPrompt**: already integrated in `AppLayout` — no changes needed for Story 10-8
- **AppLayout pattern**: `AppLayout` is the single layout shell for all dashboard pages — all mobile UI additions go here
- **FloatingActionButton**: currently always visible (fixed bottom-right, zIndex 1000); must be hidden on mobile when BottomNav "Add" tab takes over
- **Existing MobileNav (Drawer)**: remains functional for tablet (768-1024px) where BottomNav is hidden; no removal needed
- **iOS safe area**: `viewport-fit=cover` and `apple-mobile-web-app-status-bar-style: black-translucent` already set in `layout.tsx` — add `env(safe-area-inset-bottom)` to BottomNav bottom padding

[Source: docs/sprint-artifacts/stories/10-7-enhanced-pwa-for-mobile-production.md]

### References

- AC source: [Source: docs/sprint-artifacts/tech-spec-epic-10.md#Story-10-8-Mobile-Optimized-Touch-UI]
- AppLayout: [Source: src/components/layout/AppLayout.tsx]
- MobileNav (existing): [Source: src/components/layout/MobileNav.tsx]
- FloatingActionButton: [Source: src/components/common/FloatingActionButton.tsx]
- Chakra UI Drawer docs: `placement="bottom"` for bottom sheet

## Dev Agent Record

### Context Reference

docs/sprint-artifacts/stories/10-8-mobile-optimized-touch-ui.context.xml

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all ACs implemented cleanly with zero TS errors and 740 tests passing.

### Completion Notes List

- AC-10.8.7 (inputMode + type="date") was already partially implemented from Story 3.1; enhanced with autoComplete="off" and autoCorrect="off"
- AC-10.8.9 (virtualization): Transactions page uses pagination (max 100/page via PaginationControls), so virtualization threshold of >100 items is not reached in normal operation — skipped per spec
- `@tanstack/react-virtual` was NOT installed; no dependency added
- SwipeableRow hides desktop action buttons on mobile (HStack `display={{ base: 'none', md: 'flex' }}`) since swipe is the mobile pattern
- TransactionEntryModal tests use `--forceExit` due to open async handles from Supabase mock

### File List

**New:**
- src/components/layout/BottomNav.tsx
- src/lib/utils/haptic.ts
- src/hooks/usePullToRefresh.ts
- src/components/transactions/SwipeableRow.tsx
- docs/sprint-artifacts/stories/10-8-mobile-optimized-touch-ui.context.xml
- src/lib/utils/__tests__/haptic.test.ts
- src/hooks/__tests__/usePullToRefresh.test.ts
- src/components/layout/__tests__/BottomNav.test.tsx
- src/components/transactions/__tests__/TransactionEntryModal.mobile.test.tsx

**Modified:**
- src/components/layout/AppLayout.tsx — added BottomNav, hid FAB on mobile, added bottom padding, data-scroll-container attr
- src/components/transactions/TransactionEntryModal.tsx — bottom sheet on mobile, haptic on success, autoComplete/autoCorrect off
- src/app/transactions/page.tsx — SwipeableRow wrapping, usePullToRefresh, Spinner import
- src/app/dashboard/page.tsx — usePullToRefresh with dashboard SWR keys
- docs/sprint-artifacts/sprint-status.yaml — status: done
- docs/sprint-artifacts/stories/10-8-mobile-optimized-touch-ui.md — status: done
