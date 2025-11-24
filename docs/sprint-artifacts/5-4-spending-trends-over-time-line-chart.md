# Story 5.4: Spending Trends Over Time (Line Chart)

Status: drafted

## Story

As a user,
I want to see my spending trends over the last 6 months,
So that I can identify patterns and changes in my spending behavior.

## Acceptance Criteria

**Given** I view the dashboard
**When** I look at the trends section
**Then** I see a line chart showing spending over the last 6 months

**And** X-axis shows months (e.g., "Jun", "Jul", "Aug", "Sep", "Oct", "Nov")
**And** Y-axis shows dollar amounts
**And** Two lines plotted: Income (green) and Expenses (red)
**And** Data points show exact amounts on hover
**And** Tooltip shows: "[Month]: Income $X, Expenses $Y"
**And** Chart renders responsively (300px height, full width)
**And** Grid lines for readability
**And** Legend indicates Income vs Expenses
**And** Empty state: "Add transactions to see trends"
**And** Chart updates when transactions added (<300ms)
**And** Mobile: chart scrolls horizontally if needed, or shows last 3 months by default
**And** Accessible data table alternative for screen readers

## Tasks / Subtasks

- [ ] Create SpendingTrends component (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
  - [ ] Create `src/components/dashboard/SpendingTrends.tsx`
  - [ ] Implement Recharts `<LineChart>` with `<ResponsiveContainer>`
  - [ ] Add `<XAxis>` with month labels (e.g., "Jun", "Jul")
  - [ ] Add `<YAxis>` with dollar amounts
  - [ ] Add two `<Line>` components: Income (green stroke) and Expenses (red stroke)
  - [ ] Configure `<Tooltip>` to show "[Month]: Income $X, Expenses $Y"
  - [ ] Add `<CartesianGrid>` for grid lines
  - [ ] Add `<Legend>` showing Income vs Expenses
  - [ ] Set responsive dimensions (300px height, 100% width)
  - [ ] Add empty state handling: "Add transactions to see trends"
  - [ ] Use SWR hook to fetch trends data
  - [ ] Handle mobile: show last 3 months by default or horizontal scroll
- [ ] Create trends API endpoint (AC: 1, 2, 3)
  - [ ] Create `src/app/api/dashboard/trends/route.ts`
  - [ ] Implement GET handler with authentication
  - [ ] Query Supabase: aggregate income/expenses by month for last 6 months
  - [ ] Use SQL `DATE_TRUNC('month', date)` for grouping
  - [ ] Calculate monthly totals: SUM for income, SUM for expenses
  - [ ] Format month labels using date-fns: `format(date, 'MMM')`
  - [ ] Return JSON: `{ months: [{ month, monthLabel, income, expenses, net }], startDate, endDate }`
- [ ] Create useTrends custom hook (AC: 10)
  - [ ] Create `src/lib/hooks/useTrends.ts`
  - [ ] Implement SWR hook wrapping `/api/dashboard/trends?months=6`
  - [ ] Add 5-second deduplication interval
  - [ ] Add Supabase Realtime subscription for transaction changes
  - [ ] Trigger revalidation on data changes
  - [ ] Return `{ data, error, isLoading, mutate }`
- [ ] Create custom tooltip component (AC: 5)
  - [ ] Create `src/components/dashboard/LineChartTooltip.tsx`
  - [ ] Implement Recharts CustomTooltip interface
  - [ ] Display format: "[Month]: Income $X, Expenses $Y"
  - [ ] Use Chakra UI Box for styling
  - [ ] Show tooltip within 100ms of hover
- [ ] Add accessible data table (AC: 12)
  - [ ] Create hidden HTML table with same data
  - [ ] Use ARIA attributes: `aria-label="Spending trends over time"`
  - [ ] Visually hidden CSS class (screen reader accessible)
  - [ ] Table structure: headers (Month, Income, Expenses, Net), data rows
- [ ] Integrate chart into dashboard page (AC: 1)
  - [ ] Import SpendingTrends into `src/app/(dashboard)/page.tsx`
  - [ ] Render below SpendingByCategory chart
  - [ ] Wrap in ChartContainer for loading/error handling
  - [ ] Add section heading: "Spending Trends (Last 6 Months)"

## Dev Notes

### Architecture Alignment

**Charting Library:**
- Recharts `<LineChart>` for time-series data
- X-axis: categorical (month labels)
- Y-axis: linear (dollar amounts)
- Two `<Line>` components for Income and Expenses
- `<CartesianGrid>` for visual reference

**API Design:**
- `GET /api/dashboard/trends?months=6`
- Server-side aggregation by month using SQL `DATE_TRUNC`
- Returns array of monthly data points in chronological order

**Data Flow:**
1. SpendingTrends component calls `useTrends()` hook
2. Hook fetches from `/api/dashboard/trends` via SWR
3. API queries Supabase: `GROUP BY DATE_TRUNC('month', date)`
4. Data cached client-side, updates via Realtime subscription
5. Recharts renders line chart with two lines

**Performance Optimizations:**
- Database-level aggregation by month
- SWR caching reduces repeated API calls
- ResponsiveContainer rerenders efficiently
- Mobile: limit to 3 months default to reduce data points

### Source Tree Components to Touch

**New Files to Create:**
- `src/components/dashboard/SpendingTrends.tsx` - Line chart component
- `src/components/dashboard/LineChartTooltip.tsx` - Custom tooltip
- `src/app/api/dashboard/trends/route.ts` - API endpoint
- `src/lib/hooks/useTrends.ts` - SWR hook

**Existing Files to Modify:**
- `src/app/(dashboard)/page.tsx` - Import and render SpendingTrends

**Existing Files to Reference:**
- `src/types/transaction.types.ts` - Transaction type definitions
- `src/lib/supabase/client.ts` - Supabase client
- `src/lib/utils/currency.ts` - Currency formatting for tooltip
- External: `date-fns` for month label formatting

### Testing Standards Summary

**Manual Testing Checklist:**
1. **Chart Rendering:**
   - Line chart visible on dashboard
   - Chart renders with correct dimensions (300px height, full width)
   - Two lines visible: Income (green) and Expenses (red)
2. **Axes:**
   - X-axis shows 6 month labels (e.g., "Jun", "Jul", "Aug", "Sep", "Oct", "Nov")
   - Y-axis shows dollar amounts with proper scale
   - Grid lines visible for readability
3. **Data Accuracy:**
   - Income line matches actual monthly income totals
   - Expenses line matches actual monthly expense totals
   - Data points aligned with correct months
4. **Interactivity:**
   - Hover over data point → tooltip appears within 100ms
   - Tooltip shows: "[Month]: Income $X, Expenses $Y"
   - Hover out → tooltip disappears
5. **Legend:**
   - Legend displays: Income (green) and Expenses (red)
   - Legend positioned appropriately (top or bottom)
6. **Empty State:**
   - No transactions → shows "Add transactions to see trends"
   - No chart rendered when empty
7. **Real-time Updates:**
   - Add transaction → chart updates within 300ms
   - Edit/delete transaction → chart recalculates
8. **Responsive:**
   - Desktop: chart full width of container
   - Tablet: chart adapts to smaller space
   - Mobile: shows last 3 months or horizontal scroll
9. **Accessibility:**
   - Screen reader can access data table
   - Table has proper headers
   - ARIA labels present

**SQL Query Testing:**
```sql
-- Verify monthly trends aggregation
SELECT
  DATE_TRUNC('month', date) as month,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
FROM transactions
WHERE user_id = :id
  AND date >= :six_months_ago
GROUP BY month
ORDER BY month
```

### Project Structure Notes

**Alignment with Unified Structure:**
- Chart components in `src/components/dashboard/`
- API routes in `src/app/api/dashboard/`
- Hooks in `src/lib/hooks/`
- Reuses Recharts setup from Story 5.3

**Date Handling:**
- Use `date-fns` for month label formatting: `format(date, 'MMM')`
- SQL `DATE_TRUNC` for month-level aggregation
- Ensure timezone handling consistent with transaction dates

**Mobile Optimization:**
- Default to 3 months on mobile to reduce data density
- Alternative: horizontal scroll with full 6 months
- Responsive breakpoint at 768px

**No Detected Conflicts:**
- Transaction data structure supports date-based aggregation
- date-fns already in dependencies (used elsewhere)
- Aligns with performance targets (<300ms updates)

### References

- [Source: docs/PRD.md#FR24] - Line chart showing income vs expenses over 6 months
- [Source: docs/PRD.md#FR23] - Hover tooltips show exact amounts
- [Source: docs/PRD.md#FR26] - Chart updates in real-time (<300ms)
- [Source: docs/PRD.md#FR45] - Mobile responsive design
- [Source: docs/architecture.md#Recharts-Integration] - Recharts for line charts
- [Source: docs/ux-design-specification.md#Spending-Trends-Chart] - Line chart design, colors, grid
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#Trends-API] - API contract, SQL implementation
- [Source: docs/sprint-artifacts/tech-spec-epic-5.md#SpendingTrends-Component] - Recharts LineChart usage
- [Source: docs/epics.md#Story-5.4] - Full acceptance criteria and technical notes

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Model name and version will be added during implementation -->

### Debug Log References

<!-- Debug logs will be added during implementation -->

### Completion Notes List

<!-- Implementation notes will be added during implementation -->

### File List

<!-- Modified files will be listed during implementation -->
