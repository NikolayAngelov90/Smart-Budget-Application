# Epic Technical Specification: AI Budget Insights

Date: 2025-12-02
Author: Niki
Epic ID: 6
Status: Draft

---

## Overview

Epic 6 implements a rules-based AI insight generation system that analyzes user spending patterns and provides personalized budget recommendations in a friendly coaching tone. This epic fulfills the core product value proposition of "AI-powered budget coaching" by delivering at least 3 meaningful insights per month when sufficient transaction data exists (FR37). The system uses deterministic server-side rules rather than third-party AI APIs, ensuring data privacy, predictable behavior, and cost efficiency.

The insight engine analyzes transaction history to detect four key patterns: spending increases (>20% month-over-month), budget limit recommendations (based on 3-month averages), unusual expenses (>2 standard deviations from mean), and positive reinforcement (categories under budget). Insights are prioritized by urgency (Priority 5 Critical → Priority 1 Low) and presented through a dedicated "AI Budget Coach" section on the dashboard, with a full insights page for browsing, filtering, and dismissing recommendations.

## Objectives and Scope

**In Scope:**
- Rules-based insight generation engine with 4 insight types (spending increase, budget recommendation, unusual expense, positive reinforcement)
- Statistical analysis functions for month-over-month comparison, 3-month rolling averages, and standard deviation calculations
- Insights database table with type, priority, metadata storage
- AI Budget Coach dashboard widget displaying top 3 insights
- Full insights page at `/insights` with filtering, search, dismiss/undismiss functionality
- Expandable insight cards with supporting data (amounts, transaction counts, percent changes)
- Automatic insight generation triggers (new month, 10+ transactions added, manual refresh)
- Scheduled job for daily insight generation at midnight UTC
- Manual refresh button with rate limiting (1 refresh per 5 minutes)
- Coaching tone throughout all text (friendly, not judgmental)
- Mobile-responsive design for all insight components

**Out of Scope:**
- Third-party AI APIs (OpenAI, Claude, etc.) - using deterministic rules only
- Machine learning models or predictive analytics
- Natural language processing for transaction categorization
- User-configurable insight rules or thresholds
- Push notifications for new insights (future epic)
- Insight explanations using generative AI (future enhancement)
- Multi-user household insight aggregation
- Integration with external financial data sources

## System Architecture Alignment

**Frontend Architecture:**
- New route: `/app/(dashboard)/insights/page.tsx` for full insights page
- New components: `AIInsightCard.tsx`, `InsightsList.tsx` in `src/components/insights/`
- Dashboard integration: Add "AI Budget Coach" section to `src/app/dashboard/page.tsx`
- Chakra UI components for consistent styling (Alert, Card, Badge, Accordion, Button)
- SWR for client-side caching of insights data with 5-minute stale time
- Mobile-responsive design using Chakra UI responsive props

**Backend Architecture:**
- New API routes:
  - `POST /api/insights/generate` - Generate insights for authenticated user
  - `GET /api/insights` - Fetch insights with filtering (type, dismissed, search)
  - `PUT /api/insights/:id/dismiss` - Mark insight as dismissed
  - `PUT /api/insights/:id/undismiss` - Unmark insight as dismissed
- New server-side modules:
  - `src/lib/ai/insightRules.ts` - Rule functions for 4 insight types
  - `src/lib/ai/spendingAnalysis.ts` - Statistical analysis utilities
  - `src/lib/services/insightService.ts` - Orchestration and database operations
- Scheduled job: Vercel Cron Job calling `/api/cron/generate-insights` daily at midnight UTC

**Database Schema:**
- Extends existing PostgreSQL schema with `insights` table (already defined in Story 1.2)
- Uses existing `transactions` and `categories` tables for analysis
- Row-Level Security (RLS) ensures users only see their own insights

**Performance Constraints:**
- Insight generation completes in <2 seconds (NFR FR20)
- Dashboard loads insights in <500ms using SWR cache
- Caching: Redis-compatible cache with 1-hour TTL for generated insights
- Rate limiting: 1 manual refresh per 5 minutes per user

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| **insightRules.ts** | Implement 4 rule types for insight generation | Transaction arrays, category data, time periods | Insight objects with title, description, type, priority, metadata | Backend |
| **spendingAnalysis.ts** | Statistical calculations (mean, std dev, month-over-month %) | Transaction amounts, dates | Statistical metrics (averages, deviations, percent changes) | Backend |
| **insightService.ts** | Orchestrate insight generation, database operations, caching | User ID, force regenerate flag | Array of generated insights, cache operations | Backend |
| **AIInsightCard.tsx** | Render individual insight card with dismiss, expand, styling | Insight object (title, description, type, priority, metadata) | React component with interactive card | Frontend |
| **InsightsList.tsx** | Display filtered list of insights with pagination | Insights array, filters (type, dismissed, search) | Paginated list of AIInsightCard components | Frontend |
| **InsightsPage** | Full insights page with filters, search, dismiss actions | User authentication state | Complete insights interface with filtering | Frontend |
| **DashboardInsightsWidget** | Dashboard section showing top 3 insights | Top 3 insights by priority | Compact insight cards with "View all" link | Frontend |

