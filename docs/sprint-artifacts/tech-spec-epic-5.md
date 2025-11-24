# Epic Technical Specification: Financial Dashboard & Visualizations

Date: 2025-11-24
Author: Niki
Epic ID: 5
Status: Draft

---

## Overview

Epic 5 implements the visual intelligence dashboard that enables users to understand their spending patterns at a glance through interactive charts, financial metrics, and responsive design. This epic delivers on the core PRD promise of "visual spending insights" (FR18-FR28) by providing:

- Real-time financial summary cards (Total Balance, Monthly Income/Expenses with trend indicators)
- Interactive spending visualizations (pie/donut charts showing category distribution)
- Multi-month trend analysis (line charts tracking income vs expenses over 6 months)
- Month-over-month comparison highlights (automatic detection of significant spending changes)
- Drill-down capabilities allowing users to explore from overview to transaction-level detail
- Fully responsive layout adapting from mobile (320px) through desktop (2560px)

The dashboard is the default landing page after login, designed to deliver insights within 60 seconds of opening the app (weekly ritual), complementing the 30-second transaction entry flow. This epic integrates with Recharts for SVG-quality visualizations and leverages SWR for performant data caching with real-time updates via Supabase Realtime.

## Objectives and Scope

**In Scope:**
- Dashboard layout with responsive sidebar navigation (Story 5.1)
- Three financial summary StatCards with trend indicators (Story 5.2)
- Monthly spending by category visualization using Recharts pie/donut chart (Story 5.3)
- 6-month income vs expenses trend line chart (Story 5.4)
- Month-over-month category comparison highlights (Story 5.5)
- Chart interactivity: hover tooltips, click drill-down to filtered transactions (Story 5.6)
- Performance optimization: <2s load time, <300ms chart updates, skeleton loading states (Story 5.7)
- Mobile/tablet responsive breakpoints: 320px, 768px, 1024px (Story 5.8)
- Server-side data aggregation for all dashboard metrics
- Real-time updates when transactions added/modified

**Out of Scope (Deferred):**
- AI insights display (Epic 6: AI Budget Insights)
- Export functionality (Epic 7: Data Export)
- Multi-month date range selection (Phase 2 enhancement)
- Custom chart configurations (Phase 2)
- Offline chart rendering (requires service worker from Phase 2)
- Advanced filtering within dashboard (use Transactions page instead)

**Success Criteria:**
- Dashboard loads within 2 seconds on 3G connection (NFR-Performance)
- Chart updates complete within 300ms after data change
- All components functional on mobile (320px), tablet (768px), desktop (1024px+)
- Lighthouse performance score >90
- Zero accessibility violations (WCAG 2.1 Level A minimum)

## System Architecture Alignment

Epic 5 aligns with the Next.js App Router + Supabase + Chakra UI stack defined in the Technical Architecture document:

**Frontend Architecture:**
- Dashboard pages: `src/app/(dashboard)/page.tsx` (landing page after login)
- Layout component: `src/app/(dashboard)/layout.tsx` with sidebar navigation
- Custom components: `StatCard`, `SpendingByCategory`, `SpendingTrends`, `ChartContainer`
- Chakra UI components: Stat, Card, Flex, Grid, Drawer, Skeleton
- Recharts library: PieChart, LineChart, ResponsiveContainer, Tooltip, Legend

**Backend Architecture:**
- API routes for dashboard data aggregation:
  - `GET /api/dashboard/stats` - Financial summary (balance, income, expenses with trends)
  - `GET /api/dashboard/spending-by-category` - Category breakdown for pie chart
  - `GET /api/dashboard/trends` - 6-month income/expense aggregation for line chart
  - `GET /api/dashboard/month-over-month` - Category comparison highlights
- Server-side SQL aggregation queries in Supabase for performance
- SWR for client-side caching and automatic revalidation
- Supabase Realtime subscriptions for live updates

**Database Dependencies:**
- Existing tables: `transactions`, `categories` (from Epic 3 & 4)
- Existing indexes: `idx_transactions_date`, `idx_transactions_category` (already optimized)
- Row Level Security policies: Enforced at database level (users see only their data)

**Integration Points:**
- CategoryBadge component (Epic 4): Reused for category color-coding in charts
- Transaction list filtering (Epic 3): Target for chart drill-down navigation
- Date utilities (`date-fns`): Month formatting, date calculations

**Performance Strategy:**
- Server-side rendering (SSR) for initial dashboard data
- Database-level aggregation (avoid N+1 queries)
- SWR caching with 5-second deduplication interval
- Skeleton loaders prevent layout shift during data fetch
- Recharts ResponsiveContainer for efficient chart rendering
- Lazy loading for chart components (dynamic imports)

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| **Dashboard Page** (`src/app/(dashboard)/page.tsx`) | Server-rendered landing page, fetches initial dashboard data | User session (auth) | HTML with initial data, hydrates to interactive React | Frontend |
| **Dashboard Layout** (`src/app/(dashboard)/layout.tsx`) | Provides sidebar navigation, responsive wrapper for all dashboard pages | Children components, user session | Consistent layout with nav sidebar | Frontend |
| **StatCard Component** (`src/components/dashboard/StatCard.tsx`) | Displays financial metric with trend indicator | `{ label, value, trend, trendLabel, colorScheme }` | Styled stat card with arrow indicator | Frontend |
| **DashboardStats Component** (`src/components/dashboard/DashboardStats.tsx`) | Aggregates and displays 3 StatCards (Balance, Income, Expenses) | Stats data from API | Grid of 3 StatCards | Frontend |
| **SpendingByCategory Component** (`src/components/dashboard/SpendingByCategory.tsx`) | Renders Recharts pie/donut chart for category breakdown | Category spending data from API | Interactive pie chart with legend | Frontend |
| **SpendingTrends Component** (`src/components/dashboard/SpendingTrends.tsx`) | Renders Recharts line chart for income/expense trends | 6-month trend data from API | Interactive line chart with tooltips | Frontend |
| **ChartContainer Component** (`src/components/dashboard/ChartContainer.tsx`) | Wrapper providing loading states, error handling, responsive sizing for charts | Chart component, loading state, error | Chart with skeleton/error states | Frontend |
| **Sidebar Component** (`src/components/layout/Sidebar.tsx`) | Navigation menu with route links, responsive collapse | Current route, nav items | Sidebar nav with active state | Frontend |
| **MobileNav Component** (`src/components/layout/MobileNav.tsx`) | Hamburger menu drawer for mobile devices | Nav items, isOpen state | Chakra UI Drawer with nav | Frontend |
| **Dashboard Stats API** (`src/app/api/dashboard/stats/route.ts`) | Aggregates current and previous month totals for income/expenses | Query param: `month` (optional, defaults to current) | `{ balance, income, expenses, trends }` | Backend |
| **Spending by Category API** (`src/app/api/dashboard/spending-by-category/route.ts`) | Aggregates expenses by category for pie chart | Query param: `month` | `{ categories: [{ name, color, total, percentage }] }` | Backend |
| **Trends API** (`src/app/api/dashboard/trends/route.ts`) | Aggregates monthly income/expenses for last 6 months | Query param: `months` (default 6) | `{ months: [{ month, income, expenses }] }` | Backend |
| **Month-over-Month API** (`src/app/api/dashboard/month-over-month/route.ts`) | Compares current vs previous month spending by category | Query param: `month` | `{ changes: [{ category, current, previous, percentChange }] }` | Backend |
| **useTransactions Hook** (`src/lib/hooks/useTransactions.ts`) | SWR hook for fetching transactions with caching | Filters (optional) | `{ data, error, isLoading, mutate }` | Frontend |
| **useDashboardStats Hook** (`src/lib/hooks/useDashboardStats.ts`) | SWR hook for dashboard stats with auto-revalidation | Month (optional) | `{ data, error, isLoading, mutate }` | Frontend |

