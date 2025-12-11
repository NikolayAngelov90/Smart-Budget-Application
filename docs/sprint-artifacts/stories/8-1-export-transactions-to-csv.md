# Story 8.1: Export Transactions to CSV

Status: drafted

## Story

As a user,
I want to export my complete transaction history to CSV format,
So that I can analyze data in Excel or import to other tools.

## Acceptance Criteria

**AC-8.1.1:** CSV Export Button
✅ Export button labeled "Export Transactions (CSV)" exists in Settings and/or Transactions page

**AC-8.1.2:** CSV File Download
✅ Clicking export button triggers CSV file download via browser save dialog

**AC-8.1.3:** CSV Filename Format
✅ CSV filename follows format: `transactions-YYYY-MM-DD.csv` (date of export)

**AC-8.1.4:** CSV Column Structure
✅ CSV contains columns: Date, Type, Category, Amount, Notes, Created At

**AC-8.1.5:** Complete Data Export
✅ All user transactions included (no pagination limit), sorted by date (newest first)

**AC-8.1.6:** Special Character Handling
✅ Commas in notes, quotes, and newlines properly escaped using CSV standards

**AC-8.1.7:** Currency Formatting
✅ Amount formatted as `$123.45` (no currency symbol for Excel compatibility)

**AC-8.1.8:** Date ISO Format
✅ Date column uses `YYYY-MM-DD` format (ISO 8601)

**AC-8.1.9:** Performance
✅ Export completes in <3 seconds for typical datasets (<1,000 transactions)
✅ Large datasets (>5,000) show progress indicator during export

**AC-8.1.10:** Client-Side Processing
✅ Export uses papaparse library client-side (no server processing for privacy)

**AC-8.1.11:** Success Feedback
✅ Success toast displays: "CSV exported successfully!"

## Tasks / Subtasks

- [ ] Install dependencies (AC: 8.1.10)
  - [ ] Install papaparse: `npm install papaparse`
  - [ ] Install TypeScript types: `npm install --save-dev @types/papaparse`

- [ ] Create export service module (AC: 8.1.1-8.1.11)
  - [ ] Create `src/lib/services/exportService.ts`
  - [ ] Implement `exportTransactionsToCSV()` function
  - [ ] Map transaction data to CSV structure with proper column headers
  - [ ] Format dates as YYYY-MM-DD (ISO 8601)
  - [ ] Format amounts as $123.45
  - [ ] Handle null/empty notes (empty string)
  - [ ] Use papaparse for CSV generation with proper escaping
  - [ ] Create blob and trigger browser download
  - [ ] Generate filename: `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`

- [ ] Add API endpoint for fetching all transactions (AC: 8.1.5)
  - [ ] Modify `src/app/api/transactions/route.ts` to handle `?all=true` query param
  - [ ] Add conditional logic to bypass pagination when `all=true`
  - [ ] Ensure RLS policies are enforced (user can only export their own data)

- [ ] Add export button to Settings page (AC: 8.1.1)
  - [ ] Add "Export Transactions (CSV)" button in Settings Data Export section
  - [ ] Wire onClick handler to call export service
  - [ ] Show loading state during export
  - [ ] Display success toast on completion
  - [ ] Display error toast on failure

- [ ] Optional: Add export button to Transactions page (AC: 8.1.1)
  - [ ] Add export button in transactions list header
  - [ ] Same handler as Settings page

- [ ] Add performance optimizations (AC: 8.1.9)
  - [ ] Show progress indicator for datasets >5,000 transactions
  - [ ] Test performance with large datasets

- [ ] Write unit tests (AC: All)
  - [ ] Test CSV generation with sample data
  - [ ] Test special character escaping (commas, quotes, newlines)
  - [ ] Test empty notes handling
  - [ ] Test date formatting
  - [ ] Test amount formatting
  - [ ] Test sort order (newest first)

- [ ] Write integration tests (AC: All)
  - [ ] Test full export flow: fetch data → generate CSV → download
  - [ ] Test with various dataset sizes (10, 100, 1000 transactions)
  - [ ] Test error handling (API failure, export failure)

## Dev Notes

- **Privacy-first design:** All CSV generation happens client-side using papaparse. Financial data never sent to server for processing.
- **Performance target:** <3 seconds for 1,000 transactions. Show progress indicator for >5,000.
- **Browser download:** Use Blob API + URL.createObjectURL() for download trigger
- **Date formatting:** Use date-fns for consistent ISO 8601 formatting
- **Error handling:** Show user-friendly error toasts if export fails

### Project Structure Notes

**New Files:**
- `src/lib/services/exportService.ts` - Export service with `exportTransactionsToCSV()` function

**Modified Files:**
- `src/app/api/transactions/route.ts` - Add `?all=true` query param support
- `src/app/(dashboard)/settings/page.tsx` - Add CSV export button (to be created in Story 8.3)
- `src/app/(dashboard)/transactions/page.tsx` - Optional: Add export button in list header

**Alignment with Architecture:**
- Uses existing transactionService and categoryService for data fetching
- Follows Next.js App Router patterns for API routes
- Uses Chakra UI Button component for export button
- Uses react-hot-toast for success/error feedback

### References

- [Tech Spec: Epic 8 - Story 8.1 Acceptance Criteria](../tech-spec-epic-8.md#story-81-export-transactions-to-csv)
- [Tech Spec: Export Service Implementation](../tech-spec-epic-8.md#apis-and-interfaces)
- [Tech Spec: User Flow 1 - CSV Export](../tech-spec-epic-8.md#user-flow-1-export-transactions-to-csv-story-81)
- [PRD: FR39 - Export transactions to CSV](../../PRD.md#functional-requirements)
- [Architecture: Database Schema - transactions table](../../architecture.md#database-schema)
- [Epics: Story 7.1 Technical Notes](../../epics.md#story-71-export-transactions-to-csv)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List