**Module Dependencies:**
- `insightService.ts` depends on `insightRules.ts` and `spendingAnalysis.ts`
- `insightRules.ts` depends on `spendingAnalysis.ts` for statistical functions
- Frontend components depend on API routes for data fetching
- All modules depend on existing `transactions` and `categories` data

### Data Models and Contracts

**Insights Table Schema:**
```sql
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  type insight_type NOT NULL, -- ENUM: 'spending_increase', 'budget_recommendation', 'unusual_expense', 'positive_reinforcement'
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5), -- 5=Critical, 4=High, 3=Medium, 2=Low, 1=Info
  is_dismissed BOOLEAN DEFAULT false,
  metadata JSONB, -- Flexible storage for rule-specific data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_insights_user_id ON insights(user_id);
CREATE INDEX idx_insights_user_priority ON insights(user_id, priority DESC, created_at DESC);
CREATE INDEX idx_insights_user_type ON insights(user_id, type);
CREATE INDEX idx_insights_dismissed ON insights(user_id, is_dismissed);
```

**Insight Type TypeScript Interface:**
```typescript
export type InsightType =
  | 'spending_increase'
  | 'budget_recommendation'
  | 'unusual_expense'
  | 'positive_reinforcement';

export interface Insight {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: InsightType;
  priority: 1 | 2 | 3 | 4 | 5; // 5=Critical, 1=Info
  is_dismissed: boolean;
  metadata: InsightMetadata;
  created_at: Date;
}

export interface InsightMetadata {
  category_id?: string;
  category_name?: string;
  current_amount?: number;
  previous_amount?: number;
  percent_change?: number;
  transaction_count_current?: number;
  transaction_count_previous?: number;
  recommended_budget?: number;
  three_month_average?: number;
  standard_deviation?: number;
  transaction_id?: string; // For unusual expense
  typical_amount?: number;
}
```

**API Request/Response Contracts:**
```typescript
// POST /api/insights/generate
interface GenerateInsightsRequest {
  forceRegenerate?: boolean; // Bypass cache
}

interface GenerateInsightsResponse {
  success: boolean;
  insights: Insight[];
  message: string; // e.g., "3 new insights generated"
  cached: boolean;
}

// GET /api/insights
interface GetInsightsRequest {
  type?: InsightType;
  dismissed?: boolean;
  search?: string;
  limit?: number; // Default 20
  offset?: number; // Pagination
}

interface GetInsightsResponse {
  insights: Insight[];
  total: number;
  hasMore: boolean;
}

// PUT /api/insights/:id/dismiss
interface DismissInsightResponse {
  success: boolean;
  insight: Insight;
}
```

### APIs and Interfaces

**1. Generate Insights API**
- **Method:** POST
- **Path:** `/api/insights/generate`
- **Auth:** Required (user session)
- **Request Body:** `{ forceRegenerate?: boolean }`
- **Response:** `{ success: boolean, insights: Insight[], message: string, cached: boolean }`
- **Status Codes:**
  - 200: Insights generated successfully
  - 429: Rate limit exceeded (max 1 per 5 minutes)
  - 401: Unauthorized
  - 500: Server error
- **Logic:**
  1. Check cache for existing insights (key: `insights_${userId}_${month}`)
  2. If cached and not force regenerate, return cached insights
  3. Fetch user transactions (current month, last 3 months for analysis)
  4. Run all 4 insight rules via `insightService.generateInsights()`
  5. Insert new insights into database
  6. Cache results with 1-hour TTL
  7. Return insights array

**2. Get Insights API**
- **Method:** GET
- **Path:** `/api/insights`
- **Auth:** Required
- **Query Params:** `?type=spending_increase&dismissed=false&search=dining&limit=20&offset=0`
- **Response:** `{ insights: Insight[], total: number, hasMore: boolean }`
- **Status Codes:**
  - 200: Success
  - 401: Unauthorized
  - 500: Server error
- **Logic:**
  1. Build SQL query with WHERE clauses for filters
  2. Apply search to title and description (ILIKE)
  3. Order by priority DESC, created_at DESC
  4. Apply pagination (limit, offset)
  5. Return insights with total count

**3. Dismiss Insight API**
- **Method:** PUT
- **Path:** `/api/insights/:id/dismiss`
- **Auth:** Required
- **Response:** `{ success: boolean, insight: Insight }`
- **Status Codes:**
  - 200: Dismissed successfully
  - 404: Insight not found or not owned by user
  - 401: Unauthorized
  - 500: Server error
- **Logic:**
  1. Verify insight belongs to authenticated user
  2. Update `is_dismissed = true`
  3. Return updated insight

**4. Undismiss Insight API**
- **Method:** PUT
- **Path:** `/api/insights/:id/undismiss`
- **Auth:** Required
- **Response:** `{ success: boolean, insight: Insight }`
- **Status Codes:** Same as dismiss
- **Logic:** Same as dismiss but sets `is_dismissed = false`