**Module Interactions:**
1. Dashboard Page (`page.tsx`) → Server fetches initial stats → Passes to DashboardStats component
2. DashboardStats → Calls `useDashboardStats` hook → Fetches from `/api/dashboard/stats` → Renders 3 StatCards
3. SpendingByCategory → Calls SWR hook → Fetches from `/api/dashboard/spending-by-category` → Renders Recharts PieChart
4. SpendingTrends → Calls SWR hook → Fetches from `/api/dashboard/trends` → Renders Recharts LineChart
5. All charts wrapped in ChartContainer → Provides loading skeletons and error boundaries

### Data Models and Contracts

**Dashboard Stats Response:**
```typescript
interface DashboardStatsResponse {
  balance: number;                    // Current month income - expenses
  income: {
    current: number;                  // Sum of income transactions this month
    previous: number;                 // Sum of income transactions last month
    trend: number;                    // Percentage change: ((current - previous) / previous) * 100
  };
  expenses: {
    current: number;                  // Sum of expense transactions this month
    previous: number;                 // Sum of expense transactions last month
    trend: number;                    // Percentage change
  };
  month: string;                      // YYYY-MM format
}
```

**Category Spending Response:**
```typescript
interface CategorySpendingData {
  name: string;                       // Category name
  color: string;                      // Hex color from categories table
  total: number;                      // Sum of transactions for this category
  percentage: number;                 // (total / sum of all totals) * 100
  transactionCount: number;           // Number of transactions in this category
}

interface CategorySpendingResponse {
  categories: CategorySpendingData[];
  month: string;                      // YYYY-MM format
  totalSpending: number;              // Sum of all expenses
}
```

**Spending Trends Response:**
```typescript
interface MonthlyTrendData {
  month: string;                      // YYYY-MM format
  monthLabel: string;                 // "Jan", "Feb", "Mar" for chart display
  income: number;                     // Total income for this month
  expenses: number;                   // Total expenses for this month
  net: number;                        // income - expenses
}

interface SpendingTrendsResponse {
  months: MonthlyTrendData[];         // Last N months (default 6)
  startDate: string;                  // ISO date of first month
  endDate: string;                    // ISO date of last month
}
```

**Month-over-Month Response:**
```typescript
interface CategoryChangeData {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  currentAmount: number;              // Spending this month
  previousAmount: number;             // Spending last month
  percentChange: number;              // ((current - previous) / previous) * 100
  absoluteChange: number;             // current - previous
  direction: 'increase' | 'decrease'; // For rendering up/down arrows
}

interface MonthOverMonthResponse {
  changes: CategoryChangeData[];      // Filtered to significant changes (>20%)
  currentMonth: string;               // YYYY-MM
  previousMonth: string;              // YYYY-MM
}
```

**Chart Data Formats (for Recharts):**

**Pie Chart Data:**
```typescript
interface PieChartDataPoint {
  name: string;                       // Category name
  value: number;                      // Spending amount
  fill: string;                       // Category color (hex)
  percentage: number;                 // For tooltip display
}
```

**Line Chart Data:**
```typescript
interface LineChartDataPoint {
  month: string;                      // "Jan", "Feb", etc.
  income: number;                     // Income amount
  expenses: number;                   // Expenses amount
}
```

**StatCard Props:**
```typescript
interface StatCardProps {
  label: string;                      // "Total Balance", "Monthly Income", "Monthly Expenses"
  value: number;                      // Dollar amount
  trend?: number;                     // Percentage change (can be negative)
  trendLabel?: string;                // "vs last month"
  colorScheme: 'green' | 'red' | 'blue'; // Visual treatment
  icon?: React.ReactNode;             // Optional icon
  isLoading?: boolean;                // Show skeleton
}
```

### APIs and Interfaces

**GET /api/dashboard/stats**

*Purpose:* Aggregate financial summary for current and previous month

*Request:*
```http
GET /api/dashboard/stats?month=2025-11
Authorization: Bearer <jwt-token>
```

*Query Parameters:*
- `month` (optional): YYYY-MM format, defaults to current month

*Response (200):*
```json
{
  "balance": 1500.00,
  "income": {
    "current": 5000.00,
    "previous": 4800.00,
    "trend": 4.17
  },
  "expenses": {
    "current": 3500.00,
    "previous": 3200.00,
    "trend": 9.38
  },
  "month": "2025-11"
}
```

*Errors:*
- 401: Unauthorized (no valid session)
- 500: Database query failure

