---
baseline_commit: 1515d55
source: deferred-work.md (16-4 — "a story, not a patch")
---

# Story DW-3: Insight details in the user's language

Status: done

## Story

As someone using the app in Bulgarian,
I want insight details to stay in Bulgarian when I expand them,
so that the app does not switch languages mid-interaction.

## Problem

The insights **list** is localised — `AIInsightCard.getLocalizedText()` builds
translated title and description text. Everything behind a tap is not:

1. **`InsightDetailModal` renders the RAW stored `insight.title` /
   `insight.description`** instead of the localised text the card already
   computed. The row says one thing in Bulgarian; opening it shows English.
2. **`InsightMetadata` is hardcoded English.** `src/components/insights/
   InsightMetadata.tsx:129` ("Spending Details for …"), and "View these
   transactions" at `:185`, `:238`, `:291`. No `useTranslations` at all.
3. **Two Epic-12 insight types have no renderer.** `spending_anomaly` and
   `new_high_spend_category` have correct colour, icon and grouping after 16-4,
   but expanding one shows "No additional details available", a divider, and
   then a bold "Why am I seeing this?" heading **with nothing under it** — a
   heading introducing empty space.

`getLocalizedText` being private to `AIInsightCard` is the root cause of (1):
the modal cannot reuse it, so it fell back to the raw column. This is why the
deferred entry called it a story rather than a patch — the fix is an extraction
plus a translation pass, not a one-line change.

## Acceptance Criteria

1. **Given** the Bulgarian UI **When** an insight is expanded or opened in the modal **Then** its title and description are the SAME localised strings shown on the card — never the raw stored English.
2. **Given** the Bulgarian UI **When** the metadata panel renders **Then** every label in it is translated ("Spending Details for", "Why am I seeing this?", "View these transactions", and any others found during the pass).
3. **Given** an insight type with no metadata to show **Then** neither the "See details" affordance nor the "Why am I seeing this?" heading renders — no heading may introduce empty space.
4. **And** `spending_anomaly` and `new_high_spend_category` are treated as "nothing to show" per AC3 — no "See details" affordance at all. (Decided; renderers are a separate feature.)
5. **Given** the English UI **Then** the visible copy is unchanged from today (this is a localisation fix, not a rewording).
6. **Given** every new string **Then** it exists in BOTH `messages/en.json` and `messages/bg.json` (CI enforces parity).
7. **Given** `getLocalizedText` **Then** it lives in one shared place and both the card and the modal use it — no second copy.
8. **Given** verification **Then** `tsc`, `lint`, full `jest` (baseline 2276 — zero regressions) and `next build` pass.

## Decided (DW-5 #5, 2026-07-30)

For `spending_anomaly` and `new_high_spend_category`: **hide "See details"** when
there is nothing to show — the trigger, the divider and the heading suppressed
together. Real metadata renderers stay on the backlog as a separate feature.

So Task 3 is the suppression path, not renderers.

## Tasks / Subtasks

- [x] **Task 1: Extract the localiser (AC: 1, 7)**
  - [x] Move `getLocalizedText` out of `AIInsightCard` into a shared helper that takes the insight and the translator.
  - [x] Point both `AIInsightCard` and `InsightDetailModal` at it.
- [x] **Task 2: Translate the metadata panel (AC: 2, 5, 6)**
  - [x] Replace every hardcoded string in `InsightMetadata.tsx` with `t(...)`.
  - [x] Add the keys to en + bg. English copy must match what ships today.
- [x] **Task 3: Suppress the empty panel for the two Epic-12 types (AC: 3, 4)**
  - [x] Make "nothing to show" suppress the trigger AND the divider AND the heading — three separate renders, and suppressing only the body is what produces today's empty heading.
- [x] **Task 4: Verify (AC: 8)**
  - [x] Check an expanded insight of each type in BOTH locales.

## Dev Notes

- **Hardcoded strings found:** `InsightMetadata.tsx:129`, `:185`, `:238`, `:291`.
  Grep the whole file rather than trusting that list — those were found by
  searching for three known phrases.
- The insight `title`/`description` columns store English at generation time.
  They are the fallback, not the source of truth for display. Anything rendering
  them directly is a bug of this class; check for other call sites while here.
- `getDateLocale` is now exported from `@/lib/utils/dateFormatter` (as of
  `1515d55`) — use it for any date rendering in the panel rather than inlining
  `locale === 'bg' ? bg : undefined`.
- AC3 is the one most likely to be half-done: the trigger, the divider and the
  heading are three separate renders. Suppressing only the body is what produces
  today's empty heading.
- i18n parity is CI-enforced; en and bg sit at 936 keys each as of DW-7.

## Implementation notes

- **The root cause was scope, not translation.** `getLocalizedText` lived inside
  `AIInsightCard`, so the modal could not reuse it and fell back to the raw
  columns. Extracted to `src/lib/utils/insightText.ts`; both surfaces call it.
- **30 strings** moved into `t()` across en + bg — four explanations, fourteen
  field labels, four headings, the period/comparison/date lines and the
  transactions link. English copy is byte-identical to what shipped (AC5).
- **AC3 was the one at risk of being half-done**, exactly as the Dev Notes
  warned: the trigger, the divider and the heading are three separate renders.
  `hasInsightMetadata` gates all three — `InsightsList` uses it for `expandable`
  so no affordance appears, and the panel returns null.
- Panel dates now use the shared `getDateLocale` rather than a fifth inlined
  `locale === 'bg' ? bg : undefined`.

## Note

`InsightsList.test.tsx` mocked `../InsightMetadata` with the component alone, so
the newly imported `hasInsightMetadata` was undefined at runtime. Now spreads
`requireActual` — the same partial-mock trap that bit four route tests in
cluster B. Worth watching for whenever a module gains an export.