**5. Cron Job API (Internal)**
- **Method:** POST
- **Path:** `/api/cron/generate-insights`
- **Auth:** Vercel Cron secret header
- **Response:** `{ success: boolean, usersProcessed: number }`
- **Logic:**
  1. Verify cron secret from request headers
  2. Check if new month (compare current date to last run)
  3. If new month, queue insight generation for all users
  4. Call `generateInsights()` for each user
  5. Return count of users processed

### Workflows and Sequencing

**Workflow 1: Insight Generation (Scheduled)**
```
Trigger: Vercel Cron (daily at midnight UTC)
↓
1. Cron job POST /api/cron/generate-insights
   - Verify cron secret
   - Check if new month started
↓
2. If new month:
   - Query all users with transactions
   - For each user:
     a. Fetch user transactions (current + last 3 months)
     b. Run insightRules.generateAllInsights(transactions)
        - Check spending increase rule
        - Check budget recommendation rule
        - Check unusual expense rule
        - Check positive reinforcement rule
     c. Filter generated insights (only meaningful ones)
     d. Insert insights into database
     e. Cache results (1-hour TTL)
↓
3. Return success count
```

**Workflow 2: Manual Insight Refresh**
```
User clicks "Refresh Insights" button on /insights page
↓
1. Frontend POST /api/insights/generate { forceRegenerate: true }
   - Show loading spinner
↓
2. Backend checks rate limit (1 per 5 minutes)
   - If rate limited: return 429 error
↓
3. Backend bypasses cache, generates fresh insights
   - Fetch transactions
   - Run all rules
   - Insert/update insights
   - Invalidate cache
↓
4. Return insights to frontend
   - Hide loading spinner
   - Show success toast: "X new insights generated"
   - Refresh insights list
```

**Workflow 3: Dashboard Insights Display**
```
User navigates to dashboard
↓
1. Dashboard loads AIBudgetCoach component
↓
2. Component fetches top 3 insights
   - SWR hook: GET /api/insights?limit=3&dismissed=false&orderBy=priority
   - Uses 5-minute cache (SWR dedupingInterval)
↓
3. Render AIInsightCard for each insight
   - Show icon based on type
   - Display title and description
   - Show priority indicator
   - Render dismiss button
↓
4. User clicks dismiss
   - PUT /api/insights/:id/dismiss
   - Optimistic update (mark as dismissed in UI)
   - Revalidate SWR cache
   - Removed from top 3 list
```

**Workflow 4: Full Insights Page with Filtering**
```
User clicks "View all insights" on dashboard
↓
1. Navigate to /insights page
↓
2. Page loads with default filters
   - GET /api/insights?dismissed=false&limit=20&offset=0
↓
3. User applies filters
   - Select type: "Spending Increases"
   - Toggle "Show dismissed": ON
   - Enter search: "dining"
↓
4. URL updates: /insights?type=spending_increase&dismissed=true&search=dining
↓
5. Re-fetch with new filters
   - GET /api/insights?type=spending_increase&dismissed=true&search=dining&limit=20
↓
6. User clicks insight to expand
   - Accordion opens
   - Shows metadata (amounts, transaction counts, etc.)
   - Shows "View transactions" link
↓
7. User clicks "View transactions"
   - Navigate to /transactions?category={categoryId}&month={month}
```

## Non-Functional Requirements

### Performance

**Targets (from FR20, FR25, FR26):**
- **Insight generation:** <2 seconds for on-demand generation (FR20)
- **Dashboard load:** Insights section loads in <500ms using SWR cache
- **Insights page load:** <1 second for initial 20 insights
- **Search/filter operations:** <300ms response time
- **Manual refresh:** <2 seconds with loading indicator

**Implementation:**
- Database indexes on `user_id`, `priority`, `type`, `is_dismissed` for fast queries
- Redis-compatible caching (1-hour TTL) to avoid redundant insight generation
- SWR client-side caching (5-minute stale time) for dashboard widgets
- Pagination (20 insights per page) to limit data transfer
- Debounced search (300ms) to reduce API calls
- Transaction queries optimized with date range indexes
- Statistical calculations use efficient aggregation queries (SUM, AVG, STDDEV_POP)

**Monitoring:**
- Track insight generation execution time (p50, p95, p99)
- Monitor cache hit rates (target >80%)
- Alert if generation time exceeds 2 seconds for 5 consecutive requests

### Security

**Authentication & Authorization:**
- All API endpoints require valid user session (Supabase Auth middleware)
- Row-Level Security (RLS) ensures users only access their own insights
- Cron job API secured with Vercel-provided secret header (`CRON_SECRET`)
- RLS policies:
  ```sql
  -- Users can only SELECT their own insights
  CREATE POLICY insights_select ON insights FOR SELECT USING (auth.uid() = user_id);

  -- Users can only UPDATE their own insights (for dismiss/undismiss)
  CREATE POLICY insights_update ON insights FOR UPDATE USING (auth.uid() = user_id);
  ```

**Data Privacy:**
- No third-party AI APIs used - all processing server-side
- Insight metadata contains aggregated data only (no individual transaction details)
- Dismissed insights retained for analysis (not deleted) but marked as not relevant
- No PII (names, emails) stored in insight metadata