*Implementation:*
```sql
-- Current month aggregation
SELECT
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
FROM transactions
WHERE user_id = $1
  AND date >= $2  -- Start of current month
  AND date < $3   -- Start of next month

-- Previous month aggregation (same query with different date range)
```

---

**GET /api/dashboard/spending-by-category**

*Purpose:* Aggregate expenses by category for pie chart visualization

*Request:*
```http
GET /api/dashboard/spending-by-category?month=2025-11
Authorization: Bearer <jwt-token>
```

*Query Parameters:*
- `month` (optional): YYYY-MM format, defaults to current month

*Response (200):*
```json
{
  "categories": [
    {
      "name": "Dining",
      "color": "#f56565",
      "total": 480.00,
      "percentage": 13.71,
      "transactionCount": 12
    },
    {
      "name": "Transport",
      "color": "#4299e1",
      "total": 350.00,
      "percentage": 10.0,
      "transactionCount": 8
    }
  ],
  "month": "2025-11",
  "totalSpending": 3500.00
}
```

*Implementation:*
```sql
SELECT
  c.id,
  c.name,
  c.color,
  SUM(t.amount) as total,
  COUNT(t.id) as transaction_count
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE t.user_id = $1
  AND t.type = 'expense'
  AND t.date >= $2  -- Start of month
  AND t.date < $3   -- End of month
GROUP BY c.id, c.name, c.color
ORDER BY total DESC
```

---

**GET /api/dashboard/trends**

*Purpose:* Aggregate monthly income and expenses for line chart (last 6 months)

*Request:*
```http
GET /api/dashboard/trends?months=6
Authorization: Bearer <jwt-token>
```

*Query Parameters:*
- `months` (optional): Number of months to fetch (default 6, max 12)

*Response (200):*
```json
{
  "months": [
    {
      "month": "2025-06",
      "monthLabel": "Jun",
      "income": 4500.00,
      "expenses": 3200.00,
      "net": 1300.00
    },
    {
      "month": "2025-07",
      "monthLabel": "Jul",
      "income": 4800.00,
      "expenses": 3400.00,
      "net": 1400.00
    }
  ],
  "startDate": "2025-06-01",
  "endDate": "2025-11-30"
}
```

*Implementation:*
```sql
SELECT
  DATE_TRUNC('month', date) as month,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
FROM transactions
WHERE user_id = $1
  AND date >= $2  -- N months ago
  AND date < $3   -- End of current month
GROUP BY DATE_TRUNC('month', date)
ORDER BY month ASC
```

---

**GET /api/dashboard/month-over-month**

*Purpose:* Compare current vs previous month spending by category, return significant changes (>20%)

*Request:*
```http
GET /api/dashboard/month-over-month?month=2025-11
Authorization: Bearer <jwt-token>
```

*Response (200):*
```json
{
  "changes": [
    {
      "categoryId": "uuid-123",
      "categoryName": "Dining",
      "categoryColor": "#f56565",
      "currentAmount": 480.00,
      "previousAmount": 340.00,
      "percentChange": 41.18,
      "absoluteChange": 140.00,
      "direction": "increase"
    },
    {
      "categoryId": "uuid-456",
      "categoryName": "Utilities",
      "categoryColor": "#48bb78",
      "currentAmount": 150.00,
      "previousAmount": 220.00,
      "percentChange": -31.82,
      "absoluteChange": -70.00,
      "direction": "decrease"
    }
  ],
  "currentMonth": "2025-11",
  "previousMonth": "2025-10"
}
```

*Implementation:*
```sql
WITH current_month AS (
  SELECT category_id, SUM(amount) as total
  FROM transactions
  WHERE user_id = $1 AND type = 'expense'
    AND date >= $2 AND date < $3
  GROUP BY category_id
),
previous_month AS (
  SELECT category_id, SUM(amount) as total
  FROM transactions
  WHERE user_id = $1 AND type = 'expense'
    AND date >= $4 AND date < $5
  GROUP BY category_id
)
SELECT
  c.id, c.name, c.color,
  COALESCE(curr.total, 0) as current_amount,
  COALESCE(prev.total, 0) as previous_amount,
  CASE
    WHEN prev.total > 0 THEN ((curr.total - prev.total) / prev.total * 100)
    ELSE 0
  END as percent_change
FROM categories c
LEFT JOIN current_month curr ON c.id = curr.category_id
LEFT JOIN previous_month prev ON c.id = prev.category_id
WHERE ABS(percent_change) > 20
ORDER BY ABS(percent_change) DESC
LIMIT 5
```

### Workflows and Sequencing

**Dashboard Load Sequence:**

```
1. User navigates to / or /dashboard
2. Next.js App Router invokes page.tsx Server Component
3. Server Component:
   a. Validates user session via Supabase Auth
   b. Fetches initial dashboard stats from database (SSR)
   c. Renders HTML with initial data
4. HTML sent to client, React hydrates
5. Client-side components mount:
   a. DashboardStats component displays server-rendered data
   b. SpendingByCategory component starts SWR fetch for category data
   c. SpendingTrends component starts SWR fetch for trends data
6. SWR makes API calls to:
   - GET /api/dashboard/spending-by-category
   - GET /api/dashboard/trends
   - GET /api/dashboard/month-over-month
7. API routes execute SQL aggregation queries in Supabase
8. Data returned to components, charts render with Recharts
9. SWR caches responses for 5 seconds (deduplication interval)
10. Supabase Realtime subscription established for transactions table

Time Budget:
- SSR + HTML delivery: <1 second
- Client hydration: <300ms
- API calls + chart rendering: <700ms
- Total perceived load time: <2 seconds
```

**Transaction Added → Dashboard Update Sequence:**

```
1. User adds transaction via TransactionEntryModal (Epic 3)
2. POST /api/transactions succeeds
3. SWR mutate() called for transactions cache
4. Supabase Realtime broadcasts change to all connected clients
5. Dashboard page receives realtime event
6. SWR automatically revalidates dashboard data:
   - /api/dashboard/stats
   - /api/dashboard/spending-by-category
   - /api/dashboard/trends
7. Components re-render with updated data
8. Charts animate to new values (Recharts transition)

Time Budget: <300ms from transaction save to chart update
```

