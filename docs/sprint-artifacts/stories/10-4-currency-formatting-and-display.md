# Story 10.4: Currency Formatting & Display Throughout App

Status: in-progress

## Story

As a user who has selected my preferred currency,
I want all monetary amounts displayed with the correct currency symbol and formatting,
so that my financial data is consistently presented in my chosen currency.

## Acceptance Criteria

**AC-10.4.1:** Create `formatCurrency(amount, currencyCode, locale)` utility function
- Already completed in Story 10-3 (formatCurrency now accepts currencyCode parameter)

**AC-10.4.2:** All monetary displays use `formatCurrency` (dashboard StatCards, charts, transaction list, insights)
- DashboardStats, CategorySpendingChart, SpendingTrendsChart, MonthOverMonth pass currency code
- Transaction list uses formatCurrency instead of hardcoded `$`
- InsightMetadata uses shared formatCurrency instead of local implementation

**AC-10.4.3:** Dashboard summary cards show amounts in user's preferred currency

**AC-10.4.4:** Transaction list shows amounts with correct currency symbol

**AC-10.4.5:** Chart tooltips and axis labels display formatted currency

**AC-10.4.6:** Export (CSV/PDF) includes currency symbol and formatting per user preference

**AC-10.4.7:** AI insight recommendations display amounts in user's preferred currency

**AC-10.4.8:** Category spending chart legend shows formatted currency amounts

**AC-10.4.9:** Month-over-month comparison shows formatted currency with +/- indicators

**AC-10.4.10:** No hardcoded "$" or "USD" strings remain in the codebase (production source)

**AC-10.4.11:** Unit tests for formatCurrency with edge cases (0, negative, very large numbers, different locales)
- Already covered in Story 10-3 currency tests

## Tasks / Subtasks

- [ ] Task 1: Create story and context files
- [ ] Task 2: Update dashboard components (AC: 10.4.2, 10.4.3, 10.4.5, 10.4.8, 10.4.9)
  - [ ] DashboardStats: pass currency code from useUserPreferences
  - [ ] CategorySpendingChart: pass currency code
  - [ ] SpendingTrendsChart: pass currency code
  - [ ] MonthOverMonth: pass currency code
- [ ] Task 3: Update transaction page (AC: 10.4.4)
  - [ ] Replace local formatAmount with formatCurrency from shared utility
- [ ] Task 4: Update export service (AC: 10.4.6)
  - [ ] CSV export: use formatCurrency instead of hardcoded `$`
  - [ ] PDF export: use formatCurrency instead of hardcoded `$`
- [ ] Task 5: Update InsightMetadata (AC: 10.4.7)
  - [ ] Replace local formatCurrency with shared utility import
- [ ] Task 6: Verify no hardcoded $ or USD remain (AC: 10.4.10)
- [ ] Task 7: Update affected tests
- [ ] Task 8: Run full verification

## Dev Notes

### Files to Modify

**Dashboard components** (pass currency from preferences):
- `src/components/dashboard/DashboardStats.tsx` - formatCurrency/formatCurrencyWithSign calls
- `src/components/dashboard/CategorySpendingChart.tsx` - formatCurrency calls
- `src/components/dashboard/SpendingTrendsChart.tsx` - formatCurrency calls
- `src/components/dashboard/MonthOverMonth.tsx` - formatCurrency calls

**Transaction display**:
- `src/app/transactions/page.tsx` - local formatAmount function with hardcoded `$`

**Export service**:
- `src/lib/services/exportService.ts` - 6 instances of hardcoded `$${amount.toFixed(2)}`

**Insights**:
- `src/components/insights/InsightMetadata.tsx` - local formatCurrency with hardcoded USD

### Architecture Pattern

Components use `useUserPreferences()` hook to get the user's `currency_format` preference, then pass it to `formatCurrency(amount, language, currencyCode)`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Change Log

- 2026-02-12: Story created and implementation started
