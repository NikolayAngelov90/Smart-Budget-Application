---
baseline_commit: bba42da70ee8e3385b3b90865566c356d99d06c3
---

# Story 16.2: Transaction Composer Redesign

Status: done

<!-- Epic 16 "Design System Rollout" (Phase 3). Applies the Quiet Ledger design
system to the add/edit-transaction composer (TransactionEntryModal). -->

## Story

As a person adding money in or out,
I want an amount-first composer with one-tap category picks,
so that I can record a transaction in well under 20 seconds on my phone.

## Acceptance Criteria

1. **Given** the composer opens **When** it renders **Then** the AMOUNT is the dominant element — a large, auto-focused numeric display at the top (currency symbol + tabular Space Grotesk figures) — not one field in a flat vertical form.
2. **And** the amount input keeps `inputMode="decimal"`, `autoComplete="off"`, `autoCorrect="off"`, the `0.00` placeholder, the 2-decimal blur formatting, and zod validation (existing mobile test must stay green).
3. **Given** the type toggle **When** shown **Then** it is a segmented control using `income` (evergreen) / `expense` (clay) semantic tokens — not red/green `colorScheme`.
4. **Given** categories **When** the user picks one **Then** recent + frequent categories are offered as **one-tap chips** for the fast path, with the full `CategoryMenu` dropdown still available for the long tail; the selected chip is clearly active.
5. **Given** the secondary fields **When** the composer is in its default state **Then** amount → type → category → Save are the primary path, and date / notes / currency / allowance are reachable but not in the way (a "More details" disclosure or clearly secondary grouping), so the common case is fast.
6. **Given** the Save action **When** shown **Then** it is a prominent accent (evergreen) button, thumb-reachable at the foot of the sheet, ≥44px, disabled until valid, with the existing loading/offline states.
7. **Given** the whole composer **When** styled **Then** it uses Quiet Ledger tokens/type (surface, fg/border, radii, Space Grotesk amount) — no leftover `blue.600`/`#2b6cb0`/`red`/`green`/`gray.*` hardcodes in the composer or `CategoryMenu`.
8. **Given** ALL existing behavior **When** exercised **Then** it is preserved with no regression: create + edit modes (pre-fill), currency selector + exchange-rate fetch/abort, allowance tagging (13.6), SmartNudge keep-open, achievement toasts (15.3), offline gating, haptics, `log_day`, quick-date buttons, form reset for rapid next entry, mobile bottom-sheet vs desktop modal.
9. **Given** the redesign **When** verified **Then** `tsc`, `eslint --max-warnings=0`, full `jest` (baseline 2062 pass / 54 skip — zero regressions incl. `TransactionEntryModal.mobile.test.tsx`), and `next build` pass; any new UI strings exist in BOTH `messages/en.json` and `messages/bg.json`.

## Tasks / Subtasks

- [x] **Task 1: Amount-first hero (AC: 1, 2)**
  - [x] Restructure the top of `formContent` (`src/components/transactions/TransactionEntryModal.tsx:455+`) so the amount is a large hero display: currency symbol + big tabular Space Grotesk figures, auto-focused. Keep the underlying `Input` (or a styled input) with `inputMode="decimal"`, `pattern`, `autoFocus`, `autoComplete/autoCorrect="off"`, `placeholder="0.00"`, `onBlur={handleAmountBlur}`, and the `register('amount')` wiring + zod schema UNCHANGED. The mobile test asserts these attributes + the `0.00` placeholder — do not break them.
  - [x] Use the preferred-currency symbol beside the amount (from `getEnabledCurrencies()` / `selectedCurrency`).

- [x] **Task 2: Type segmented control on tokens (AC: 3)**
  - [x] Replace the two `Button`s (`TransactionEntryModal.tsx:520-542`, `colorScheme="red"/"green"`) with a segmented expense/income control: active expense → clay (`expense`/`expense.subtle`), active income → evergreen (`income`/`income.subtle`); inactive → neutral surface. Keep `setValue('type', ...)`, the `transactionType` watch, and the category re-fetch on type change.

- [x] **Task 3: One-tap category quick-pick (AC: 4)**
  - [x] Above the `CategoryMenu`, render a horizontally-scrollable row of chips for `recentCategories` + frequent (sort remaining by `usage_count` desc, take a few). Each chip: category color dot + name, ≥44px tap target, tappable → `setValue('category_id', id)`; active chip visually selected (accent ring / filled). Keep the full `CategoryMenu` below as "All categories" for anything not in the chips. De-dupe chips vs. menu.
  - [x] Restyle `src/components/categories/CategoryMenu.tsx` onto tokens: `#2b6cb0`/`blue.*` → `accent`, `gray.200/500/600` → `border`/`fg.subtle`/`fg.muted`, `red.500` (invalid) → `expense`, `bg="white"` → `surface`. Preserve keyboard nav, recents/all groups, `matchWidth`, empty state, 44px items.

