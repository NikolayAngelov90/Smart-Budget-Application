# Story 6.4: Insight Metadata and Supporting Data

Status: drafted

## Story

As a user,
I want to see supporting data for AI insights,
So that I understand the basis for recommendations.

## Acceptance Criteria

**Given** I view an AI insight
**When** I click "See details" or expand the insight
**Then** I see supporting data explaining the insight

**AC1: Expandable Section**
- Insight card has expandable section (accordion or modal)
- Click to expand shows metadata details
- Close/collapse button to hide details

**AC2: Metadata Display**
- Shows metadata: category, amounts compared, time periods, calculations
- Example for spending increase:
  - Category name
  - Current month: amount and transaction count
  - Previous month: amount and transaction count
  - Increase: absolute and percentage change

**AC3: Link to Transactions**
- Provides link to view transactions for that category/period
- Link format: `/transactions?category=[id]&month=[month]`

**AC4: Micro-Chart (Optional)**
- Optional: Line chart showing trend of last 3 months
- Uses Recharts library for sparkline visualization

**AC5: Plain Language Explanation**
- "Why am I seeing this?" explanation in plain language
- Explains the rule logic behind the insight

**AC6: Responsive Design**
- Mobile: Full-screen modal for metadata display
- Desktop: Inline expansion (accordion or disclosure)

## Tasks / Subtasks

