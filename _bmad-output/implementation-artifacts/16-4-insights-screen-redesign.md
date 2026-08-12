---
baseline_commit: e107c3d
---

# Story 16.4: Insights Screen Redesign

Status: done

<!-- Epic 16 "Design System Rollout" (Phase 3). Brings the Insights page onto the
Quiet Ledger design system and makes the most valuable insight obvious first. -->

## Story

As a person trying to improve my finances,
I want prioritized, categorized AI insights (what changed / opportunities /
progress / warnings / recommendations),
so that the single most valuable insight is obvious first.

## Acceptance Criteria

1. **Given** the Insights page **When** it renders **Then** it uses Quiet Ledger tokens throughout — no leftover `blue.500`, `gray.*`, `bg="white"`, `colorScheme="blue"`, or raw `#3182ce`; header, filters, cards, empty state, spinners and pagination use `surface`/`fg`/`border`/`accent`/`income`/`expense`/`amber`.
2. **Given** insights exist **When** the list renders **Then** the single highest-priority undismissed insight is presented as a **lead/spotlight** card (visually distinct, above the rest), so the most valuable one is obvious first.
3. **And** the remaining insights are **grouped into semantic sections** with headers, ordered by importance: **Needs attention** (`unusual_expense`, `spending_anomaly`) → **What changed** (`spending_increase`, `new_high_spend_category`) → **Recommendations** (`budget_recommendation`) → **Progress** (`positive_reinforcement`). Empty groups are omitted.
4. **Given** insight type colours **When** shown **Then** they map to semantic tokens, not raw Chakra schemes: warnings → clay/`expense`, changes → `amber`, recommendations → `accent`, progress → `income`. **All 6 enum types** must map (incl. `spending_anomaly` + `new_high_spend_category`, which currently fall through to grey/InfoIcon).
5. **Given** the priority badge **When** shown **Then** it reads as a compact human label (e.g. "Critical"), not the verbose `"Priority 5 - Critical"`, and only when it carries meaning (high/critical); low-priority noise is dropped.
6. **Given** ALL existing behavior **When** exercised **Then** it is preserved: type/search/show-dismissed filters (URL-driven), dismiss + undismiss with optimistic updates, pagination, per-card expand (desktop) / detail modal (mobile), `InsightMetadata`, `RefreshInsightsButton`, `SubscriptionGraveyard`, `FinancialDisclaimer`, analytics tracking (`trackInsightsPageViewed`/`trackInsightViewed`/`trackInsightDismissed`), and the app badge.
7. **Given** the redesign **When** verified **Then** `tsc`, `eslint --max-warnings=0`, full `jest` (baseline 2084 pass / 54 skip — zero regressions) and `next build` pass; any new UI strings exist in BOTH `messages/en.json` and `messages/bg.json`.
8. **Given** mobile + desktop **When** viewed **Then** no 320px overflow, ≥44px touch targets, visible focus, AA contrast; grid tracks use `minmax(0,1fr)` (16-3 lesson).

## Tasks / Subtasks

- [x] **Task 1: Insight taxonomy helper (AC: 3, 4)**
  - [x] New `src/lib/utils/insightGroups.ts`: map each of the 6 `insight_type` values → `{ group, tone }` where group ∈ `attention|changed|recommend|progress` and tone ∈ `expense|amber|accent|income`. Export `groupInsights(insights)` returning ordered non-empty groups, and `getInsightTone(type)`.
  - [x] Unit-test the helper (all 6 types mapped, unknown type falls back safely, group order, empty groups omitted, dismissed items stay in their group).

- [x] **Task 2: Card onto tokens + lead variant (AC: 1, 2, 4, 5)**
  - [x] `AIInsightCard`: replace `getColorScheme`/`getIcon` raw schemes with the tone tokens (all 6 types + fallback). `bg="white"`→`surface`, `gray.800`→`fg`, `gray.600`→`fg.muted`, `gray.300`/`gray.50` (dismissed) → `border`/`surface.sunken`. Left accent border uses the tone token.
  - [x] Priority badge → compact label (`Critical`/`High` only; hide for ≤3) using the tone/`amber` tokens, not `"Priority N - Label"`.
  - [x] Add an optional `variant="lead"` (larger padding/title, stronger surface + tone accent) for the spotlight card. Keep dismiss/expand/modal behaviour identical in both variants.