**Input Validation:**
- API request validation using Zod schemas
- SQL injection prevention via parameterized queries (Supabase client)
- Rate limiting on manual refresh (1 per 5 minutes per user) prevents abuse

**Threat Mitigation:**
- XSS protection: React escapes all user-provided content automatically
- CSRF protection: Next.js built-in CSRF handling for POST/PUT requests
- SQL injection: Supabase parameterized queries and RLS

### Reliability/Availability

**Availability Target:** 99.5% uptime (consistent with Supabase and Vercel SLAs)

**Error Handling:**
- Graceful degradation: If insight generation fails, show cached insights or empty state
- API error responses include descriptive messages for debugging
- Frontend error boundaries catch and display user-friendly error messages
- Retry logic for transient database errors (max 3 retries with exponential backoff)

**Failure Scenarios:**
1. **Insight generation fails:** Return empty array, log error, show "No insights yet" message
2. **Database unavailable:** SWR returns cached data, shows stale-data indicator
3. **Cron job fails:** Next scheduled run will generate insights (daily retry)
4. **Cache unavailable:** Fallback to direct database queries (degraded performance)

**Backup and Recovery:**
- Insights stored in PostgreSQL with Supabase automated backups (daily)
- No data loss risk - insights can be regenerated from transaction history
- RLS ensures data isolation even if multi-tenant database compromised

### Observability

**Logging:**
- Insight generation events logged with metadata:
  - User ID, timestamp, generation duration, number of insights generated, cache hit/miss
- API errors logged with stack traces and request context
- Cron job execution logged with success/failure status and user count
- Use structured logging (JSON format) for parsing and alerting

**Metrics:**
- **Insight generation metrics:** Count, duration, cache hit rate, error rate
- **API metrics:** Request count, response time (p50, p95, p99), error rate per endpoint
- **User engagement:** Insights viewed, dismissed, expanded, refresh clicks
- **Business metrics:** Average insights per user, insight types distribution, time to first insight

**Monitoring:**
- Vercel Analytics for frontend performance
- Supabase dashboard for database query performance
- Custom dashboard for insight-specific metrics (Vercel Analytics or DataDog)
- Alerts:
  - Insight generation fails for >5% of users
  - API response time exceeds 2 seconds for p95
  - Cron job fails 2 consecutive times

**Tracing:**
- Next.js built-in OpenTelemetry support for request tracing
- Trace insight generation from API call → rule execution → database insert → cache
- Correlate frontend errors with backend logs using request IDs

## Dependencies and Integrations

**Runtime Dependencies (from package.json):**
| Dependency | Version | Purpose | Notes |
|------------|---------|---------|-------|
| `next` | ^15.0.0 | Web framework, API routes, cron jobs | Using App Router and Route Handlers |
| `react` | ^18.3.0 | UI framework | For insight components |
| `@supabase/supabase-js` | ^2.81.1 | Database client, authentication | For insights CRUD and RLS |
| `@chakra-ui/react` | ^2.8.0 | UI components (Card, Badge, Accordion, Button) | For AIInsightCard styling |
| `swr` | ^2.3.6 | Client-side data fetching and caching | For insights data with 5-minute cache |
| `date-fns` | ^4.1.0 | Date manipulation (startOfMonth, subMonths, format) | For time period calculations |
| `zod` | ^4.1.12 | API request validation | For type-safe request parsing |
| `react-icons` | ^5.5.0 | Icons for insight types | For warning, info, check, alert icons |

**Development Dependencies:**
| Dependency | Version | Purpose |
|------------|---------|---------|
| `typescript` | ^5.3.0 | Type checking for insight interfaces |
| `eslint` | ^8.56.0 | Code quality |

**External Services:**
- **Supabase PostgreSQL:** Database for insights storage with RLS
- **Vercel:** Deployment platform with Cron Jobs for scheduled insight generation
- **Vercel Edge Functions (optional):** Alternative to cron jobs for insight generation

**Internal Integrations:**
- **Transactions API:** Source data for insight analysis
- **Categories API:** Category names and colors for insight metadata
- **Dashboard:** Display top 3 insights in AI Budget Coach section
- **Authentication:** User session required for all insight operations

**No External AI APIs:**
- Deliberately avoiding OpenAI, Claude, or other third-party AI services
- All intelligence implemented as deterministic rules in TypeScript

## Acceptance Criteria (Authoritative)

This section consolidates all acceptance criteria from Epic 6 stories into normalized, testable statements mapped to functional requirements.

### AC1: Insight Rules Engine Core (Story 6.1, FR29, FR30)
**Given** users have transaction history
**When** the insight generation job runs
**Then** meaningful insights are created based on spending patterns
**And** 4 insight rule types are implemented:
  1. **Spending Increase Detection** (Priority 4): Triggers when category spending >20% higher than previous month
  2. **Budget Limit Recommendations** (Priority 3): Based on 3-month average + 10% buffer
  3. **Unusual Expense Flagging** (Priority 5): Detects transactions >2 standard deviations from category mean
  4. **Positive Reinforcement** (Priority 2): Celebrates categories <90% of recommended budget