- [ ] **Task 1: Extend AIInsightCard with Expandable Section** (AC: #1, #6)
  - [ ] Open `src/components/insights/AIInsightCard.tsx` from Story 6.2
  - [ ] Add Chakra UI Accordion or Disclosure for expandable section
  - [ ] Add "See details" button/link at bottom of card
  - [ ] On mobile: trigger Modal instead of inline expansion (use `useBreakpointValue`)
  - [ ] On desktop: use Accordion or Disclosure for inline expansion
  - [ ] Add collapse button with icon (ChevronUp/ChevronDown)
  - [ ] Write component tests for expand/collapse behavior

- [ ] **Task 2: Create Insight Metadata Display Component** (AC: #2, #5)
  - [ ] Create `src/components/insights/InsightMetadata.tsx` component
  - [ ] Accept props: `insight` (Insight object with metadata field)
  - [ ] Parse `insight.metadata` JSONB field
  - [ ] Render metadata fields dynamically based on insight type
  - [ ] For `spending_increase` type, display:
    - Category name
    - Current month amount + transaction count
    - Previous month amount + transaction count
    - Absolute change (+$140)
    - Percentage change (+41%)
  - [ ] For `budget_recommendation` type, display:
    - Category name
    - 3-month average
    - Recommended budget (average + 10%)
    - Explanation of calculation
  - [ ] For `unusual_expense` type, display:
    - Transaction amount
    - Category average
    - Standard deviation
    - Number of std devs from mean
  - [ ] For `positive_reinforcement` type, display:
    - Category name
    - Budget amount
    - Actual spending
    - Savings amount + percentage under budget
  - [ ] Add "Why am I seeing this?" section with rule explanation
  - [ ] Use friendly, plain language for all explanations
  - [ ] Style with responsive Typography and Box components
  - [ ] Write component tests for each insight type

- [ ] **Task 3: Add Transaction Drill-Down Link** (AC: #3)
  - [ ] In InsightMetadata component, add link to transactions page
  - [ ] Build link URL: `/transactions?category=${categoryId}&month=${month}`
  - [ ] Use Next.js Link component with query params
  - [ ] Link text: "View these transactions →"
  - [ ] Open in same tab (stay in app flow)
  - [ ] Verify query params are correctly parsed on transactions page (may require updates in Story 3.2)

- [ ] **Task 4: Optional Micro-Chart for Trends** (AC: #4, optional)
  - [ ] Install Recharts if not already available: `npm install recharts`
  - [ ] Create sparkline component: `src/components/insights/InsightTrendChart.tsx`
  - [ ] Accept props: `dataPoints` (array of {month, amount})
  - [ ] Render small LineChart (height: 60px, width: 100%)
  - [ ] Show last 3 months of data from metadata
  - [ ] Minimal styling: no axes labels, simple line, no grid
  - [ ] Integrate into InsightMetadata for applicable insight types
  - [ ] Make optional: only render if metadata includes `trend_data` field
  - [ ] Write component tests

- [ ] **Task 5: Create Insight Detail Modal for Mobile** (AC: #6)
  - [ ] Create `src/components/insights/InsightDetailModal.tsx` component
  - [ ] Use Chakra UI Modal component
  - [ ] Accept props: `insight`, `isOpen`, `onClose`
  - [ ] Modal content: InsightMetadata component
  - [ ] Full-screen on mobile, centered on desktop (responsive size)
  - [ ] Close button in header
  - [ ] Swipe down to close on mobile (if supported by Chakra)
  - [ ] Test modal accessibility (keyboard navigation, focus trap)

- [ ] **Task 6: Update Rule Functions to Include Metadata** (AC: #2)
  - [ ] Open `src/lib/ai/insightRules.ts` from Story 6.1
  - [ ] Ensure each rule function populates `metadata` field with comprehensive data
  - [ ] `detectSpendingIncrease` metadata:
    ```typescript
    {
      category_id: string,
      category_name: string,
      current_amount: number,
      previous_amount: number,
      percent_change: number,
      transaction_count_current: number,
      transaction_count_previous: number,
      current_month: string, // e.g., "2025-12"
      previous_month: string,
    }
    ```
  - [ ] `recommendBudgetLimit` metadata:
    ```typescript
    {
      category_id: string,
      category_name: string,
      three_month_average: number,
      recommended_budget: number,
      calculation_explanation: string,
      months_analyzed: string[], // e.g., ["2025-10", "2025-11", "2025-12"]
    }
    ```
  - [ ] `flagUnusualExpense` metadata:
    ```typescript
    {
      category_id: string,
      category_name: string,
      transaction_amount: number,
      category_average: number,
      standard_deviation: number,
      std_devs_from_mean: number,
      transaction_id: string,
      transaction_date: string,
    }
    ```
  - [ ] `generatePositiveReinforcement` metadata:
    ```typescript
    {
      category_id: string,
      category_name: string,
      budget_amount: number,
      actual_spending: number,
      savings_amount: number,
      percent_under_budget: number,
      current_month: string,
    }
    ```
  - [ ] Verify metadata is stored in database correctly

- [ ] **Task 7: Integration Testing** (AC: All)
  - [ ] Test expand/collapse: Click "See details" → metadata section expands
  - [ ] Test mobile modal: On mobile viewport, click details → modal opens
  - [ ] Test desktop accordion: On desktop, click details → inline expansion
  - [ ] Test metadata display for each insight type (4 types)
  - [ ] Verify all metadata fields render correctly
  - [ ] Test transaction link: Click "View these transactions" → navigate to transactions page with filters
  - [ ] Test "Why am I seeing this?" explanations are clear and helpful
  - [ ] Test optional micro-chart renders when trend data available
  - [ ] Test responsive behavior (mobile vs desktop display)
  - [ ] Test accessibility: keyboard navigation, screen reader compatibility

## Dev Notes

### Project Structure Notes

**Files to Create:**
- `src/components/insights/InsightMetadata.tsx` - Metadata display component
- `src/components/insights/InsightDetailModal.tsx` - Modal for mobile view
- `src/components/insights/InsightTrendChart.tsx` (optional) - Sparkline chart

**Files to Modify:**
- `src/components/insights/AIInsightCard.tsx` - Add expandable section
- `src/lib/ai/insightRules.ts` - Ensure comprehensive metadata is generated

**Dependencies:**
- `recharts` - For optional micro-chart visualization (check if already installed)

**Testing Files:**
- `__tests__/components/insights/InsightMetadata.test.tsx`
- `__tests__/components/insights/InsightDetailModal.test.tsx`
- `__tests__/components/insights/InsightTrendChart.test.tsx` (if implemented)

### Learnings from Previous Stories

**From Story 6-3-full-ai-insights-page-with-filtering (Status: drafted)**

**Components Available:**
- AIInsightCard component at `src/components/insights/AIInsightCard.tsx`
- Already implements card layout, dismiss button, color coding
- Extend with expandable section for metadata

**From Story 6-1-ai-insights-rules-engine-implementation (Status: drafted)**

**Metadata Storage:**
- Insights table has `metadata` JSONB field for flexible data storage
- Rule functions generate metadata during insight creation
- Verify metadata fields are populated correctly in each rule

**Rule Functions to Update:**
- `detectSpendingIncrease()` in `src/lib/ai/insightRules.ts`
- `recommendBudgetLimit()` in `src/lib/ai/insightRules.ts`
- `flagUnusualExpense()` in `src/lib/ai/insightRules.ts`
- `generatePositiveReinforcement()` in `src/lib/ai/insightRules.ts`

[Source: docs/sprint-artifacts/6-1-ai-insights-rules-engine-implementation.md#Tasks]

**From Story 5-8-responsive-dashboard-for-mobile-and-tablet (Status: done)**

**Responsive Patterns:**
- Use Chakra UI `useBreakpointValue` hook for conditional rendering
- Mobile-first approach: design for mobile, enhance for desktop
- Example: `const isMobile = useBreakpointValue({ base: true, md: false })`

[Source: docs/sprint-artifacts/5-8-responsive-dashboard-for-mobile-and-tablet.md#Dev-Agent-Record]

### Architecture and Technical Constraints

**From Epic 6 Tech Spec:**

**Metadata Structure:**
- Stored in `insights.metadata` JSONB column
- Flexible schema allows different fields per insight type
- Each rule function defines its own metadata structure

**Expandable UI Patterns:**
- Desktop: Chakra UI Accordion or Disclosure component for inline expansion
- Mobile: Chakra UI Modal for full-screen detail view
- Use `useBreakpointValue({ base: 'modal', md: 'accordion' })` for responsive behavior

**Transaction Drill-Down:**
- Link format: `/transactions?category=${categoryId}&month=${month}`
- Transactions page (Story 3.2) should support these query params for filtering
- If not supported, may need to add filter logic in Story 3.2

**Micro-Chart Implementation (Optional):**
- Use Recharts LineChart with minimal configuration
- Data format: `[{ month: '2025-10', amount: 450 }, ...]`
- Chart size: Small sparkline (60px height, full card width)
- Render only if `metadata.trend_data` exists

**Plain Language Explanations:**
- "You're seeing this because..." phrasing
- Explain rule threshold and calculation
- Example: "You're seeing this because your Dining spending increased by more than 20% compared to last month. We calculate this by comparing your total spending in each category month-over-month."

**Performance:**
- Metadata rendering should be instant (client-side only)
- Avoid additional API calls when expanding details (metadata already loaded)
- Lazy-load micro-chart component if using code-splitting

### Prerequisites

- ✅ Story 6.1: Rule functions generate insights with metadata
- ✅ Story 6.2: AIInsightCard component exists
- ✅ Story 6.3: Insights page displays list of insights

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-6.md#Data-Models-and-Contracts]
- [Source: docs/sprint-artifacts/tech-spec-epic-6.md#Acceptance-Criteria]
- [Source: docs/epics.md#Story-6.4]
- [Source: Chakra UI docs: Accordion, Disclosure, Modal components]
- [Source: Recharts docs: LineChart component]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Agent model will be recorded during implementation -->

### Debug Log References

<!-- Debug logs will be added during implementation -->

### Completion Notes List

<!-- Completion notes will be added during implementation -->

### File List

<!-- File list will be added during implementation -->

---

**Change Log:**
- 2025-12-03: Story drafted by SM Agent (Niki)