**Chart Drill-Down Sequence:**

```
1. User clicks pie chart slice (e.g., "Dining" category)
2. onClick handler captures category_id
3. Next.js router.push('/transactions?category=[id]&month=[month]')
4. Transaction List page loads with pre-applied filters
5. Filtered transactions displayed
6. "Back to Dashboard" link available for navigation

Alternative: Line chart click
1. User clicks line chart data point (specific month)
2. onClick handler captures month
3. router.push('/transactions?month=[YYYY-MM]')
4. Transactions filtered to that month
```

**Responsive Layout Adaptation:**

```
Mobile (<768px):
1. Sidebar hidden by default
2. Hamburger icon in header
3. Tap hamburger → Chakra UI Drawer slides in from left
4. Dashboard: Single column layout
   - StatCards stacked vertically
   - Charts full width, stacked
5. Charts use ResponsiveContainer (Recharts adapts to container width)

Tablet (768-1023px):
1. Sidebar collapses to icon-only mode (60px width)
2. Hover over icon shows tooltip with label
3. Dashboard: 2-column grid for StatCards
4. Charts side-by-side or stacked based on available space

Desktop (≥1024px):
1. Full sidebar (250px width) always visible
2. Dashboard: 3-column grid for StatCards
3. Charts displayed side-by-side in 2-column grid
4. Max-width 1200px container centered on ultra-wide displays
```

## Non-Functional Requirements

### Performance

**Load Time Targets (from PRD NFR):**
- Dashboard initial page load: **<2 seconds** on 3G connection (measured from navigation to interactive)
- Dashboard rendering after HTML delivery: **<1 second**
- Chart component time-to-interactive: **<300ms** after data fetch completes
- Real-time chart updates: **<300ms** from transaction save to chart re-render

**Response Time Targets:**
- API aggregation queries: **<500ms** for datasets up to 10,000 transactions per user
- Server-side rendering (SSR): **<800ms** to generate initial HTML
- SWR cache hit: **0ms** (instant from memory)
- Supabase Realtime event propagation: **<200ms**

**Bundle Size Optimization:**
- Recharts library: ~80KB gzipped (acceptable for visual-first dashboard)
- Dashboard page bundle: <150KB gzipped (includes components + Recharts)
- Lazy-load chart components: Use Next.js dynamic imports for non-critical charts
  ```typescript
  const SpendingTrends = dynamic(() => import('@/components/dashboard/SpendingTrends'), {
    loading: () => <Skeleton height="300px" />,
    ssr: false // Client-side only for charts
  });
  ```

**Database Query Optimization:**
- Use existing indexes: `idx_transactions_date`, `idx_transactions_category` (no new indexes needed)
- Server-side aggregation: All SUM/COUNT operations in SQL, not JavaScript
- Limit query scope: Default to current month + previous month only (max 2 months data per query)
- Connection pooling: Supabase handles automatically

**Caching Strategy:**
- SWR deduplication interval: 5 seconds (multiple components can share same request)
- Browser cache: No aggressive caching (financial data should be fresh)
- Realtime invalidation: SWR revalidates on transactions table change

**Lighthouse Performance Score: Target >90**
- Measured on: Dashboard page load
- Metrics: FCP <1.8s, LCP <2.5s, CLS <0.1, TTI <3.8s

### Security

**Authentication & Authorization:**
- All dashboard API endpoints require valid Supabase Auth JWT token
- Row Level Security (RLS) enforced at database level ensures user can only access their own data:
  ```sql
  CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);
  ```
- No user_id parameter in API requests (extracted from auth token server-side)

**Data Privacy:**
- Financial data never logged to console or error tracking in production
- API responses contain only authenticated user's data (RLS enforced)
- No third-party analytics scripts with access to dashboard data
- Charts rendered client-side (SVG), no external image services

**Input Validation:**
- Month query parameter: Validated against YYYY-MM regex pattern
- Months count: Clamped to 1-12 range (prevent excessive data requests)
- All SQL queries use parameterized statements (Supabase client handles escaping)

**XSS Prevention:**
- React automatically escapes all rendered content
- Category names/colors sanitized at creation time (Epic 4)
- No `dangerouslySetInnerHTML` usage in dashboard components

**CSRF Protection:**
- API routes use Supabase Auth JWT tokens (not cookies for CSRF)
- Next.js API routes automatically handle CORS

### Reliability/Availability

**Graceful Degradation:**
- If API call fails, display previous cached data with stale indicator
- If Recharts fails to render, fallback to data table (accessible alternative)
- If SSR fails, client-side rendering takes over (slower but functional)

**Error Handling:**
- API errors caught and displayed with user-friendly messages:
  - 401: "Please log in to view dashboard"
  - 500: "Unable to load dashboard data. Retry"
- Retry button available for failed requests
- Error boundaries wrap chart components to prevent full page crash

**Data Consistency:**
- Realtime updates ensure multi-tab consistency (change in one tab updates others)
- Optimistic updates: Charts show new data immediately, revert on error
- No local storage for dashboard data (always fetch from authoritative source)

**Offline Behavior:**
- Dashboard requires internet connection (deferred to Phase 2 for offline support)
- Service worker caching not implemented in MVP
- Clear "Offline" indicator if network lost

**Browser Compatibility:**
- Tested on: Chrome 120+, Firefox 120+, Safari 17+, Edge 120+
- Recharts uses SVG (supported by all modern browsers)
- Chakra UI components degrade gracefully on older browsers

### Observability

**Logging Strategy:**
- Server-side API logs (Vercel/Next.js logs):
  ```typescript
  console.error('[Dashboard API] Failed to aggregate stats:', error);
  ```
- Client-side errors logged to console (development only)
- Production: Integrate Sentry or similar (optional Phase 2)

**Performance Monitoring:**
- Vercel Analytics: Tracks Core Web Vitals automatically
- Custom metrics (optional):
  ```typescript
  performance.mark('dashboard-data-loaded');
  performance.measure('dashboard-load', 'navigationStart', 'dashboard-data-loaded');
  ```

**Database Monitoring:**
- Supabase Dashboard provides query performance metrics
- Slow query alerts (>1s execution time)
- Connection pool monitoring

