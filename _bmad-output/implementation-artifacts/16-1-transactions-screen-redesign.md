---
baseline_commit: 2712c7db8f551d44dc24ee4c176be6b977b7dcaf
---

# Story 16.1: Transactions Screen Redesign

Status: done

<!-- Part of Epic 16 "Design System Rollout" (Phase 3). Applies the Quiet Ledger
design system (shipped 0674eda→2712c7d) to the Transactions experience. -->

## Story

As a person reviewing my money,
I want the Transactions screen to be a calm, scannable, mobile-first list,
so that I can find and understand any transaction at a glance and act on it fast.

## Acceptance Criteria

1. **Given** the transactions list **When** it renders **Then** transactions are grouped under clear date headers (Today / Yesterday / weekday · date) instead of one flat chronological run.
2. **And** each row reads as a calm line — category identity + description/notes on the left, amount on the right — on a shared surface, NOT a heavy full `Card` per transaction.
3. **And** amounts use the `income` (evergreen) / `expense` (clay) semantic tokens with tabular figures (`.tnum`), and income/expense is ALSO signalled by the +/− sign (color is never the sole indicator — AC carried from the a11y baseline).
4. **And** the type indicator is localized via the existing `income`/`expense` translation keys (not the raw lowercase `transaction.type` string that renders today at page.tsx:981).
5. **Given** filters and search **When** used on mobile or desktop **Then** search stays prominent and always visible, secondary filters collapse behind a clear control on mobile, and every existing capability keeps working: date-range/category/type/currency filters, 300ms debounced search, URL drill-down (`?category=`, `?month=`), `FilterBreadcrumbs`, and `PaginationControls`.
6. **Given** the list is empty **When** there are no transactions vs. filtered-to-empty **Then** the no-data case shows a guiding `EmptyState` with an "Add your first transaction" CTA that opens the composer, and the filtered case shows a distinct "no matches — clear filters" state.
7. **Given** loading / error / offline / delete-undo / CSV-export flows **When** they occur **Then** each keeps its existing behavior, restyled onto the new tokens: skeletons, Supabase realtime sync, pull-to-refresh, swipe-to-edit/delete on mobile (`SwipeableRow`), optimistic delete with 5s undo, large-export progress modal, offline banner. No functional regression.
8. **Given** the whole screen **When** viewed at 320–1440px **Then** there is no horizontal overflow at 320px, touch targets are ≥44px, focus is visible, AA contrast holds, and motion respects `prefers-reduced-motion`.
9. **Given** the redesign **When** verified **Then** `tsc`, `eslint --max-warnings=0`, full `jest` (baseline 2052 pass / 54 skip — zero regressions), and `next build` all pass; any new UI strings exist in BOTH `messages/en.json` and `messages/bg.json` (CI parity).

## Tasks / Subtasks

- [x] **Task 1: Date-grouped list architecture (AC: 1, 2)**
  - [x] The list today is a flat `VStack` of one `<Card>` per transaction (page.tsx:941–1049). Introduce date grouping: bucket `transactionsResponse.data` by `transaction.date` into ordered groups (newest first), with human labels **Today / Yesterday / `EEEE, d MMM`** using `date-fns` + the locale pattern already in the codebase (`useLocale()` + `date-fns/locale` `bg`, see `BalanceFlowHero.tsx` and `dateFormatter.ts`). Compare dates as `yyyy-MM-dd` strings (project rule: DATE cols compare as strings, never `new Date()`/tz — see memory Gotchas). Render each group as a section: a small sticky-ish date header (`SectionHeader`-style eyebrow or a lighter label) + the group's rows on ONE `surface` Card, rows separated by hairline `Divider`s — not one Card each.
  - [x] Extract a `TransactionRow` component (`src/components/transactions/TransactionRow.tsx`, NEW): category identity (reuse `CategoryBadge` `variant="dot"` — categories carry a color, not a glyph, so color+name is the identity) + notes/description + a compact time/context line on the left; amount on the right. Keep it a calm 1–2 line row with a ≥44px tap area.
  - [x] Extract a `TransactionGroup` component (`src/components/transactions/TransactionGroup.tsx`, NEW) OR render groups inline — dev's call, but keep `page.tsx` from ballooning.
  - [x] PRESERVE the per-row wiring exactly: `SwipeableRow` wrapper (onDelete/onEdit) on mobile (page.tsx:952–956), desktop edit/delete `IconButton`s (page.tsx:999–1024), the currency-conversion sub-line `convertedText` (page.tsx:1036–1040).