- [x] **Task 3: Page + list composition (AC: 1, 2, 3)**
  - [x] `InsightsList`: render the lead card first (highest priority undismissed; skip when the dismissed filter is on or none qualify), then grouped sections with `SectionHeader`-style headers. Spinner `blue.500`→`accent`, loading text → `fg.muted`, hardcoded "Loading insights..." → i18n.
  - [x] `InsightsPageContent` header: `Heading` → `fg` + `fontFamily="heading"`; subtitle `gray.600` → `fg.muted`.
  - [x] `insights/page.tsx` Suspense fallback: spinner → `accent`, text → `fg.muted` + i18n.
  - [x] `EmptyInsightsState` → shared `EmptyState` primitive (or tokens: `surface.sunken`/`border`/`fg.muted`).
  - [x] `InsightsFilters` + `InsightsPagination`: drop `bg="white"`, `gray.300/400`, `blue.500`, `#3182ce`, `colorScheme="blue"` → tokens/`brand`.

- [x] **Task 4: PRESERVE + verify (AC: 6, 7, 8)**
  - [x] Do NOT change: URL-filter logic, dismiss/undismiss optimistic mutate + revalidate, pagination maths, analytics calls, app badge, `InsightMetadata`, `InsightDetailModal`, `RefreshInsightsButton`, `SubscriptionGraveyard`, `FinancialDisclaimer`.
  - [x] `tsc`, `npm run lint`, full `jest`, `next build`. Manual QA at 320/390/1280: lead card, groups, filters, dismiss/undismiss, pagination, expand + mobile modal.

## Dev Notes

- Files: `src/app/insights/page.tsx` (Suspense shell) + `src/components/insights/*` (`InsightsPageContent` orchestrates; `InsightsList` composes; `AIInsightCard` is the visual unit; `InsightsFilters`, `InsightsPagination`, `EmptyInsightsState`).
- The 6 `insight_type` enum values (migrations 001 + 016): `spending_increase`, `budget_recommendation`, `unusual_expense`, `positive_reinforcement`, `spending_anomaly`, `new_high_spend_category`. The card currently maps only the first four — the other two render grey/InfoIcon (AC4 fixes this).
- Insights are already returned ordered by priority (`?orderBy=priority` used elsewhere); do NOT re-sort server data beyond selecting the lead + grouping.
- Tokens/patterns from 16-1..16-3: `surface`/`surface.sunken`/`surface.hover`, `fg`/`fg.muted`/`fg.subtle`, `border`/`border.strong`, `accent`(+`.subtle`), `income`/`income.subtle`, `expense`/`expense.subtle`, `amber`; Space Grotesk headings; shared `EmptyState`; `minmax(0,1fr)` grid tracks.
- Dismissed cards keep their de-emphasised treatment (opacity + muted surface), just on tokens.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-16.4]
- [Source: memory redesign-quiet-ledger] — tokens + prior-story lessons.
- [Source: supabase/migrations/001_initial_schema.sql + 016_insight_type_expansion.sql] — the enum.

## Dev Agent Record

### Agent Model Used

claude-opus-5 (dev-story)

### Debug Log References

### Completion Notes List

- New `insightGroups.ts` is the single source of truth for type -> group + tone; covers ALL SIX enum values (the Epic-12 types previously rendered grey/generic). `selectLeadInsight` + `groupInsights` never re-sort — the API already ranks by priority.
- Lead/spotlight card ("Start here") + ordered non-empty groups with counts: attention -> changed -> recommend -> progress.
- Tone tokens: warnings clay, changes amber (`warning.fg`/`warning.subtle` — there is NO bare `amber` semantic token, caught during dev), recommendations/progress evergreen.
- Priority badge reduced to compact Critical/High; 1-3 render nothing.
- Also fixed two i18n gaps visible on this page: hardcoded English Refresh label, and unlocalized timestamps ("July 25th, 2026" in the BG UI) via `useLocale` + date-fns `bg`.
- Verify: tsc + eslint clean, jest 2097 pass, build ok, live QA in bg at 1440 + 390 (no overflow).

### File List

