# Story 8.2: Export Financial Report to PDF

Status: ready-for-dev

## Story

As a user,
I want to export a monthly financial report as PDF,
So that I can save or print professional-looking summaries.

## Acceptance Criteria

**AC-8.2.1:** PDF Export Button
✅ Export button labeled "Export Monthly Report (PDF)" exists in Settings page

**AC-8.2.2:** Month Selection
✅ Month selector dropdown shows last 12 months available for export

**AC-8.2.3:** PDF Filename Format
✅ PDF filename follows format: `budget-report-YYYY-MM.pdf`

**AC-8.2.4:** PDF Content - Header
✅ PDF includes header with "Smart Budget Application" title and month/year

**AC-8.2.5:** PDF Content - Summary
✅ PDF includes summary section: Total income, total expenses, net balance

**AC-8.2.6:** PDF Content - Category Breakdown
✅ PDF includes spending by category table with amounts and percentages

**AC-8.2.7:** PDF Content - Top Transactions
✅ PDF includes top 5 highest expense transactions

**AC-8.2.8:** Professional Styling
✅ PDF styled professionally with consistent fonts, spacing, and colors

**AC-8.2.9:** Performance
✅ PDF generation completes in <5 seconds

**AC-8.2.10:** Client-Side Processing
✅ Export uses jsPDF library client-side (no server processing)

**AC-8.2.11:** Mobile Compatibility
✅ PDF formatted for A4 paper size, readable on all devices

**AC-8.2.12:** Success Feedback
✅ Success toast displays: "PDF report downloaded!"

## Tasks / Subtasks

- [ ] Install dependencies (AC: 8.2.10)
  - [ ] Install jsPDF: `npm install jspdf`
  - [ ] Install jspdf-autotable: `npm install jspdf-autotable`
  - [ ] Install TypeScript types if needed

- [ ] Create PDF export function in exportService (AC: 8.2.1-8.2.12)
  - [ ] Add `exportMonthlyReportToPDF()` to `src/lib/services/exportService.ts`
  - [ ] Implement PDF header with app title and month/year
  - [ ] Add summary section (total income, expenses, net balance)
  - [ ] Add category breakdown table using jspdf-autotable
  - [ ] Add top 5 transactions table
  - [ ] Apply professional styling (fonts, colors, spacing)
  - [ ] Format for A4 paper size
  - [ ] Generate filename: `budget-report-${month}.pdf`
  - [ ] Trigger browser download

- [ ] Create PDFReportData type (AC: 8.2.4-8.2.7)
  - [ ] Define `PDFReportData` interface in `src/types/export.types.ts`
  - [ ] Include: month, summary (income/expenses/net), categories, top transactions
  - [ ] Optional: chart_images field for future enhancement

- [ ] Add month selector and export button to Settings page (AC: 8.2.1, 8.2.2)
  - [ ] Add month selector dropdown (last 12 months)
  - [ ] Generate month options dynamically (current month - 11 months)
  - [ ] Add "Export Monthly Report (PDF)" button
  - [ ] Wire onClick handler to fetch data and call export function
  - [ ] Show loading state during generation
  - [ ] Display success toast on completion

- [ ] Fetch monthly data for PDF generation (AC: 8.2.5-8.2.7)
  - [ ] Call `GET /api/transactions?month=YYYY-MM` to get month transactions
  - [ ] Calculate summary totals (income, expenses, net balance)
  - [ ] Calculate category spending breakdown with percentages
  - [ ] Identify top 5 highest expense transactions
  - [ ] Assemble PDFReportData object

- [ ] Add performance optimizations (AC: 8.2.9)
  - [ ] Test PDF generation speed with various data sizes
  - [ ] Show progress indicator during generation
  - [ ] Optimize table rendering

- [ ] Write unit tests (AC: All)
  - [ ] Test PDF generation with sample monthly data
  - [ ] Test all sections present (header, summary, categories, transactions)
  - [ ] Test calculation accuracy (totals, percentages)
  - [ ] Test filename generation
  - [ ] Test edge case: month with no transactions

- [ ] Write integration tests (AC: All)
  - [ ] Test full flow: select month → fetch data → generate PDF → download
  - [ ] Test with various months (current, past, empty)
  - [ ] Test error handling (API failure, PDF generation failure)

## Dev Notes

- **Client-side generation:** Use jsPDF for privacy-first PDF generation (no server processing)
- **Professional styling:** Consistent fonts (default: Helvetica), proper spacing, aligned tables
- **Performance:** Target <5 seconds for PDF generation. Use jspdf-autotable for efficient table rendering
- **Data aggregation:** Calculate all summary statistics client-side from fetched transactions
- **A4 format:** Standard paper size (210x297mm) for print compatibility

### Project Structure Notes

**Modified Files:**
- `src/lib/services/exportService.ts` - Add `exportMonthlyReportToPDF()` function

**New Files:**
- `src/types/export.types.ts` - PDFReportData interface (if not created in Story 8.1)

**Updated Files:**
- `src/app/(dashboard)/settings/page.tsx` - Add month selector and PDF export button (to be created in Story 8.3)

**Alignment with Architecture:**
- Uses existing transaction API endpoints
- Follows client-side processing pattern for data privacy
- Uses Chakra UI Select and Button components
- Uses date-fns for month formatting and calculations

### References

- [Tech Spec: Epic 8 - Story 8.2 Acceptance Criteria](../tech-spec-epic-8.md#story-82-export-financial-report-to-pdf)
- [Tech Spec: PDF Export Implementation](../tech-spec-epic-8.md#apis-and-interfaces)
- [Tech Spec: User Flow 2 - PDF Export](../tech-spec-epic-8.md#user-flow-2-export-monthly-pdf-report-story-82)
- [PRD: FR40 - Export reports to PDF](../../PRD.md#functional-requirements)
- [Architecture: API Routes](../../architecture.md#api-routes)
- [Epics: Story 7.2 Technical Notes](../../epics.md#story-72-export-financial-report-to-pdf)

## Dev Agent Record

### Context Reference

- [Story 8.2 Context](8-2-export-financial-report-to-pdf.context.xml)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List