### AC2: Rule Implementation and Storage (Story 6.1, FR31)
**Given** the rules engine is implemented
**When** rules execute
**Then** all rules are implemented in `lib/ai/insightRules.ts`
**And** statistical functions calculate: mean, standard deviation, month-over-month comparison
**And** insights are stored in `insights` table with type, priority, metadata
**And** each insight includes: title, description, type, priority, metadata (amounts, category info)

### AC3: Insight Generation Triggers (Story 6.1, Story 6.5, FR32)
**Given** the system is operational
**When** trigger conditions occur
**Then** generation is triggered by:
  1. Start of new month (scheduled job for all users)
  2. After user adds 10+ new transactions
  3. Manual refresh by user
**And** insights are cached for 1 hour to avoid redundant calculations
**And** cache is invalidated on manual refresh (bypasses 1-hour cache)

### AC4: Dashboard Insights Display (Story 6.2, FR33)
**Given** the system has generated insights for a user
**When** the user views the dashboard
**Then** top 3 AI insights are displayed prominently
**And** section is titled "AI Budget Coach"
**And** shows top 3 highest priority insights (priority 5 → 1)
**And** each insight uses AIInsightCard component
**And** card shows: icon/emoji, title, description, priority indicator, dismiss button
**And** card is colored by type:
  - Spending increase: Orange/warning border
  - Budget recommendation: Blue/info border
  - Unusual expense: Red/error border
  - Positive reinforcement: Green/success border
**And** "View all insights" link navigates to `/insights` page
**And** empty state displays: "Keep tracking! We'll have insights after a few weeks of data."
**And** insights update when new ones are generated
**And** mobile: insights stack vertically; desktop: grid layout
**And** coaching tone is used throughout (friendly, not judgmental)

### AC5: Full Insights Page with Filtering (Story 6.3, FR34)
**Given** the user navigates to the Insights page
**When** the user views and filters insights
**Then** all generated insights are displayed in chronological order (newest first)
**And** filter dropdown includes: All Types, Spending Increases, Budget Recommendations, Unusual Expenses, Positive Reinforcement
**And** toggle controls dismissed insights visibility (off by default)
**And** each insight card shows: type badge, title, description, date generated, dismiss button
**And** dismissed insights appear grayed out with "Dismissed" badge
**And** dismiss button marks insight as not relevant (`is_dismissed = true`)
**And** undismiss option is available on dismissed insights
**And** empty state displays: "No insights yet. We'll generate insights after you track more transactions."
**And** insights are paginated (20 per page) or use infinite scroll
**And** search box filters by keyword in title/description
**And** mobile responsive: full-width cards, stacked layout

### AC6: Insight Supporting Data (Story 6.4, FR35)
**Given** the user views an AI insight
**When** the user clicks "See details" or expands the insight
**Then** supporting data is displayed explaining the insight
**And** expandable section uses accordion or modal
**And** shows metadata: category, amounts compared, time periods, calculations
**And** example for spending increase displays:
  - Category name
  - Current month: amount and transaction count
  - Previous month: amount and transaction count
  - Increase: absolute and percentage change
**And** link is provided to view transactions for that category/period
**And** micro-chart shows trend (optional: line chart of last 3 months)
**And** "Why am I seeing this?" explanation is provided in plain language
**And** mobile: full-screen modal; desktop: inline expansion
**And** close/collapse button hides details

### AC7: Scheduled Insight Generation (Story 6.5, FR36)
**Given** the system is running
**When** scheduled conditions trigger
**Then** scheduled job runs daily at midnight UTC (checks if new month)
**And** automatic generation occurs for all users at start of new month
**And** generation completes in <2 seconds (as per NFR FR20)

### AC8: Manual Insight Refresh (Story 6.5, FR37)
**Given** the user is on the insights page
**When** the user clicks "Refresh insights" button
**Then** manual refresh generates new insights
**And** loading indicator displays while generating
**And** success toast shows: "Insights updated! X new insights generated."
**And** if no new insights: "All caught up! No new insights at this time."
**And** rate limiting enforces max 1 manual refresh per 5 minutes per user

### AC9: Coaching Tone Consistency (All Stories, FR29-FR37)
**Given** any insight is generated or displayed
**When** the user reads the insight
**Then** all text uses a friendly, supportive coaching tone
**And** language is non-judgmental and encouraging
**And** recommendations are constructive and actionable

## Traceability Mapping

This table maps each acceptance criterion to implementation artifacts and test coverage.