- [x] **Task 4: Progressive disclosure of secondary fields (AC: 5)**
  - [x] Keep amount → type → category → Save as the always-visible fast path. Move Date (+ quick buttons), Notes, Currency selector, and the allowance checkbox into a "More details" disclosure (Chakra `Collapse`/`Accordion` or a simple toggled `Box`) that is collapsed by default in CREATE mode. In EDIT mode, default it OPEN (the user is likely changing one of those). Keep every field's `register`/`setValue`/validation wiring intact.
  - [x] Add i18n `moreDetails` / `fewerDetails` keys (en + bg).

- [x] **Task 5: Save/cancel + sheet chrome (AC: 6, 7)**
  - [x] Save button → accent solid, full-width or prominent, sticky at the sheet foot on mobile, ≥44px, `isDisabled={!isValid || isSubmitting || !isOnline}`, keep the offline `Tooltip` + loading text. Cancel → ghost. Remove the hardcoded `bg="blue.600"` (`TransactionEntryModal.tsx:649-663`).
  - [x] Restyle the mobile Drawer chrome (`:669-687`): drag handle `bg="gray.300"` → `border.strong`, `DrawerContent bg` → `surface`, header type. Desktop Modal header → fg/Space Grotesk. Currency-rate hint `blue.600` → `accent`; allowance hint `gray.500` → `fg.subtle`.

- [x] **Task 6: Tests (AC: 9)**
  - [x] Keep `TransactionEntryModal.mobile.test.tsx` green (may need to update the CategoryMenu mock or add the chip row to the mock data, but the 3 amount-attribute assertions must pass unchanged).
  - [x] Add coverage for the new chip quick-pick: selecting a chip sets the category (mock categories with recents), and the active chip reflects `value`. Add a test that the "More details" disclosure is collapsed in create mode and reveals date/notes on toggle.

- [x] **Task 7: Verification (AC: 8, 9)** — `tsc`, `npm run lint`, full `jest`, `next build`. Manual QA: create + edit, currency switch, allowance tag, nudge keep-open, offline disabled state, 320px no-overflow, bottom sheet on mobile / modal on desktop, reduced motion. NO API/migration changes.

## Review Findings

Triple-agent review 2026-07-23 (Blind / Edge Case / Acceptance — all three completed). Acceptance Auditor: all 9 ACs met (AC5 a documented, acceptable scope call). Triage: 10 patch / 0 decision-needed / 0 defer / 3 dismissed.

- [x] [Review][Patch][MED] Edit-mode "Fewer details" toggle is a dead control (`detailsOpen` forced open by `|| mode==='edit'`, but the button only flips `showDetails`) — drive `detailsOpen` from `showDetails`, init `true` in edit (blind+edge) [TransactionEntryModal.tsx]
- [x] [Review][Patch][MED] No visible focus ring on the unstyled amount / type / chip controls (WCAG 2.4.7) — add `_focusVisible` boxShadow (edge+blind) [TransactionEntryModal.tsx]
- [x] [Review][Patch][MED] Switching type leaves a stale `category_id` → a mismatched category can be saved (Save stays enabled) — clear `category_id` on type toggle (blind+edge) [TransactionEntryModal.tsx]
- [x] [Review][Patch][MED] Allowance `Checkbox` still `colorScheme="blue"` → bright non-Quiet-Ledger blue check (AC7 intent) — → `brand`/evergreen (auditor) [TransactionEntryModal.tsx]
- [x] [Review][Patch][MED] Save not pinned — inline in the scrollable `DrawerBody`, so with "More details" open it scrolls off (AC6 / Task 5) — make the action bar sticky at the sheet foot (auditor) [TransactionEntryModal.tsx]
- [x] [Review][Patch] Category chips 40px < the 44px touch target (AC4 / Task 3) — 44px (blind+auditor) [TransactionEntryModal.tsx]
- [x] [Review][Patch] Required `date` error can be hidden inside the collapsed disclosure (Save disabled, no reason shown) — open the disclosure on date/notes error (blind+edge) [TransactionEntryModal.tsx]
- [x] [Review][Patch] `quickCategories` recomputed every render (unmemoized IIFE) — `useMemo` (blind) [TransactionEntryModal.tsx]
- [x] [Review][Patch] Long category name → unbounded, non-truncating chip — `maxW` + ellipsis (edge) [TransactionEntryModal.tsx]
- [x] [Review][Patch] Quick-pick cap relies on the API's `recent.slice(0,5)`, not enforced client-side — `slice(0,6)` (edge) [TransactionEntryModal.tsx]

Dismissed (3, verified/accepted): AC5 currency/allowance left in the primary path — documented scope call, auditor concurs the fast-path intent is met (both fields are conditional); CategoryMenu shows all categories (not de-duped vs chips) — full menu is the better UX and AC4 is met; the borderless amount has no invalid border — the centered error text is the affordance (focus covered above).