- [x] **Task 2: Amount + type semantics on the new tokens (AC: 3, 4)**
  - [x] `formatAmount` (page.tsx:620–642) hardcodes `color = type === 'income' ? 'green.500' : 'red.500'`. Change to the semantic tokens `income` / `expense` (evergreen / clay). Render the amount with `fontFamily="heading"` + `className="tnum"` for tabular Space Grotesk figures, matching the hero. Keep the signed formatting via `formatCurrencyWithSign` (already prefixes +/−, so color is not the sole signal).
  - [x] Replace the raw type `Badge` (page.tsx:975–982, prints `{transaction.type}` = untranslated "income"/"expense") with a localized, subtle indicator — either drop the badge in favor of the signed amount + evergreen/clay, or use `t('income')`/`t('expense')`. Do NOT leave an English lowercase enum visible in the bg locale.

- [x] **Task 3: Filter bar + page header restyle (AC: 5)**
  - [x] Restyle the page header (page.tsx:698–721): `Heading` `color="gray.800"` → `fg`; the CSV export `Button colorScheme="blue" variant="outline"` → the new `outline`/`soft` variant (accent). Consider moving Export into a small overflow menu to declutter the header on mobile — optional, keep it reachable.
  - [x] Restyle the filter `Card` (page.tsx:742–902): labels `color="gray.700"` → `fg.muted`; the mobile filter toggle + count `Badge` `colorScheme="blue"` → accent; `Select`/`Input` inherit the theme `focusBorderColor="accent"` (already set globally — verify). KEEP the mobile collapse behavior (`mobileFiltersOpen`), the always-visible search, `activeFilterCount`, and `handleClearFilters` logic byte-for-byte.
  - [x] PRESERVE untouched: `buildFilterParams`/`buildQueryString`, the SWR list query + config (page.tsx:238–253), the categories query + normalization (page.tsx:259–266), URL param init (page.tsx:173–198), debounce (page.tsx:201–207), page-reset-on-filter-change (page.tsx:210–212), `FilterBreadcrumbs`, `PaginationControls`.

- [x] **Task 4: Empty / error / loading / offline states (AC: 6, 7)**
  - [x] `renderEmptyState` (page.tsx:667–693) currently shows plain gray text. Split into: (a) **no-data** → a guiding `EmptyState` with a headline + subtext + a primary CTA that opens the composer (wire to the same entry point the dashboard uses; the page already imports `TransactionEntryModal` for edit — add a create trigger, or reuse the `AppLayout` FAB path). Copy per brief §17 tone ("Your transactions will appear here. Add your first one to see your spending."). (b) **filtered-empty** → distinct "No matches" + a "Clear filters" button calling `handleClearFilters`.
  - [x] Restyle the error box (page.tsx:918–930, `bg="red.50"`) and offline banner (page.tsx:724–739, `bg="orange.100"`) onto tokens (`expense.subtle` / `warning.subtle`) while keeping the exact conditions and copy keys.
  - [x] Restyle skeletons (page.tsx:645–664 + the Suspense fallback 1149–1186) to match the new grouped-row shape; keep 5 placeholder rows. Spinner `color="trustBlue.500"` (page.tsx:910) → `accent`.
  - [x] If an `EmptyState` primitive does not yet exist under `src/components/shared/` or `common/`, create a small reusable `EmptyState` (icon/emoji, title, description, optional CTA) — Epic 16 will reuse it on Categories/Insights.