| AC | Spec Section(s) | Component(s)/API(s) | Test Idea |
|---|---|---|---|
| **AC1** | Services: InsightRulesService, SpendingAnalysisService<br>Data Models: Insight, InsightMetadata | `lib/ai/insightRules.ts`<br>`lib/ai/spendingAnalysis.ts`<br>`lib/services/insightService.ts` | **Unit:** Test each rule function with mock transaction data<br>**Integration:** Verify correct rule triggers for spending patterns<br>**Edge:** Test with minimal data (1-2 transactions) |
| **AC2** | Services: InsightRulesService<br>Data Models: Insight interface<br>APIs: POST /api/insights/generate | `lib/ai/insightRules.ts`<br>Database: `insights` table<br>Statistical functions in `spendingAnalysis.ts` | **Unit:** Test statistical calculations (mean, stdDev, MoM)<br>**Integration:** Verify database insertion with correct schema<br>**Edge:** Test with outlier values (negative amounts, very large numbers) |
| **AC3** | Workflows: Scheduled Generation, Manual Refresh<br>Services: InsightService<br>APIs: POST /api/insights/generate | `app/api/insights/generate/route.ts`<br>`app/api/cron/generate-insights/route.ts`<br>Cache layer (Redis/Upstash) | **Integration:** Test cron job execution<br>**Integration:** Test cache hit/miss scenarios<br>**Functional:** Test 10-transaction trigger<br>**Performance:** Verify <2s generation time |
| **AC4** | Services: InsightService<br>APIs: GET /api/insights<br>Components: AIBudgetCoach, AIInsightCard | `components/dashboard/AIBudgetCoach.tsx`<br>`components/insights/AIInsightCard.tsx`<br>`app/dashboard/page.tsx` | **Component:** Test AIInsightCard renders all props correctly<br>**Component:** Test color scheme mapping by insight type<br>**Visual:** Verify responsive layout (mobile/desktop)<br>**Functional:** Test "View all" link navigation |
| **AC5** | APIs: GET /api/insights (with filters)<br>APIs: PUT /api/insights/:id/dismiss<br>Components: InsightsPage, InsightCard | `app/(dashboard)/insights/page.tsx`<br>`components/insights/InsightCard.tsx`<br>API routes for filtering and dismissal | **Functional:** Test filter dropdown changes URL params<br>**Functional:** Test dismiss/undismiss toggle<br>**Functional:** Test search with debouncing<br>**Component:** Test pagination or infinite scroll |
| **AC6** | Data Models: InsightMetadata<br>Components: InsightDetailModal, InsightMetadataDisplay | `components/insights/InsightDetailModal.tsx`<br>Metadata rendering in AIInsightCard<br>Link to `/transactions` with filters | **Component:** Test accordion/modal expansion<br>**Functional:** Test metadata rendering by insight type<br>**Functional:** Test link to transactions with correct filters<br>**Visual:** Verify mobile modal vs desktop inline |
| **AC7** | Workflows: Scheduled Generation<br>APIs: Vercel Cron endpoint<br>Services: InsightService | `app/api/cron/generate-insights/route.ts`<br>`vercel.json` cron configuration | **Integration:** Test cron job runs at midnight UTC<br>**Integration:** Test batch generation for multiple users<br>**Performance:** Verify completes in <2s per user |
| **AC8** | APIs: POST /api/insights/generate (with forceRegenerate)<br>Components: RefreshInsightsButton | `components/insights/RefreshInsightsButton.tsx`<br>Rate limiting logic in API route | **Functional:** Test manual refresh button triggers generation<br>**Functional:** Test loading indicator appears/disappears<br>**Functional:** Test success/no-new-insights toasts<br>**Integration:** Test rate limiting (5-minute window) |
| **AC9** | All components displaying insights<br>All insight rule descriptions | `lib/ai/insightRules.ts` (insight text generation)<br>All insight-related UI components | **Manual:** Review all generated insight text for tone<br>**Manual:** Verify coaching language (no negative phrasing)<br>**Regression:** Test insight text in all 4 rule types |

## Risks, Assumptions, Open Questions

### Risks

**RISK-1: Insight Quality with Limited Data (HIGH)**
- New users with <2 months of transaction history may receive low-quality or no insights
- Mitigation: Require minimum thresholds (e.g., 20 transactions, 2 months of data) before generating insights
- Mitigation: Show clear empty states explaining why no insights are available yet

**RISK-2: Cron Job Reliability (MEDIUM)**
- Vercel Cron Jobs may experience cold starts or execution delays
- Mitigation: Implement idempotency checks to prevent duplicate insight generation
- Mitigation: Add monitoring and alerting for failed cron executions
- Mitigation: Consider Supabase Edge Functions as fallback

**RISK-3: Statistical Accuracy with Outliers (MEDIUM)**
- Unusual expenses or one-time large transactions may skew statistical calculations
- Mitigation: Implement outlier detection and exclusion logic in statistical functions
- Mitigation: Use robust statistical measures (median, IQR) in addition to mean/stdDev

**RISK-4: User Perception of "AI" (LOW)**
- Users may expect ML/LLM capabilities when seeing "AI Budget Coach"
- Mitigation: Use clear language in UI about "smart recommendations" instead of "AI predictions"
- Mitigation: Provide transparency via "Why am I seeing this?" explanations

**RISK-5: Rate Limiting Too Restrictive (LOW)**
- 5-minute rate limit on manual refresh may frustrate power users
- Mitigation: Monitor user behavior and adjust rate limits based on usage patterns
- Mitigation: Show clear feedback when rate limit is hit

