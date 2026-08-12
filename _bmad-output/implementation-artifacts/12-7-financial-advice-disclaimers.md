# Story 12.7: Financial Advice Disclaimers

Status: done

> Sprint story 12-7 = plan Story 12.1 (see Epic 12 sprint-sequencing note in epics.md).
> Implemented out of band on 2026-06-02 to close the HIGH-1 compliance gap found by
> the implementation-readiness assessment (AI content was shipping without disclaimers).

## Story

As a user viewing AI-generated insights,
I want clear disclaimers that insights are informational and not licensed financial advice,
So that I understand the limitations and the app avoids fiduciary liability.

## Acceptance Criteria

1. **Given** the system displays any AI-generated insight, nudge, or recovery plan, **When** the user views the content, **Then** a disclaimer is visible indicating the information is for educational purposes only and not licensed financial advice. ✅
2. **Given** a user opens Settings, **When** they view the "About AI Insights" section, **Then** a persistent full disclaimer is accessible. ✅
3. **Given** any disclaimer is shown, **When** the user reads the primary content, **Then** the disclaimer does not obstruct it (compact muted inline note on content surfaces; full block only in Settings). ✅

## Tasks / Subtasks

- [x] Task 1: Create reusable `FinancialDisclaimer` component (AC: #1, #2, #3)
  - [x] 1.1 `src/components/ai/FinancialDisclaimer.tsx` with `compact` (default) and `full` variants
  - [x] 1.2 Compact = muted italic `Text` with `role="note"`; full = Chakra `Alert` info block with `role="note"`
- [x] Task 2: Wire disclaimer into all AI-generated content surfaces (AC: #1)
  - [x] 2.1 `AIBudgetCoach` (dashboard) — compact disclaimer below insight cards
  - [x] 2.2 `InsightsPageContent` (insights page) — compact disclaimer under the header
  - [x] 2.3 `SmartNudge` (real-time nudge banner) — compact disclaimer inside the alert
- [x] Task 3: Add persistent disclaimer to Settings (AC: #2)
  - [x] 3.1 New "About AI Insights" card in `settings/page.tsx` rendering the `full` variant
- [x] Task 4: i18n (AC: #1, #2)
  - [x] 4.1 `disclaimer` namespace (`compact`, `full`, `settingsHeading`) in `messages/en.json`
  - [x] 4.2 Bulgarian equivalents in `messages/bg.json`
- [x] Task 5: Tests (AC: all)
  - [x] 5.1 `FinancialDisclaimer.test.tsx` — compact + full variants, text content, note role (5 tests)

## Dev Notes

- The recovery-plan surface (sprint story 12-4) is not yet built; when it is, it must render `<FinancialDisclaimer />`. The component is in place and ready to drop in.
- Compact variant is intentionally subtle (xs, gray.500, italic) so it satisfies "does not obstruct primary content" while remaining visible and screen-reader accessible via `role="note"` + `aria-label`.

### File List

- src/components/ai/FinancialDisclaimer.tsx — CREATED (compact + full variants)
- src/components/ai/__tests__/FinancialDisclaimer.test.tsx — CREATED (5 tests)
- src/components/dashboard/AIBudgetCoach.tsx — MODIFIED (compact disclaimer under insights)
- src/components/insights/InsightsPageContent.tsx — MODIFIED (compact disclaimer under header)
- src/components/ai/SmartNudge.tsx — MODIFIED (compact disclaimer inside nudge alert)
- src/app/(dashboard)/settings/page.tsx — MODIFIED (About AI Insights card with full disclaimer)
- messages/en.json — MODIFIED (disclaimer namespace)
- messages/bg.json — MODIFIED (disclaimer namespace)

### Completion Notes List

- All 3 ACs satisfied. 5 new tests; 1259 total green. TypeScript + ESLint clean. No regressions.
- Closes implementation-readiness finding HIGH-1 (AI content live without disclaimer).