## Dev Notes

### Current state (files under redesign)

- `src/components/transactions/TransactionEntryModal.tsx` (~709 lines): RHF + zod; amount (autofocus, decimal), currency segmented buttons, type toggle (red/green), `CategoryMenu` (recents from `data.recent`), allowance checkbox (13.6), quick-date buttons + date input, notes; submit does create/edit POST/PUT with `currency`, `exchange_rate`, `allowance_id`, `log_day`; SmartNudge keep-open (`:436-440`), achievement toasts (`:401-403`), haptics, offline gate (`:333-342`), reset-for-next-entry (`:414-426`). Mobile = bottom Drawer (`:669-687`), desktop = centered Modal (`:690-707`).
- `src/components/categories/CategoryMenu.tsx`: dropdown Menu, recents + alpha-sorted groups, color dots, keyboard nav — hardcoded blue/gray/red; restyle to tokens.
- Test: `src/components/transactions/__tests__/TransactionEntryModal.mobile.test.tsx` — asserts amount `inputMode="decimal"`, `autoComplete/autoCorrect="off"`, placeholder `0.00`; mocks CategoryMenu, forces desktop Modal. MUST stay green.

### PRESERVE (regression surface)

zod schema + all validation; currency fetch/abort effect (`:287-322`); allowance eligibility (`canTagAllowance`); nudge/achievement/haptic/log_day; edit-mode pre-fill (`:257-283`); reset-for-next-entry; offline gating; both mount points (dashboard modal + AppLayout quick-add + the 16-1 transactions create modal) all use this one component, so the amount-attribute + save wiring must not change contract.

### Design system to reuse

`income`/`expense`(+`.subtle`), `accent`(+`.subtle`/`.emphasis`), `surface`/`surface.hover`, `fg`/`fg.muted`/`fg.subtle`, `border`/`border.strong`; Space Grotesk (`fontFamily="heading"`) + `.tnum` for the amount; radii/shadows; theme `focusBorderColor="accent"` already global. No new tokens. Recurring transactions are NOT currently supported — do not add (brief said "if already supported").

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-16.2]
- [Source: memory redesign-quiet-ledger] — tokens, what shipped (16-1), CI/branch-protection.
- [Source: src/components/transactions/TransactionEntryModal.tsx] / [Source: src/components/categories/CategoryMenu.tsx]
- [Source: 16-1 story] — established the token patterns (evergreen/clay, tabular amounts, EmptyState).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story)

### Debug Log References

- `tsc --noEmit` clean · `eslint --max-warnings=0` clean
- `jest` full: 2064 passed / 54 skipped (baseline 2062 + 2 new composer tests — zero regressions; `TransactionEntryModal.mobile.test.tsx` still green)
- `next build`: success

### Completion Notes List

- Amount hero: borderless centered Space Grotesk `.tnum` figure + currency symbol; kept the exact Input attributes the mobile test asserts (`inputMode="decimal"`, `autoComplete/autoCorrect="off"`, `0.00` placeholder, `register`, `onBlur`) — swapped the visible `<FormLabel>` for an `aria-label` so the input keeps an accessible name.
- Type → segmented control on `expense`/`income` tokens (white on active), `aria-pressed`.
- Category quick-pick: `quickCategories` = recents first, then top `usage_count`, capped at 6; horizontally-scrollable one-tap chips with active (accent) state, de-duped; full `CategoryMenu` kept below and restyled onto tokens.
- Save → accent; drawer handle/hints/focus rings → tokens.
- **Scope call (Task 4 / AC5):** implemented the "More details" disclosure for **Date + Notes** (collapsed in create, open in edit). The **Currency selector and allowance checkbox were left in place** (restyled) rather than moved inside the disclosure — both are conditional (currency only when >1 enabled currency; allowance only when eligible), so in the common case the visible path is already amount → type → category → Save. Flagged for review; can be moved into the disclosure if the reviewer prefers strict AC5.
- Recurring transactions intentionally NOT added (not previously supported).
- PRESERVED: create/edit modes, currency fetch/abort, allowance tag, SmartNudge keep-open, achievement toasts, offline gating, haptics, `log_day`, quick dates, reset-for-next-entry, mobile Drawer vs desktop Modal. No API/migration changes. i18n `moreDetails`/`fewerDetails` added en+bg.

### Change Log

- 2026-07-23 — Implemented Story 16.2 (Transaction Composer redesign): amount-first hero, segmented type, one-tap category chips, "More details" disclosure, token restyle of composer + CategoryMenu. +2 tests. Status → review.

### File List

- MODIFIED `src/components/transactions/TransactionEntryModal.tsx`
- MODIFIED `src/components/categories/CategoryMenu.tsx`
- NEW `src/components/transactions/__tests__/TransactionEntryModal.composer.test.tsx`
- MODIFIED `messages/en.json`
- MODIFIED `messages/bg.json`