**RISK-6: Coaching Tone Consistency (MEDIUM)**
- Maintaining friendly, non-judgmental tone across all rule types and edge cases
- Mitigation: Create tone guidelines document for all insight text
- Mitigation: Manual review of all generated insight templates before release

### Assumptions

**ASSUMPTION-1: Transaction History Availability**
- Users have at least 30 days of transaction history before insights become useful
- Impact: New users will see empty states for first month

**ASSUMPTION-2: Data Quality**
- Transactions have valid amounts, dates, and category assignments
- Impact: Poor data quality will degrade insight accuracy

**ASSUMPTION-3: Category Consistency**
- Users maintain consistent category usage over time
- Impact: Frequent category changes will make month-over-month comparisons less meaningful

**ASSUMPTION-4: Server-Side Execution**
- Insight generation executes entirely server-side (no client-side processing)
- Impact: Requires robust API error handling and loading states

**ASSUMPTION-5: User Engagement**
- Users will interact with insights (dismiss, view details, refresh)
- Impact: Low engagement may indicate need for UI/UX improvements

**ASSUMPTION-6: Single Currency**
- All transactions are in the same currency for a user
- Impact: Multi-currency support would require additional complexity

**ASSUMPTION-7: Coaching Tone Acceptance**
- Users will respond positively to friendly, encouraging language
- Impact: May need to adjust tone based on user feedback

### Open Questions

**QUESTION-1: Push Notifications**
- Should we implement push notifications or email alerts for new high-priority insights?
- Decision needed: Phase 1 or defer to Phase 2?

**QUESTION-2: Insight Retention Policy**
- How long should we retain old insights? Archive after 90 days? Soft-delete?
- Decision needed: Define retention policy before Story 6.1 implementation

**QUESTION-3: User Feedback Mechanism**
- Should users be able to rate insight quality (helpful/not helpful)?
- Decision needed: Could improve future rule refinements

**QUESTION-4: Multi-Currency Support**
- Do we need to handle currency conversions for insights?
- Decision needed: Check with product if international users are in scope

**QUESTION-5: Insight Archival vs Deletion**
- Should dismissed insights be soft-deleted or remain visible with "dismissed" filter?
- Decision needed: Current spec assumes soft-delete (is_dismissed flag)

**QUESTION-6: Bulk Insight Management**
- Should users be able to dismiss all insights at once or by type?
- Decision needed: UI/UX consideration for power users

**QUESTION-7: Historical Insight Regeneration**
- If we improve rule logic, should we regenerate historical insights?
- Decision needed: Versioning strategy for insight rules

## Test Strategy Summary

This test strategy ensures comprehensive coverage of Epic 6 functional and non-functional requirements across all testing levels.

### Testing Levels and Frameworks

**Unit Tests (Jest + TypeScript)**
- Target files: `lib/ai/insightRules.ts`, `lib/ai/spendingAnalysis.ts`, `lib/services/insightService.ts`
- Coverage goal: 90%+ for all rule logic and statistical functions
- Mock transaction data with various scenarios (sparse data, outliers, edge cases)

**Integration Tests (Jest + Supertest for API routes)**
- Test all 5 API endpoints with real database connections (test database)
- Verify caching behavior with Redis mock or test instance
- Test Supabase RLS policies for insights table
- Coverage goal: 85%+ for all API routes

**Component Tests (Jest + React Testing Library)**
- Test AIInsightCard, AIBudgetCoach, InsightsPage, RefreshInsightsButton
- Test responsive behavior at different breakpoints
- Test user interactions (dismiss, expand, filter, search)
- Coverage goal: 80%+ for all insight-related components

**End-to-End Tests (Playwright - Optional for Phase 1)**
- User journey: Generate insights → view on dashboard → navigate to insights page → dismiss insight
- Test scheduled generation workflow (mock cron trigger)
- Test manual refresh workflow with rate limiting

**Manual Testing**
- Coaching tone review: Read all generated insight text for tone consistency
- Visual QA: Verify responsive design on mobile, tablet, desktop
- Accessibility: Test keyboard navigation and screen reader compatibility
- Performance: Measure actual insight generation time (<2s requirement)

### Acceptance Criteria Coverage

| AC | Primary Test Type | Key Test Cases |
|---|---|---|
| AC1 | Unit + Integration | Test each of 4 rule types with mock data; verify rule triggering thresholds |
| AC2 | Unit + Integration | Test statistical functions (mean, stdDev, MoM); verify database schema compliance |
| AC3 | Integration + E2E | Test cron job execution; test cache hit/miss; test 10-transaction trigger |
| AC4 | Component + E2E | Test AIBudgetCoach displays top 3 insights; test color coding; test responsive layout |
| AC5 | Component + Integration | Test filtering, search, pagination; test dismiss/undismiss functionality |
| AC6 | Component | Test metadata rendering by insight type; test accordion/modal expansion |
| AC7 | Integration | Test scheduled job runs at midnight UTC; verify <2s generation time |
| AC8 | Component + Integration | Test manual refresh button; test rate limiting (5-minute window); test toast notifications |
| AC9 | Manual | Review all insight text for coaching tone; verify non-judgmental language |