- NEW `src/lib/utils/insightGroups.ts` + `__tests__/insightGroups.test.ts`
- MODIFIED `src/components/insights/`: `AIInsightCard`, `InsightsList`, `InsightsPageContent`, `InsightsFilters`, `InsightsPagination`, `EmptyInsightsState`, `InsightMetadata`, `InsightDetailModal`, `RefreshInsightsButton`
- MODIFIED `src/app/insights/page.tsx`, `messages/en.json`, `messages/bg.json`
- MODIFIED `__tests__/components/insights/AIInsightCard.test.tsx` (compact-badge contract)

### Code Review (2026-07-26 — adversarial: Acceptance Auditor + Edge Case Hunter; Blind Hunter lost to a session restart)

PATCHED:
- **Accent stripe never rendered (Edge #3, MAJOR).** `borderLeft="4px"` maps to the CSS *shorthand*, which resets `border-left-style` to `none`; Chakra only supplies `border-style: solid` through a zero-specificity `:where()` rule, so the tone stripe — the card's main signal, and the lead variant's 6px differentiator — was invisible. Fixed with `borderLeftWidth`/`borderLeftColor` longhands (also stops `borderColor` tinting the whole 1px outline).
- **Amber priority badge failed AA (both reviewers, MAJOR).** `warning.fg` amber.600 on amber.50 = 3.85:1 at 11px uppercase. Every `spending_increase` is priority 4, so the failing pair was the most common badge on the page — and a regression from the old 7.62:1. Theme token moved to amber.700 (~5.7:1); only one other consumer, also on a light surface.
- **"Start here" repeated per page (both, MAJOR).** `selectLeadInsight` ran on the 20-item page slice, so page 2+ spotlighted its own top item. New `showLead` prop, set from `filters.page === 1 && !filters.dismissed`.
- **Dismissing the lead reshuffled under the finger (Edge #5, MAJOR).** The optimistic update promoted a different insight into the slot the user had just tapped. The lead is now pinned by id for the list's lifetime, so a dismissed lead stays put (greyed), as the old flat list behaved.
- **Section headings weren't headings (Edge #4).** "Start here" + group titles were `<p>`; now `as="h2"` so SR heading navigation exposes the new IA.
- **Pagination still rendered Chakra blue (Auditor #1).** `colorScheme={... ? 'blue' : 'gray'}` — a *dynamic* expression a static grep can't see; the theme's solid variant bails for non-brand schemes, so the active page button was literally `#3182ce`. Now `brand`.
- **Detail modal left half-migrated (Auditor #2 / Edge #8).** Its own 4-type map meant `spending_anomaly` rendered the RAW ENUM STRING on the primary mobile read path, in a grey badge. Now uses the shared taxonomy + i18n labels for all six types.
- **Error state read as cheerful guidance (Edge #6).** A fetch failure showed the 💡 empty state with no way forward; now a distinct warning treatment + Retry.
- **EmptyState width regression (Auditor #5).** The shared primitive had no `w="full"` and shrank to ~430px inside `VStack align="start"`. Fixed on the primitive.
- Also: title/description `overflowWrap="anywhere"` (long unbroken category names could push the card past 320px), `letterSpacing="wider"` for eyebrows (the reserved token), remaining `blue-600` metadata links → evergreen, `minmax(0,1fr)` grid tracks, refresh-button toasts localized (the label had been localized but the toasts hadn't), dead priority i18n keys removed.

NEW TESTS: `InsightsList.test.tsx` (6) — the file had no component coverage at all; covers lead spotlight, `showLead=false`, lead pinning across a dismiss, group order/counts/omission, `h2` headings, and the lone-insight case.

DEFERRED → deferred-work.md: Epic-12 types expand to a near-empty panel (`InsightMetadata` has no renderer for them); `InsightMetadata` + modal title/description are still hardcoded English (a real i18n story, not a token pass); `RefreshInsightsButton` uses the inert global `mutate` (pre-existing, known class); `getDateLocale` duplication.

DISMISSED: group counts "under-report" when the lead is spotlighted — the count describes the group as rendered, which is correct; `InsightErrorBoundary` red — genuine error surface; `blackAlpha.600` modal scrim — standard.

Re-verified after patches: tsc clean, `npm run lint` (src/) clean, jest 2103 pass, build ok.