- [x] **Task 5: PRESERVE all mutation + side-effect flows (AC: 7)** — read before touching
  - [x] Delete + 5s undo optimistic flow (page.tsx:405–539): the optimistic cache filter, the custom undo toast (restyle its hardcoded `bg="green.500"` render to `income`/success tokens but keep the POST-recreate-on-undo and the 5s deferred DELETE logic intact), rollback on failure.
  - [x] CSV export + large-dataset progress modal (page.tsx:542–614, 1115–1144): keep `buildFilterParams`+`all=true`, the >5000 progress path, `exportTransactionsToCSV`, success/empty/failure toasts. Restyle `Progress colorScheme="blue"` → accent.
  - [x] Edit flow via `TransactionEntryModal` mode="edit" (page.tsx:1066–1076) + `handleEditSuccess` mutate. Delete `AlertDialog` (page.tsx:1079–1113).
  - [x] Realtime subscription (page.tsx:276–312), pull-to-refresh (page.tsx:268–273), online/offline listeners + toasts (page.tsx:314–353).

- [x] **Task 6: i18n (AC: 4, 9)**
  - [x] Any NEW strings (date-group labels "Today"/"Yesterday", new empty-state copy, "Clear filters" if not present) MUST be added to BOTH `messages/en.json` and `messages/bg.json` under `transactions` (or `common`). Reuse existing keys where present (`t('income')`, `t('expense')`, `t('noTransactions')`, `t('noTransactionsFiltered')`, `t('clearAllFilters')`, `t('clickToAdd')`). Run the i18n parity test.

- [x] **Task 7: Tests (AC: 9)**
  - [x] There is NO existing page-level test for `/transactions` (only `PaginationControls.test.tsx` + `TransactionEntryModal.mobile.test.tsx`) — so restructuring is low-risk, but ADD coverage for the new pieces: `TransactionRow` (renders category, notes, signed amount with income/expense token class; localized type) and the date-grouping helper (Today/Yesterday/date bucketing; string-based date compare). Put the grouping logic in a pure helper (`src/lib/utils/groupTransactionsByDate.ts` or similar) so it is unit-testable without rendering.
  - [x] Do NOT weaken `PaginationControls.test.tsx` / `TransactionEntryModal.mobile.test.tsx`. If a component gains a hook/prop, update mocks.

- [x] **Task 8: Verification (AC: 8, 9)** — `npx tsc --noEmit`; `npm run lint` (max-warnings=0); full `npx jest` (baseline 2052 pass / 54 skip, zero regressions); `npx next build`. Manual/visual QA at 320/375/390/768/1280 for overflow, touch targets, grouped-list rhythm, empty states, dark-mode-readiness. NO DB migration, NO API changes (this is presentation-layer only).

## Review Findings

Triple-agent review 2026-07-23 (Blind Hunter / Edge Case Hunter / Acceptance Auditor — all three completed on retry after an initial usage-limit interruption). Acceptance Auditor: all 9 ACs + the PRESERVE list MET, every checkbox backed by a real artifact. Triage: 9 patch / 0 decision-needed / 0 defer / 7 dismissed.

