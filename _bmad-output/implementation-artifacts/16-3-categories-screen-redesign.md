---
baseline_commit: 7c3ac4f7a0accc14c0bacafd2bca88ca5a3fff46
---

# Story 16.3: Categories Screen Redesign

Status: done

<!-- Epic 16 "Design System Rollout" (Phase 3). Brings the Categories page onto
the Quiet Ledger design system and makes it feel visual, not admin. -->

## Story

As a person organizing my spending,
I want the Categories screen to be visual and on-brand — showing what each
category actually costs me — so it feels like insight, not an admin settings table.

## Acceptance Criteria

1. **Given** the Categories page **When** it renders **Then** it uses Quiet Ledger tokens throughout — no leftover `blue`/`#2b6cb0`, `gray.*`, `bg="white"`, or `colorScheme="blue"`; the header, the All/Expense/Income tabs, the cards, the badges, the Add button, spinner, empty state and modals all use `surface`/`fg`/`border`/`accent`/`income`/`expense`. (Genuine error text and destructive delete stay red.)
2. **And** the type indicator is on semantic tokens: income → evergreen (`income`), expense → clay (`expense`) — not raw green/red `colorScheme`, and localized (not the raw `category.type` enum).
3. **Given** an expense category **When** shown **Then** its **current-month spend** appears on the card (from `/api/dashboard/spending-by-category`), tabular, so the page communicates cost at a glance. (Budgeted expense categories already show spend-vs-budget via `BudgetEditor`; show the plain spend line for the rest to avoid duplication.)
4. **Given** the tabs and Add button **When** shown **Then** the active tab is an evergreen soft-rounded pill and "Add Category" is an accent button.
5. **Given** ALL existing behavior **When** exercised **Then** it is preserved: create / edit / delete (via `CategoryModal` + confirm dialog), household share/un-share toggle, `BudgetEditor` (ADR-025), the type filter tabs, default/shared badges, optimistic updates, and the just-fixed `{ data }` SWR shape (do not regress PR #5).
6. **Given** the redesign **When** verified **Then** `tsc`, `eslint --max-warnings=0`, full `jest` (baseline ~2067 pass / 54 skip — zero regressions), and `next build` pass; any new UI strings exist in BOTH `messages/en.json` and `messages/bg.json`.
7. **Given** mobile + desktop **When** viewed **Then** no 320px overflow, ≥44px touch targets, visible focus, AA contrast.

## Tasks / Subtasks

- [x] **Task 1: Header + tabs + page chrome (AC: 1, 4)**
  - [x] `src/app/categories/page.tsx` header (`:250-260`): `Heading` → `fg` + `fontFamily="heading"`; "Add Category" `Button colorScheme="blue"` → accent (default brand / `variant="solid"`). Tabs (`:263-266`) `colorScheme="blue"` → `colorScheme="brand"` (evergreen soft-rounded pills).
  - [x] `CategoryList` states: spinner `color="blue.500"` → `accent`; loading text `gray.600` → `fg.muted`; empty `gray.500` → `fg.subtle`; wrap the empty state in the shared `EmptyState` primitive (`src/components/shared/EmptyState.tsx`) with a guiding CTA to add a category. Error text may stay `red.500` (genuine error).

- [x] **Task 2: CategoryCard onto tokens + visual polish (AC: 1, 2)**
  - [x] `CategoryCard` (`:448-559`): `borderColor="gray.200"` → `border`; `bg="white"` → `surface`; `_hover borderColor="gray.300"` → `border.strong`; radius → `lg`/`xl`. Type `Badge` `colorScheme green/red` → `income`/`expense` semantic (subtle bg + fg token) and localized (`t('income')`/`t('expense')` or an icon), not the raw `category.type`. Shared badge `colorScheme="blue"` → accent (`accent.subtle`/`accent`). Default badge may stay neutral (`border`/`fg.muted`).
  - [x] Actions: share `Button colorScheme="blue"` → `soft`/accent; edit `IconButton colorScheme="blue"` → ghost (`fg.muted`, hover accent); delete `IconButton colorScheme="red"` → `expense` (clay, hover `expense.subtle`). Keep the hover-reveal + `isOwn`/`is_predefined` gating.

- [x] **Task 3: Per-category current-month spend (AC: 3)**
  - [x] In `CategoriesPage`, fetch `/api/dashboard/spending-by-category` (SWR; shape `{ categories: [{ category_id, amount }] }`) and build a `Map<category_id, amount>`. Pass the amount into `CategoryCard`. On an **expense** card **without** a budget, render a small tabular caption "€X this month" (use `formatCurrency` + `currencyCode`); budgeted cards keep the `BudgetEditor` progress (no double display). Zero/undefined spend → show `€0.00` or omit gracefully.
  - [x] Add i18n `spentThisMonth` (or reuse an existing label) en + bg if a label is needed.

- [x] **Task 4: PRESERVE + verify (AC: 5, 6, 7)**
  - [x] Do NOT touch: the SWR `{ data }` normalize (PR #5), `handleCategoryCreated/Updated/DeleteConfirm` optimistic mutates, `handleToggleShare`, `useHousehold`/`useBudgets`/`useUserPreferences`, `CategoryModal`, `DeleteConfirmationModal` (destructive red stays), `BudgetEditor`.
  - [x] `tsc`, `npm run lint`, full `jest`, `next build`. Manual QA at 320/375/1280: tabs, cards, add/edit/delete, share toggle, budget editor, spend caption, no overflow.

## Dev Notes

- File: `src/app/categories/page.tsx` — `CategoriesPage` + `CategoryList` + `CategoryCard` + `DeleteConfirmationModal`. Data: `useSWR('/api/categories', fetcher)` reading the normalized `{ data }` (post-PR#5), `useHousehold`, `useBudgets` (ADR-025 budget map), `useUserPreferences` (currencyCode).
- Tokens/patterns to reuse (from 16-1/16-2): `surface`/`surface.hover`, `fg`/`fg.muted`/`fg.subtle`, `border`/`border.strong`, `accent`(+`.subtle`/`.emphasis`), `income`/`income.subtle`, `expense`/`expense.subtle`; Space Grotesk + `.tnum` for amounts; `formatCurrency` from `@/lib/utils/currency`; shared `EmptyState`. Theme `Button`/`Tabs` inherit brand=evergreen.
- `spending-by-category` is EXPENSES only → spend caption applies to expense cards. Income cards show no spend figure (fine).
- PRESERVE the PR #5 fix (shared `/api/categories` shape) — do not reintroduce a bare-array read.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-16.3]
- [Source: memory redesign-quiet-ledger] — tokens + prior stories.
- [Source: src/app/categories/page.tsx] — file under redesign.
- [Source: src/app/api/dashboard/spending-by-category/route.ts] — spend shape.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev-story)

### Debug Log References

### Completion Notes List

- Categories page fully on Quiet Ledger tokens (header/tabs/cards/badges/actions/spinner/empty). Delete-confirm + genuine load error stay red. Type badge -> income/expense subtle tokens + localized. Tabs -> evergreen (colorScheme brand). Shared EmptyState for the no-data case.
- Per-category current-month spend: new SWR fetch of /api/dashboard/spending-by-category -> Map, shown as a tabular caption on expense cards WITHOUT a set budget (budgeted cards keep BudgetEditor's spend-vs-budget; no duplication).
- Preserved: SWR `{data}` normalize (PR#5), optimistic create/edit/delete, share toggle, BudgetEditor, filter tabs. i18n spentThisMonth en+bg. Verify: tsc/lint clean, jest 2067, build ok.

### File List

- MODIFIED `src/app/categories/page.tsx`
- MODIFIED `src/components/categories/BudgetEditor.tsx` (review patch — AC1 token completion)
- MODIFIED `messages/en.json`
- MODIFIED `messages/bg.json`
- NEW `src/app/categories/__tests__/page.test.tsx` (post-review coverage — caption logic; flips codecov/patch green)

### Merged

PR #8 squash-merged to `main` as `1df131c` (2026-07-24), branch deleted. Required CI green (Run Tests 22.x + RLS Integration); codecov/patch green after the coverage test. Final suite 2071 pass / 54 skip.

### Code Review (2026-07-24 — triple adversarial: Blind Hunter / Edge Case Hunter / Acceptance Auditor)

PATCHED:
- **Zero-fill (Blind+Edge, MAJOR):** spend caption showed "€0.00" while the independent spend SWR loaded/errored AND for never-spent categories — conflating four states into a misleading money figure (degradation policy: unknowable ≠ 0). Fixed: gate on `spent !== undefined` and drop `?? 0` — the endpoint omits zero-spend categories, so the caption now renders ONLY for categories with actual recorded spend. Also kills the load flash + fresh-account €0.00 clutter.
- **Missing `isOwn` guard (Blind, MAJOR):** caption had no `isOwn` guard (unlike `canBudget`), so a household-shared expense category owned by another member showed the CURRENT user's personal spend (≈€0), reading as "nobody spent here". Fixed: added `category.isOwn !== false`.
- **Keyboard focus on invisible actions (Edge, MAJOR/AC7):** hover-reveal was JS `isHovered` (mouse only) → Tab landed on `opacity:0` controls. Fixed: removed the state; reveal via `sx` `&:hover/&:focus-within .cat-actions` (hover AND keyboard focus).
- **Touch targets <44px (Edge+Auditor, AC7):** share `xs` (~24px) + edit/delete `sm` (~38px) were the live mobile targets. Fixed: `minH/minW {base:'44px'}` (BudgetEditor pattern).
- **BudgetEditor legacy blue (Auditor AC1 caveat):** BudgetEditor is categories-only, so brought it onto tokens too (Save/Set/Edit drop `colorScheme="blue"` → evergreen; progress status green/orange/red → evergreen/amber/clay; `gray.600`→`fg.muted`, `red.600`→`expense`). Clear stays `colorScheme="red"` (destructive).
- **Non-array parse (Edge, MINOR)** + **bg label wrap at 320px (Edge, MINOR):** `Array.isArray` guard on the spend map; `noOfLines={1}` on the eyebrow label.

DISMISSED: number grouping always en-US — app-wide consistent pattern (BudgetEditor does the same), not a regression.

DEFERRED → deferred-work.md: `spending-by-category` uses `.toISOString()` on a DATE column (month tz-misbucket) — pre-existing Epic 5 endpoint, consistent with the dashboard pie; fix with the server-clock month/tz class.

Re-verified after patches: tsc + eslint clean; jest 2067 pass / 54 skip; next build ok.