### Critical Edge Cases and Scenarios

**Edge Case Testing:**
1. **Minimal Data**: User with only 1-2 transactions
   - Expected: No insights generated or clear empty state
2. **Outlier Transactions**: Single $5000 transaction in $50 average category
   - Expected: Unusual expense insight triggered, but doesn't skew MoM calculations
3. **New Category**: User creates new category mid-month
   - Expected: No insights for that category until sufficient history exists
4. **Zero Spending**: User has $0 spending in a category for a month
   - Expected: Positive reinforcement insight (if budget exists)
5. **Negative Amounts**: Refunds or returns
   - Expected: Handled gracefully in statistical calculations
6. **Missing Category**: Transaction without category assignment
   - Expected: Excluded from category-based insights
7. **Same-Day Refresh**: User clicks refresh twice within 1 minute
   - Expected: Rate limiting blocks second request with clear feedback
8. **Cron Failure**: Scheduled job fails to execute
   - Expected: Retry logic or alerting (monitoring)

**Performance Testing:**
- Insight generation with 1000+ transactions: <2s response time (AC7, NFR FR20)
- Dashboard load with 100+ insights: <500ms to display top 3 (NFR FR19)
- Insights page with pagination: Smooth infinite scroll or pagination

**Security Testing:**
- RLS enforcement: User A cannot access User B's insights
- Rate limiting: Verify 5-minute window enforced server-side
- Input validation: Test API endpoints with malformed requests (missing fields, invalid types)

### Test Data Requirements

**Mock Transaction Data Sets:**
1. **Sparse Dataset**: 5 transactions over 2 months
2. **Steady Dataset**: 50 transactions/month with consistent spending
3. **Volatile Dataset**: Highly variable spending (20-200% month-over-month changes)
4. **Outlier Dataset**: Mix of typical transactions + 2-3 extreme outliers
5. **Multi-Category Dataset**: Transactions across all 10 categories

**Expected Insights for Test Datasets:**
- Spending increase insight when MoM change >20%
- Budget recommendation insight after 3 months of data
- Unusual expense insight when transaction >2 stdDev from mean
- Positive reinforcement insight when spending <90% of budget

### Success Criteria for Test Coverage

1. **Unit Test Coverage**: ≥90% for all business logic files
2. **Integration Test Coverage**: ≥85% for all API routes
3. **Component Test Coverage**: ≥80% for all insight UI components
4. **All 9 Acceptance Criteria**: Have at least 1 corresponding automated test
5. **All Critical Edge Cases**: Covered by unit or integration tests
6. **Performance Benchmarks**: <2s insight generation verified in CI/CD pipeline
7. **Manual Review Checklist**: Coaching tone validated before each release

### Testing Tools and Setup

- **Unit/Integration/Component**: Jest 29+, React Testing Library, Supertest
- **E2E (Optional Phase 1)**: Playwright
- **Database**: Supabase test database or local PostgreSQL with test seed data
- **Caching**: Redis mock (jest-redis-mock) or Upstash test instance
- **CI/CD**: GitHub Actions running test suite on every PR
- **Manual Testing**: QA checklist document for coaching tone and visual QA

---

## Post-Review Follow-ups

This section tracks action items identified during code reviews that need to be addressed.

### Story 6.3 Review Follow-ups (2025-12-05)

**Source:** Senior Developer Review - Story 6.3: Full AI Insights Page with Filtering

**Code Changes Required:**

1. **[MEDIUM] Implement pagination UI or infinite scroll** (AC #7)
   - **Story**: 6.3
   - **Files**: `src/components/insights/InsightsList.tsx` or `InsightsPageContent.tsx`
   - **Description**: Add pagination controls (Next/Previous buttons + page numbers) OR implement infinite scroll with `react-infinite-scroll-component`
   - **Rationale**: API supports pagination but no UI controls exist; potential performance issue with 100+ insights
   - **Status**: Open

**Testing Required:**

2. **[MEDIUM] Component tests for InsightsList**
   - **Story**: 6.3
   - **File**: `__tests__/components/insights/InsightsList.test.tsx`
   - **Tests**: Rendering order, loading state, empty state, date formatting
   - **Status**: Open

3. **[MEDIUM] Component tests for InsightsFilters**
   - **Story**: 6.3
   - **File**: `__tests__/components/insights/InsightsFilters.test.tsx`
   - **Tests**: Type filter, dismissed toggle, search debouncing (300ms), callbacks
   - **Status**: Open

4. **[MEDIUM] Component tests for EmptyInsightsState**
   - **Story**: 6.3
   - **File**: `__tests__/components/insights/EmptyInsightsState.test.tsx`
   - **Tests**: Message display, conditional icon, filter text
   - **Status**: Open

5. **[LOW] API tests for undismiss endpoint**
   - **Story**: 6.3
   - **File**: `__tests__/app/api/insights/[id]/undismiss.test.ts`
   - **Tests**: Auth (401), UUID validation (400), RLS (404), success (200)
   - **Status**: Open