- [x] [Review][Patch][MED] Amount type label sits in `aria-label` on a `<p>` (name-prohibited role) → unreliable for screen readers; add a VisuallyHidden "Income/Expense" text so meaning isn't sign-only (blind+edge) [src/components/transactions/TransactionRow.tsx]
- [x] [Review][Patch][MED] Long/unbreakable category name can collide with the amount at 320px (row is now always-horizontal; name doesn't truncate) → clip/truncate the category column (edge) [src/components/transactions/TransactionRow.tsx]
- [x] [Review][Patch] Empty non-first pagination page shows the first-run empty state after deleting the last item on that page → reset to page 1 when a page empties (edge) [src/app/transactions/page.tsx]
- [x] [Review][Patch] Create-from-empty-state modal force-closes in `onSuccess`, defeating the modal's SmartNudge keep-open path → drop `onCreateModalClose` from `onSuccess` (edge) [src/app/transactions/page.tsx]
- [x] [Review][Patch] `groupTransactionsByDate` throws on a malformed date (pure helper has no guard) → `isValid` fallback to the raw key (edge) [src/lib/utils/groupTransactionsByDate.ts]
- [x] [Review][Patch] Delete swipe-action hover equals its panel colour after the AA bump (no feedback) → darken hover to clay.700 (blind+edge) [src/components/transactions/SwipeableRow.tsx]
- [x] [Review][Patch] Date-group `<section>` has no accessible name → use a plain Box (avoid an unnamed region) (blind) [src/app/transactions/page.tsx]
- [x] [Review][Patch] Empty-state decorative emoji is announced by screen readers → `aria-hidden` (blind) [src/components/shared/EmptyState.tsx]
- [x] [Review][Patch] Search field label (`gray.700`) + icon (`gray.400`) missed in the filter restyle → `fg.muted`/`fg.subtle` for dark-mode consistency (auditor) [src/app/transactions/page.tsx:875,881]

Dismissed (7, verified non-issues): `income`/`expense`/`addTransaction`/`clearAllFilters` keys exist in both locales; `income` (evergreen.500) is ~7.7:1 on white (passes AA — no bump needed); `mutate` is the `useSWR`-bound one (not the inert global); group-header `fg.muted` (~6:1) passes at 2xs; `brand` is a full registered palette (= accent/evergreen); per-row `date_format` removal is intentional per AC1 (date-grouped headers; transactions store DATE only, no time); the export button as a neutral "quiet secondary" outline is defensible.

## Dev Notes

### Current-state analysis (the file you are modifying)

`src/app/transactions/page.tsx` (~1187 lines, `'use client'`, wrapped in `<Suspense>` for `useSearchParams`). `TransactionsContent` owns everything:

- **Data:** SWR `GET /api/transactions?<filters>&limit&offset` (paginated) + `GET /api/categories`. Fetcher throws on non-OK so SWR surfaces `error` (do not regress this — it fixed an error-payload-as-data crash, page.tsx:101–109).
- **Filters:** date range, category, type (`all|income|expense`), currency, debounced search; mobile collapse via `useDisclosure`; URL drill-down from Story 5.5.
- **Row today:** one `<Card><CardBody>` each, `Flex` column→row, left `VStack` (date `Text` gray.700 + raw-type `Badge` + `CategoryBadge` dot + notes), middle desktop-only edit/delete `IconButton`s, right amount `Text` gray/green/red + converted sub-line. Wrapped in `SwipeableRow` for mobile swipe.
- **States:** skeleton (5 cards), error (red.50 box), empty (gray.50 box, no CTA), offline banner (orange.100).

**What must keep working (regression surface):** SWR query/keys, categories normalization (cache can be array OR `{data}`), URL param init, debounce, page-reset, realtime channel, pull-to-refresh, online/offline toasts, edit modal, delete+undo optimistic + deferred DELETE, CSV export + progress modal, pagination, filter breadcrumbs. A green build that broke the undo flow is a FAIL.

### Design system to reuse (do not reinvent)

- Tokens: `income`/`income.subtle` (evergreen), `expense`/`expense.subtle` (clay), `warning.subtle` (amber), `surface`/`surface.hover`/`surface.sunken`, `fg`/`fg.muted`/`fg.subtle`, `border`, `accent` — all in `src/theme/index.ts` `semanticTokens`.
- Amounts: `fontFamily="heading"` (Space Grotesk) + `className="tnum"` (tabular) — see `BalanceFlowHero.tsx` / `SectionHeader.tsx` for the established patterns.
- `SectionHeader` (`src/components/dashboard/SectionHeader.tsx`) — reuse or mirror its eyebrow/title style for date headers; consider promoting it to `components/shared/` if reused off the dashboard.
- Reduced motion: global CSS baseline already tames transitions; `SwipeableRow` motion should still degrade.
- Date localization: `useLocale()` + `date-fns/locale` `bg` (pattern in `BalanceFlowHero.tsx:19`, `dateFormatter.ts`).

### Project Structure Notes

- New components: `src/components/transactions/{TransactionRow,TransactionGroup}.tsx`; new util `src/lib/utils/groupTransactionsByDate.ts`; possibly `src/components/shared/EmptyState.tsx` (reused across Epic 16). Naming follows existing PascalCase component / camelCase util conventions.
- No changes under `src/app/api/**` or `supabase/migrations/**`. Presentation-only story.
- Keep `page.tsx` lean by extracting the row/group/empty pieces; the delete-undo + export handlers can stay in the page (they own toast + mutate).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-16.1] — ACs + epic constraints.
- [Source: memory redesign-quiet-ledger] — design direction, tokens, what shipped, follow-ups.
- [Source: src/app/transactions/page.tsx] — file under redesign (cited line ranges above).
- [Source: src/components/dashboard/BalanceFlowHero.tsx] — token + tabular-amount + date-locale patterns to mirror.
- [Source: src/components/categories/CategoryBadge.tsx] — dot/badge/border variants (category identity is color+name).
- [Source: docs/api-conventions.md#Error-Handling] — degradation policy (do not zero-fill / poison cache on core-input errors).
- Project rules (memory): DATE cols compare as `yyyy-MM-dd` strings; i18n en+bg parity CI-enforced; global SWR `mutate` inert under localStorage provider (this page uses `useSWR` local `mutate`, which is fine).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story workflow)