**Realtime Monitoring:**
- Supabase Realtime connection status indicator (optional)
- Reconnection logic: SWR automatically retries on network restore

**User-Facing Indicators:**
- Loading skeletons: User sees something is happening
- Error states: Clear indication when something fails
- Stale data indicator: "Last updated 5 minutes ago"

## Dependencies and Integrations

**External Dependencies:**

| Dependency | Version | Purpose | Risk Level | Mitigation |
|------------|---------|---------|------------|------------|
| Recharts | 2.12+ | Chart rendering (PieChart, LineChart) | Low | Mature library, widely used, MIT license |
| SWR | 2.3+ | Data fetching, caching, revalidation | Low | Vercel-maintained, core Next.js integration |
| date-fns | 3.0+ | Month formatting, date calculations | Low | Lightweight, tree-shakeable, no dependencies |
| Chakra UI | 2.8+ | Layout, grid, drawer, skeleton components | Low | Already used throughout app (Epic 1-4) |
| @supabase/supabase-js | 2.81+ | Database queries, Realtime subscriptions | Low | Core dependency, used in all epics |

**Internal Component Dependencies (from Previous Epics):**

| Component | Source Epic | Integration Point | Status |
|-----------|-------------|-------------------|--------|
| CategoryBadge | Epic 4.4 | Category color display in charts | ✅ Implemented |
| Transaction List Filtering | Epic 3.2 | Drill-down target for chart clicks | ✅ Implemented |
| AppLayout | Epic 1.1 | Base layout wrapper for dashboard | ✅ Implemented |
| Supabase Auth | Epic 2 | User authentication for API routes | ✅ Implemented |
| Transactions Table | Epic 3 | Source data for all aggregations | ✅ Implemented |
| Categories Table | Epic 4 | Category metadata (names, colors) | ✅ Implemented |

**Database Schema Dependencies:**

```sql
-- Required tables (already exist from Epic 3 & 4)
transactions (
  id, user_id, category_id, amount, type, date, created_at
)

categories (
  id, user_id, name, color, type, is_predefined
)

-- Required indexes (already exist)
idx_transactions_user_id ON transactions(user_id)
idx_transactions_date ON transactions(user_id, date DESC)
idx_transactions_category ON transactions(user_id, category_id)
idx_categories_user_id ON categories(user_id)
```

**Integration with External Systems:**
- None (all dashboard functionality is self-contained within the application)

**API Route Dependencies:**
- Dashboard API routes (`/api/dashboard/*`) depend on existing transactions and categories endpoints for data consistency
- No breaking changes to existing APIs required

**Deployment Dependencies:**
- Vercel deployment (already configured)
- Supabase project (already configured)
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Acceptance Criteria (Authoritative)

This section provides the authoritative, comprehensive acceptance criteria for Epic 5, extracted from all 8 stories in epics.md. Each criterion must be validated before marking the epic as complete.

### Story 5.1: Dashboard Layout and Navigation

**Core Requirements:**
- [ ] Dashboard is default landing page after login (`/` or `/dashboard` route)
- [ ] Sidebar navigation on left (250px width on desktop)
- [ ] Sidebar shows navigation items: Dashboard, Transactions, Categories, Insights, Settings
- [ ] Active nav item highlighted with Trust Blue color + left border (4px)
- [ ] Header shows app logo, user avatar/name, logout button

**Responsive Behavior:**
- [ ] Mobile (<768px): Sidebar hidden, hamburger menu icon in header opens drawer
- [ ] Tablet (768-1023px): Sidebar collapsible to icon-only mode
- [ ] Desktop (≥1024px): Full sidebar, multi-column dashboard grid

**Accessibility:**
- [ ] All navigation keyboard accessible (Tab, Enter to activate)
- [ ] Screen reader announces current page ("Dashboard page")

### Story 5.2: Financial Summary Cards (StatCards)

**StatCard Display:**
- [ ] Three StatCards displayed: Total Balance, Monthly Income, Monthly Expenses
- [ ] Horizontal layout on desktop, vertical stack on mobile

**StatCard #1: Total Balance**
- [ ] Shows current month income - expenses
- [ ] Large number (2.5-3rem font), bold
- [ ] Trend indicator: up/down arrow + percentage vs last month
- [ ] Green if positive balance, red if negative

**StatCard #2: Monthly Income**
- [ ] Sum of income transactions this month
- [ ] Number with + prefix (e.g., +$5,000.00)
- [ ] Green color (success theme)
- [ ] Trend vs last month

**StatCard #3: Monthly Expenses**
- [ ] Sum of expense transactions this month
- [ ] Number with - prefix (e.g., -$3,500.00)
- [ ] Red color (error theme)
- [ ] Trend vs last month

**Formatting & Performance:**
- [ ] All amounts formatted with $ and 2 decimals
- [ ] Trend calculations: `((currentMonth - lastMonth) / lastMonth) * 100`
- [ ] Empty state: "$0.00" if no transactions
- [ ] Cards load within 1 second
- [ ] Cards update immediately when transactions added/edited (real-time via SWR)

### Story 5.3: Monthly Spending by Category (Pie/Donut Chart)

**Chart Display:**
- [ ] Displays current month's expenses grouped by category
- [ ] Each category slice colored with assigned category color
- [ ] Chart shows percentage of total spending per category
- [ ] Chart responsive: adapts to container width (250-400px height)

**Interactivity:**
- [ ] Hovering over slice shows tooltip: "[Category]: $X (Y%)"
- [ ] Legend below chart showing all categories with colors
- [ ] Clicking legend item toggles category visibility in chart

**States & Updates:**
- [ ] Empty state if no expenses: "No expenses yet this month"
- [ ] Chart updates in real-time when transactions added (<300ms)
- [ ] Mobile: chart scales to fit screen, legend below

**Accessibility:**
- [ ] Accessible data table alternative (hidden by default, screen reader accessible)

### Story 5.4: Spending Trends Over Time (Line Chart)

