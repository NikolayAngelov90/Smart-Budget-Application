### Story 3.2: Transaction List View with Filtering and Search

As a user,
I want to view my complete transaction history with filtering and search,
So that I can find specific transactions quickly.

**Acceptance Criteria:**

**Given** I navigate to the Transactions page
**When** I view, filter, and search my transactions
**Then** I can find exactly what I need efficiently

**And** Transactions page at `/transactions` route
**And** All transactions displayed in chronological order (newest first)
**And** Each transaction shows: date, category (with color), description/notes, amount
**And** Income transactions show in green (+$100.00)
**And** Expense transactions show in red (-$50.00)
**And** Filter controls above list: Date range picker, Category dropdown, Type (All/Income/Expense)
**And** Search box filters by notes, category name, or amount
**And** Search debounced (300ms delay) to avoid excessive API calls
**And** Filters update results in < 500ms for datasets up to 10,000 transactions
**And** "Clear filters" button resets all filters
**And** Empty state when no transactions: "No transactions yet. Add your first one!"
**And** Empty state when no search results: "No transactions found. Try different filters."
**And** Pagination or virtual scrolling for >100 transactions
**And** Loading skeleton shown while fetching data
**And** Each transaction card clickable to expand with full details
**And** Mobile: stack filters vertically, desktop: horizontal filter bar

**Prerequisites:** Story 3.1 (transactions can be created), Story 4.1 (categories exist)

**Technical Notes:**
- Create `/app/(dashboard)/transactions/page.tsx`
- Fetch transactions via `GET /api/transactions?startDate=...&endDate=...&category=...&type=...&search=...`
- Use SWR for data fetching with caching
- Server-side filtering in Supabase query for performance
- Client-side search debouncing with lodash.debounce or custom hook
- Use Chakra UI Card, Stack, Text for transaction cards
- Date range picker: Chakra UI or react-date-range
- Virtual scrolling: react-window or tanstack-virtual for large lists
- Loading state: Chakra UI Skeleton components matching card layout
- Color-coding: green for income (Success color), red for expense (Error color)
- Mobile responsive: full-width cards, simplified layout