### Debug Log References

- `tsc --noEmit`: clean
- `eslint --max-warnings=0`: clean
- `jest` (full): 2061 passed / 54 skipped (baseline 2052 + 9 new — zero regressions)
- `next build`: success (`/transactions` 11.4 kB)

### Completion Notes List

- Date grouping is a pure, unit-tested helper (`groupTransactionsByDate`) — labels Today/Yesterday/`EEEE, d MMM`, locale-aware (bg), compares `yyyy-MM-dd` strings (no tz misbucket). Groups render inline (TransactionGroup not extracted — the task allowed dev's call) to keep the diff focused; rows sit on one `surface` Card per day, split by hairline `Divider`s.
- `TransactionRow` (new): CategoryBadge dot + note left, signed tabular Space Grotesk amount right (evergreen income / clay expense). Type is conveyed by the +/− sign AND an accessible name (`${typeLabel} ${amount}`) — never colour alone; the raw untranslated `transaction.type` badge is gone (AC4).
- `EmptyState` (new, shared for Epic 16 reuse): no-data → guiding copy + "Add transaction" CTA opening a create composer (added a dedicated create-mode `TransactionEntryModal` on the page); filtered-empty → "no matches" + Clear filters.
- `SwipeableRow` restyled to tokens (surface content, expense/accent action panels) + flush corners so it nests in the group Card. All swipe mechanics preserved.
- States restyled onto tokens: error → `expense.subtle`, offline → `warning.subtle`, spinner → `accent`, delete-undo toast → `income`, export progress → `brand`, skeletons (both the list and the Suspense fallback) → grouped-row shape.
- PRESERVED (verified): SWR list/categories queries + config, URL drill-down, debounced search, page-reset, realtime channel, pull-to-refresh, online/offline toasts, edit flow, optimistic delete + 5s undo + deferred DELETE + rollback, CSV export + large-dataset progress modal, `FilterBreadcrumbs`, `PaginationControls`.
- Semantic page heading kept (`h1`). No API/migration changes — presentation only.
- 5 new i18n keys added to en + bg (parity test green).

### Change Log

- 2026-07-23 — Implemented Story 16.1 (Transactions redesign): date-grouped list, TransactionRow + EmptyState primitives, groupTransactionsByDate helper, token restyle of every state, SwipeableRow tokens. 9 new tests. Status → review.

### File List

- NEW `src/lib/utils/groupTransactionsByDate.ts`
- NEW `src/lib/utils/__tests__/groupTransactionsByDate.test.ts`
- NEW `src/components/transactions/TransactionRow.tsx`
- NEW `src/components/transactions/__tests__/TransactionRow.test.tsx`
- NEW `src/components/shared/EmptyState.tsx`
- MODIFIED `src/app/transactions/page.tsx`
- MODIFIED `src/components/transactions/SwipeableRow.tsx`
- MODIFIED `messages/en.json`
- MODIFIED `messages/bg.json`