**Chart Display:**
- [ ] X-axis shows months (e.g., "Jun", "Jul", "Aug", "Sep", "Oct", "Nov")
- [ ] Y-axis shows dollar amounts
- [ ] Two lines plotted: Income (green) and Expenses (red)
- [ ] Chart renders responsively (300px height, full width)
- [ ] Grid lines for readability
- [ ] Legend indicates Income vs Expenses

**Interactivity:**
- [ ] Data points show exact amounts on hover
- [ ] Tooltip shows: "[Month]: Income $X, Expenses $Y"

**States & Updates:**
- [ ] Empty state: "Add transactions to see trends"
- [ ] Chart updates when transactions added (<300ms)
- [ ] Mobile: chart scrolls horizontally if needed, or shows last 3 months by default

**Accessibility:**
- [ ] Accessible data table alternative for screen readers

### Story 5.5: Month-over-Month Comparison Highlights

**Display Requirements:**
- [ ] Section titled "This Month vs Last Month"
- [ ] Shows categories with >20% increase in spending (red/warning)
- [ ] Shows categories with >20% decrease in spending (green/success)
- [ ] Format: "[Category]: ↑ 40% ($480 vs $340)"
- [ ] Up to 5 most significant changes shown

**States & Interactivity:**
- [ ] Empty state: "No significant changes this month"
- [ ] Updates immediately when transactions added
- [ ] Click on category drills down to category filter
- [ ] Mobile: list format, desktop: grid or list

### Story 5.6: Chart Interactivity and Drill-Down

**Pie Chart Interactivity:**
- [ ] Clicking slice navigates to `/transactions?category=[id]&month=[month]`
- [ ] Cursor changes to pointer on clickable chart elements

**Line Chart Interactivity:**
- [ ] Clicking data point navigates to `/transactions?month=[month]`

**General Interactivity:**
- [ ] Hovering shows detailed tooltip with exact values
- [ ] Tooltips appear within 100ms of hover
- [ ] Drill-down loads filtered transaction list pre-filtered to category/month
- [ ] "Back to Dashboard" link on transaction page to return

**Mobile & Accessibility:**
- [ ] Mobile: tap instead of hover, tooltip appears on tap
- [ ] Keyboard accessible: Tab to focus chart, Enter to drill down
- [ ] Screen reader: announces chart data and drill-down options

### Story 5.7: Dashboard Performance and Loading States

**Loading States:**
- [ ] Dashboard loads within 2 seconds (NFR FR25)
- [ ] Skeleton loaders shown for StatCards (3 rectangles)
- [ ] Skeleton loaders shown for charts (chart-shaped placeholders)
- [ ] Skeletons match final component dimensions

**Performance:**
- [ ] Data fetched server-side where possible (SSR for initial load)
- [ ] SWR caches data client-side for instant subsequent loads
- [ ] Real-time updates via Supabase Realtime subscriptions
- [ ] Chart updates complete within 300ms (NFR)
- [ ] Optimistic updates: new transactions appear immediately

**Error Handling:**
- [ ] Error state if data fetch fails: "Unable to load dashboard. Retry"
- [ ] Retry button refetches data

### Story 5.8: Responsive Dashboard for Mobile and Tablet

**Mobile (<768px):**
- [ ] Single column layout
- [ ] StatCards stacked vertically
- [ ] Charts full width, stacked vertically
- [ ] Bottom navigation or collapsible sidebar
- [ ] Touch targets 44x44px minimum

**Tablet (768-1023px):**
- [ ] Two-column grid for StatCards
- [ ] Charts side-by-side or stacked depending on space
- [ ] Collapsible sidebar (icon-only)

**Desktop (≥1024px):**
- [ ] Full sidebar (250px)
- [ ] Three-column StatCard grid
- [ ] Charts side-by-side
- [ ] Max-width 1200px container

**General Responsive:**
- [ ] All breakpoints tested and functional
- [ ] Touch interactions work on mobile (swipe, tap)
- [ ] Fonts scale appropriately (H1: 2.5rem desktop, 2rem mobile)
- [ ] Charts render correctly at all sizes
- [ ] No horizontal scrolling on mobile

## Traceability Mapping

**PRD Functional Requirements → Epic 5 Stories:**

| PRD FR | Requirement | Epic 5 Story | Implementation |
|--------|-------------|--------------|----------------|
| FR18 | Display current month income, expenses, balance | 5.2 | StatCards component with aggregated data |
| FR19 | Show income/expense trends (6 months) | 5.4 | Recharts LineChart with monthly aggregations |
| FR20 | Spending breakdown by category (pie/donut) | 5.3 | Recharts PieChart with category colors |
| FR21 | Month-over-month spending comparison | 5.5 | Category change highlights with >20% threshold |
| FR22 | Visual charts use category colors | 5.3 | CategoryBadge integration for color consistency |
| FR23 | Trend indicators (up/down arrows) | 5.2 | StatArrow component in StatCards |
| FR24 | Interactive charts (drill-down to transactions) | 5.6 | onClick handlers → router.push with filters |
| FR25 | Dashboard loads <2s on 3G | 5.7 | SSR + SWR caching + skeleton loaders |
| FR26 | Chart updates <300ms after transaction | 5.7 | Realtime subscriptions + SWR revalidation |
| FR27 | Mobile-responsive dashboard | 5.8 | Chakra UI responsive utilities + breakpoints |
| FR28 | Charts accessible (screen reader) | 5.3, 5.4 | Data table alternatives for charts |

**PRD Non-Functional Requirements → Epic 5 Stories:**

| PRD NFR | Requirement | Epic 5 Story | Implementation |
|---------|-------------|--------------|----------------|
| NFR-Performance | <2s load time | 5.7 | SSR, database aggregation, SWR caching |
| NFR-Performance | <300ms chart updates | 5.7 | Optimistic UI, Recharts animations |
| NFR-Accessibility | WCAG 2.1 Level A | All stories | Chakra UI components, data table fallbacks |
| NFR-Responsive | Mobile, tablet, desktop | 5.8 | Responsive breakpoints, touch targets |

**Architecture Alignment:**

| Architecture Decision | Epic 5 Implementation |
|-----------------------|----------------------|
| ADR-006: Chart Library (Recharts) | Stories 5.3, 5.4 use Recharts PieChart & LineChart |
| ADR-007: State Management (SWR) | All stories use SWR for data fetching and caching |
| Decision #2: UI Framework (Chakra UI) | Layout, Grid, Stat, Skeleton components throughout |
| Decision #5: State Management (React Context + SWR) | Dashboard uses SWR for server state |
| Project Structure: `/app/(dashboard)/` | Dashboard page and layout follow App Router conventions |
| Custom Component #2: StatCard | Story 5.2 implements StatCard with trend indicators |
| Custom Component #5: ChartContainer | Stories 5.3, 5.4 wrap charts in ChartContainer |

**UX Design Spec Alignment:**

| UX Spec Section | Epic 5 Implementation |
|-----------------|----------------------|
| Color System: Trust Blue (#2b6cb0) | Primary color for active nav items, chart accents |
| Semantic Colors: Success (#38a169), Error (#e53e3e) | Income (green), Expenses (red) in charts and StatCards |
| Category Color System | Reused from Epic 4, applied to pie chart slices |
| Spacing System: Base 4px | Consistent spacing in dashboard grid, card padding |
| Responsive Breakpoints: 768px, 1024px | Stories 5.1, 5.8 implement responsive layout |
| Typography: H1 2.5rem, H2 1.75rem | StatCard values and section headers |

## Risks, Assumptions, Open Questions

**Risks:**

| Risk | Severity | Probability | Mitigation Strategy |
|------|----------|-------------|---------------------|
| **Recharts Bundle Size Impact** | Medium | Low | Use dynamic imports for lazy loading, measure with Lighthouse |
| **Slow Aggregation Queries** | High | Medium | Server-side SQL aggregation, existing indexes, limit to 2 months max |
| **Chart Rendering Performance on Low-End Devices** | Medium | Medium | Limit data points (max 12 months for trends), use Recharts optimizations |
| **Realtime Subscription Overhead** | Low | Low | SWR handles revalidation efficiently, minimal overhead for dashboard |
| **Responsive Layout Complexity** | Low | Low | Chakra UI handles responsive utilities, well-tested patterns |
| **User Confusion with Empty States** | Medium | High | Clear empty state messaging with CTAs to add transactions |
| **Chart Accessibility for Screen Readers** | Medium | Low | Implement data table fallbacks, ARIA labels on chart elements |

**Assumptions:**

1. **Users have transaction data**: Dashboard assumes users have already added transactions (Epic 3). Empty states handle new users gracefully.
2. **Current month is sufficient**: MVP focuses on current month + previous month comparison. Multi-month selection deferred to Phase 2.
3. **Category colors are distinct**: Epic 4 implemented category colors with sufficient contrast for pie chart readability.
4. **Users understand financial terms**: "Balance", "Income", "Expenses" assumed to be clear without tooltips. Add help text if user feedback indicates confusion.
5. **3G connection baseline**: Performance targets assume 3G as minimum viable connection. 2G users may experience slower loads.
6. **Desktop-first usage**: While responsive, dashboard optimized for desktop/tablet weekly review ritual. Mobile supports quick checks.
7. **Supabase Realtime is reliable**: Assumes <1% downtime for Realtime subscriptions. Fallback to polling if Realtime fails (SWR handles automatically).
8. **Date-fns lightweight**: Assumes date-fns tree-shaking works correctly to minimize bundle size.

**Open Questions:**

1. **Chart Type Preference**: Should pie chart be donut chart for better label visibility? **Answer:** Test both in Story 5.3, choose based on visual clarity with legend.
2. **Month Selector**: Should users be able to select different months in MVP? **Decision:** Deferred to Phase 2. MVP shows current month only.
3. **Chart Animation Duration**: How long should Recharts transition animations be? **Recommendation:** 300ms to match <300ms update target.
4. **Drill-Down Behavior**: Should chart drill-down open in new tab or same tab? **Decision:** Same tab (better mobile UX), browser back button to return.
5. **Empty State CTAs**: Should empty states have "Add Transaction" button or just text? **Decision:** Include CTA button to improve conversion.
6. **Sidebar Persistence**: Should sidebar collapse state persist across sessions? **Decision:** Use localStorage to remember user preference (Story 5.1).
7. **Chart Tooltip Formatting**: Should tooltips show percentage AND dollar amount? **Answer:** Yes, both for clarity (e.g., "Dining: $480 (13.7%)").
8. **Multi-Tab Sync**: Should dashboard updates sync across multiple tabs? **Decision:** Yes via Supabase Realtime broadcasts (Story 5.7).

**Resolution Tracking:**

- **Q1 (Pie vs Donut)**: To be resolved during Story 5.3 implementation
- **Q2 (Month Selector)**: Resolved - Deferred to Phase 2
- **Q3 (Animation Duration)**: Resolved - 300ms standard
- **Q4 (Drill-Down Navigation)**: Resolved - Same tab with back button
- **Q5 (Empty State CTAs)**: Resolved - Include CTA buttons
- **Q6 (Sidebar Persistence)**: Resolved - Use localStorage
- **Q7 (Tooltip Formatting)**: Resolved - Show both amount and percentage
- **Q8 (Multi-Tab Sync)**: Resolved - Implement via Realtime

## Test Strategy Summary

**Manual Testing Approach:**
Epic 5 follows the project's manual testing + static analysis strategy (no automated test framework configured). Each story must pass TypeScript compilation (`npx tsc --noEmit`) and ESLint validation (`npx next lint`) before marking as complete.

**Story-Level Testing Checklist:**

**Story 5.1: Dashboard Layout**
- [ ] Navigate to `/` → Dashboard loads as default page
- [ ] Sidebar displays all navigation items (Dashboard, Transactions, Categories, Insights, Settings)
- [ ] Click each nav item → Active state highlights correctly
- [ ] Resize browser: Mobile (<768px) → Sidebar hides, hamburger appears
- [ ] Click hamburger → Drawer slides in from left
- [ ] Tablet (768-1023px) → Sidebar collapses to icon-only mode
- [ ] Desktop (≥1024px) → Full sidebar visible
- [ ] Tab through navigation → Keyboard accessible
- [ ] Test with screen reader → Announces "Dashboard page"

**Story 5.2: Financial Summary Cards**
- [ ] Add income transaction → Income StatCard updates immediately
- [ ] Add expense transaction → Expense StatCard updates immediately
- [ ] Verify trend arrows: ↑ for increases, ↓ for decreases
- [ ] Balance = Income - Expenses calculation correct
- [ ] No transactions → Shows $0.00 empty state
- [ ] Refresh page → StatCards load within 1 second
- [ ] Mobile: StatCards stack vertically
- [ ] Desktop: StatCards display in 3-column grid

**Story 5.3: Monthly Spending by Category**
- [ ] Add expense transactions in multiple categories → Pie chart displays
- [ ] Hover over slice → Tooltip shows category name, amount, percentage
- [ ] Verify chart uses correct category colors from categories table
- [ ] Click legend item → Toggles category visibility
- [ ] No expenses → Shows "No expenses yet this month" empty state
- [ ] Add transaction → Chart updates within 300ms
- [ ] Mobile: Chart scales to screen width
- [ ] Test with screen reader → Data table alternative available

**Story 5.4: Spending Trends Line Chart**
- [ ] Add transactions across multiple months → Line chart displays
- [ ] Hover over data point → Tooltip shows month, income, expenses
- [ ] Verify income line is green, expenses line is red
- [ ] X-axis shows month labels ("Jun", "Jul", "Aug")
- [ ] Y-axis shows dollar amounts with correct scale
- [ ] No transactions → Shows "Add transactions to see trends"
- [ ] Mobile: Chart scrolls horizontally if needed
- [ ] Test with screen reader → Data table alternative available

**Story 5.5: Month-over-Month Highlights**
- [ ] Increase spending in category by >20% → Appears in highlights with red indicator
- [ ] Decrease spending in category by >20% → Appears with green indicator
- [ ] Verify format: "[Category]: ↑ 40% ($480 vs $340)"
- [ ] Shows up to 5 most significant changes
- [ ] No significant changes → Shows "No significant changes" empty state
- [ ] Click category → Navigates to transactions page with filter applied

**Story 5.6: Chart Interactivity**
- [ ] Click pie chart slice → Navigates to `/transactions?category=[id]&month=[month]`
- [ ] Verify transactions page shows filtered results
- [ ] Click line chart data point → Navigates to `/transactions?month=[YYYY-MM]`
- [ ] Verify "Back to Dashboard" link works
- [ ] Hover tooltips appear within 100ms
- [ ] Mobile: Tap charts instead of hover → Tooltips appear
- [ ] Keyboard: Tab to chart, Enter to drill down

**Story 5.7: Performance & Loading**
- [ ] Measure dashboard load time with slow 3G throttling → <2 seconds
- [ ] Verify skeleton loaders appear immediately on navigation
- [ ] Add transaction → Dashboard updates within 300ms
- [ ] Run Lighthouse audit → Performance score >90
- [ ] Kill network → Error state appears with "Retry" button
- [ ] Click Retry → Data refetches successfully
- [ ] Open dashboard in 2 tabs → Add transaction in one → Other tab updates

**Story 5.8: Responsive Design**
- [ ] Test on iPhone SE (375px) → Single column, StatCards stacked
- [ ] Test on iPad (768px) → 2-column StatCard grid
- [ ] Test on desktop (1440px) → 3-column StatCard grid, full sidebar
- [ ] Touch targets on mobile ≥44px (measure with browser dev tools)
- [ ] No horizontal scrolling on mobile (check all breakpoints)
- [ ] Charts render correctly on all screen sizes
- [ ] Fonts scale appropriately (verify H1 sizes)

**Cross-Story Integration Testing:**
- [ ] Add transaction → All 3 components update (StatCards, PieChart, LineChart)
- [ ] Navigate: Dashboard → Transactions → Dashboard → Data persists (SWR cache)
- [ ] Multi-tab: Add transaction in Tab 1 → Dashboard in Tab 2 updates
- [ ] Navigate away and back → Dashboard remembers scroll position (browser default)
- [ ] Sidebar collapse state persists across page refreshes (localStorage)

**Performance Testing:**
- [ ] Run Lighthouse audit (Incognito mode, slow 3G throttling):
  - Performance score: Target >90
  - FCP: <1.8s
  - LCP: <2.5s
  - CLS: <0.1
  - TTI: <3.8s
- [ ] Measure API response times:
  - `/api/dashboard/stats`: <500ms
  - `/api/dashboard/spending-by-category`: <500ms
  - `/api/dashboard/trends`: <500ms
- [ ] Test with 10,000 transactions → Aggregation queries <500ms
- [ ] Measure bundle size: Dashboard page <150KB gzipped

**Accessibility Testing:**
- [ ] Test with keyboard only (no mouse):
  - Tab through all interactive elements
  - Enter activates links and buttons
  - Escape closes drawers and modals
- [ ] Test with screen reader (NVDA/VoiceOver):
  - Chart data announced via data table alternatives
  - Navigation items announced correctly
  - StatCard values and trends announced
- [ ] Check color contrast (WCAG AA): All text meets 3:1 minimum ratio
- [ ] Verify focus indicators visible on all interactive elements

**Browser Compatibility:**
- [ ] Chrome 120+ → All features work
- [ ] Firefox 120+ → All features work
- [ ] Safari 17+ → All features work
- [ ] Edge 120+ → All features work

**Static Analysis (Required Before Story Completion):**
```bash
# TypeScript compilation
npx tsc --noEmit

# ESLint validation
npx next lint

# Both must pass with 0 errors before marking story complete
```

**Test Data Setup:**
```typescript
// Recommended test data for comprehensive dashboard testing:
- User with 50+ transactions across 6 months
- Multiple categories used (minimum 5 different categories)
- Mix of income and expense transactions
- Some months with >20% spending changes
- Edge cases:
  - New user with 0 transactions
  - User with only 1-2 transactions
  - User with transactions in single category only
```

---

**Epic 5 Complete When:**
- All 8 stories marked as "done" in sprint-status.yaml
- All acceptance criteria checked off
- TypeScript and ESLint validation pass with 0 errors
- Lighthouse performance score >90
- Manual testing checklist 100% complete
- No known critical or high-severity bugs
