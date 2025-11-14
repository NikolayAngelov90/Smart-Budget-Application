# Smart-Budget-Application - Technical Architecture

**Author:** Niki
**Date:** 2025-11-14
**Version:** 1.0
**Status:** Approved

---

## Executive Summary

Smart Budget Application is a full-stack web application built with Next.js, Supabase, and Chakra UI. The architecture prioritizes rapid development, real-time updates, and excellent user experience while maintaining the core goals of sub-30-second transaction entry, AI-powered insights, and visual intelligence dashboards.

**Core Architectural Principles:**

1. **Full-Stack Next.js** - Unified frontend and backend with App Router for optimal performance
2. **Cloud-Native** - Supabase provides PostgreSQL database, authentication, and real-time subscriptions
3. **Performance-First** - <2s load time, <200ms transaction saves, optimistic UI updates
4. **Type-Safe Development** - Full TypeScript coverage with strict mode
5. **Accessibility by Default** - WCAG 2.1 Level A minimum compliance with Chakra UI

**Key Technology Stack:**

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Frontend** | Next.js (React) | 15+ | SSR, App Router, optimal DX |
| **UI Framework** | Chakra UI | 2.8+ | Accessibility, components, Trust Blue theme |
| **Database** | Supabase (PostgreSQL) | Latest | Managed DB, auth, real-time |
| **Authentication** | Supabase Auth | Latest | Integrated auth with RLS |
| **Charts** | Recharts | 2.12+ | React-first, SVG quality |
| **Forms** | React Hook Form | 7+ | Performance, validation |
| **Deployment** | Vercel | Latest | Next.js optimized hosting |

## Project Initialization

First implementation story should execute:
```bash
npx create-next-app@latest smart-budget-application --example https://github.com/agustinusnathaniel/nextarter-chakra
```

This establishes the base architecture with these decisions:
- Language/TypeScript: Provided by starter
- Styling solution: Chakra UI (Provided by starter)
- Testing framework: Not provided by starter
- Linting/Formatting: ESLint and Prettier (Provided by starter)
- Build tooling: Next.js build system (Provided by starter)
- Project structure: Next.js project structure (Provided by starter)

## Decision Summary

| # | Category | Decision | Version | Affects Epics | Rationale |
|---|----------|----------|---------|---------------|-----------|
| **1** | Frontend Framework | Next.js (App Router) | 15+ | All | SSR/SSG, API routes, optimal React DX, Vercel integration |
| **2** | UI Framework | Chakra UI | 2.8+ | All | WCAG 2.1 compliant, customizable, matches UX spec Trust Blue theme |
| **3** | Data Persistence | Supabase PostgreSQL | 2.81.1 | All | Managed database, real-time subscriptions, RLS security |
| **4** | Authentication | Supabase Auth | Latest | User Auth | Email/password + social login, integrated with database RLS |
| **5** | State Management | React Context + SWR | Latest | All | Server state caching, optimistic updates, automatic revalidation |
| **6** | Charts Library | Recharts | 2.12+ | Dashboard, AI Insights | React-first API, composable, SVG quality |
| **7** | Form Handling | React Hook Form + Zod | 7+ / 3+ | Transactions, Categories | Performance, validation, TypeScript integration |
| **8** | Date Handling | date-fns | 3+ | All | Lightweight, tree-shakeable, immutable |
| **9** | Testing | Jest + React Testing Library | Latest | All | Industry standard, great DX |
| **10** | Deployment | Vercel | N/A | All | Next.js optimized, preview deploys, edge functions |
| **11** | AI Engine | Server-side rules engine | N/A | AI Insights | Deterministic insights, no third-party APIs |



## Project Structure

The project uses a feature-based structure within the Next.js App Router pattern for better scalability and co-location of related code.

```
smart-budget-application/
├── .next/                          # Next.js build output (gitignored)
├── public/                         # Static assets
│   ├── icons/                      # PWA icons, category icons
│   └── manifest.json               # PWA manifest (optional Phase 2)
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Auth route group
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/            # Dashboard route group
│   │   │   ├── page.tsx            # Dashboard page (/)
│   │   │   ├── transactions/
│   │   │   │   └── page.tsx        # Transactions list page
│   │   │   ├── categories/
│   │   │   │   └── page.tsx        # Categories management
│   │   │   ├── insights/
│   │   │   │   └── page.tsx        # AI Insights page
│   │   │   ├── settings/
│   │   │   │   └── page.tsx        # Settings & export
│   │   │   └── layout.tsx          # Dashboard layout (sidebar)
│   │   ├── api/                    # API Routes
│   │   │   ├── transactions/
│   │   │   │   ├── route.ts        # GET /api/transactions, POST
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts    # PUT/DELETE /api/transactions/:id
│   │   │   ├── categories/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── insights/
│   │   │   │   └── route.ts        # POST /api/insights (generate)
│   │   │   └── export/
│   │   │       ├── csv/route.ts
│   │   │       └── pdf/route.ts
│   │   ├── layout.tsx              # Root layout
│   │   ├── providers.tsx           # Chakra, SWR providers
│   │   └── globals.css             # Global styles
│   │
│   ├── components/                 # Shared React components
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx       # Main app wrapper
│   │   │   ├── Sidebar.tsx         # Sidebar navigation
│   │   │   ├── Header.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── transactions/
│   │   │   ├── TransactionCard.tsx     # Custom component #1
│   │   │   ├── TransactionForm.tsx
│   │   │   ├── TransactionList.tsx
│   │   │   ├── QuickAmountInput.tsx    # Custom component #6
│   │   │   └── DateQuickPicker.tsx     # Custom component #7
│   │   ├── dashboard/
│   │   │   ├── StatCard.tsx            # Custom component #2
│   │   │   ├── DashboardStats.tsx
│   │   │   ├── ChartContainer.tsx      # Custom component #5
│   │   │   ├── SpendingByCategory.tsx  # Recharts pie chart
│   │   │   └── SpendingTrends.tsx      # Recharts line chart
│   │   ├── categories/
│   │   │   ├── CategorySelector.tsx    # Custom component #3
│   │   │   ├── CategoryBadge.tsx
│   │   │   └── CategoryManager.tsx
│   │   ├── insights/
│   │   │   ├── AIInsightCard.tsx       # Custom component #4
│   │   │   └── InsightsList.tsx
│   │   ├── common/
│   │   │   ├── FloatingActionButton.tsx # Custom component #8
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── forms/
│   │       └── FormField.tsx
│   │
│   ├── lib/                        # Business logic & utilities
│   │   ├── supabase/
│   │   │   ├── client.ts           # Supabase client (browser)
│   │   │   ├── server.ts           # Supabase server client
│   │   │   └── middleware.ts       # Auth middleware
│   │   ├── services/
│   │   │   ├── transactionService.ts
│   │   │   ├── categoryService.ts
│   │   │   ├── insightService.ts   # AI insights generator
│   │   │   └── exportService.ts    # CSV/PDF export
│   │   ├── ai/
│   │   │   ├── insightRules.ts     # Business rules for insights
│   │   │   ├── spendingAnalysis.ts
│   │   │   └── budgetRecommendations.ts
│   │   ├── utils/
│   │   │   ├── dateUtils.ts
│   │   │   ├── formatters.ts       # Currency, number formatting
│   │   │   ├── validators.ts
│   │   │   └── constants.ts
│   │   └── hooks/
│   │       ├── useTransactions.ts
│   │       ├── useCategories.ts
│   │       ├── useInsights.ts
│   │       ├── useBreakpoint.ts
│   │       └── useDebounce.ts
│   │
│   ├── types/                      # TypeScript definitions
│   │   ├── database.types.ts       # Supabase generated types
│   │   ├── transaction.types.ts
│   │   ├── category.types.ts
│   │   ├── insight.types.ts
│   │   └── index.ts
│   │
│   ├── theme/                      # Chakra UI theme
│   │   ├── index.ts                # Main theme export
│   │   ├── colors.ts               # Trust Blue palette
│   │   ├── components/             # Component overrides
│   │   │   ├── button.ts
│   │   │   ├── input.ts
│   │   │   └── card.ts
│   │   └── foundations.ts
│   │
│   └── __tests__/                  # Tests
│       ├── components/
│       ├── services/
│       └── utils/
│
├── supabase/                       # Supabase configuration
│   ├── migrations/                 # Database migrations
│   │   └── 001_initial_schema.sql
│   ├── seed.sql                    # Seed data (default categories)
│   └── config.toml
│
├── .env.local.example              # Environment variables template
├── .eslintrc.json
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

**8 Custom Components (from UX Spec):**
1. **TransactionCard** - Display transaction in list with swipe-to-delete
2. **StatCard** - Financial metrics with trend indicators
3. **CategorySelector** - Quick category selection with recent categories first
4. **AIInsightCard** - AI recommendation cards with coaching tone
5. **ChartContainer** - Wrapper for Recharts with loading/error states
6. **QuickAmountInput** - Optimized numeric input with currency formatting
7. **DateQuickPicker** - Fast date selection (Today, Yesterday, custom)
8. **FloatingActionButton** - Always-accessible "Add Transaction" FAB

## Epic to Architecture Mapping

Since we don't have epics defined yet, this section will be updated once the epics are created.



## Technology Stack Details

### Core Technologies

### Core Technologies

- **Framework:** Next.js (React)
- **Styling:** Chakra UI
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Real-time:** Supabase Realtime
- **Deployment:** Vercel

### Integration Points

- **Frontend to Backend:** The Next.js frontend will communicate with the backend API routes using REST.
- **Backend to Database:** The backend will use the `@supabase/supabase-js` library to interact with the Supabase PostgreSQL database.
- **Authentication:** The frontend will use `@supabase/supabase-js` to interact with Supabase Auth for user authentication.
- **Real-time:** The frontend will use `@supabase/supabase-js` to subscribe to real-time updates from the Supabase database.





## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:



## Consistency Rules

### Naming Conventions

- **Components:** PascalCase (e.g., `TransactionCard.tsx`)
- **Files:** kebab-case (e.g., `transaction-card.tsx`) for all files except components.
- **Variables:** camelCase (e.g., `const transactionAmount = 100;`)
- **API Endpoints:** kebab-case and plural (e.g., `/api/transactions`)

### Code Organization

- Components will be organized by feature in the `src/components` directory.
- Each component will have its own directory with the component file and a separate style file if needed.



### Error Handling

### Error Handling

We will use a consistent error handling approach throughout the application.
- **API:** API endpoints will return standard HTTP status codes (e.g., 400 for bad requests, 401 for unauthorized, 404 for not found, 500 for server errors). The response body will contain a JSON object with an `error` key.
- **Frontend:** The frontend will handle API errors gracefully and display user-friendly messages. We will use Chakra UI's `Alert` component to display errors.

### Logging Strategy

We will use a structured logging approach.
- **API:** We will use a library like `pino` to log requests, errors, and other important events.
- **Frontend:** We will use the browser's `console.log`, `console.warn`, and `console.error` for logging during development. In production, we can integrate with a logging service like Sentry or LogRocket.

### Date/Time Handling

- All dates and times will be stored in the database in UTC.
- The frontend will be responsible for displaying dates and times in the user's local timezone.
- We will use a library like `date-fns` or `day.js` for date and time manipulation.

### API Response Format

- Successful responses (2xx) will return a JSON object with a `data` key containing the requested data.
- Error responses (4xx, 5xx) will return a JSON object with an `error` key containing an error message.

### Testing Strategy

- **Unit Tests:** We will use `jest` and `react-testing-library` to write unit tests for our React components and utility functions.
- **Integration Tests:** We will write integration tests to verify the interaction between different parts of the application (e.g., frontend and API).
- **End-to-End (E2E) Tests:** We will use a framework like `Cypress` or `Playwright` to write E2E tests that simulate user flows.

{{error_handling_approach}}



## Data Architecture

### Database Schema

The application uses PostgreSQL via Supabase with Row Level Security (RLS) to ensure data privacy.

**Entity Relationship Diagram:**
```
┌──────────────────┐
│ users (Supabase) │
│ ─────────────────│
│ id (PK, UUID)    │
│ email            │
│ created_at       │
└──────────────────┘
         │
         │ 1:N
         │
         ├─────────────────────────────┐
         │                             │
         ▼                             ▼
┌─────────────────────┐       ┌──────────────────┐
│ transactions        │ N:1   │ categories       │
│ ─────────────────── │ ───── │ ──────────────── │
│ id (PK, UUID)       │       │ id (PK, UUID)    │
│ user_id (FK)        │       │ user_id (FK)     │
│ category_id (FK)    │       │ name             │
│ amount (DECIMAL)    │       │ color            │
│ type (ENUM)         │       │ type (ENUM)      │
│ date (DATE)         │       │ is_predefined    │
│ notes (TEXT)        │       │ created_at       │
│ created_at          │       └──────────────────┘
│ updated_at          │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│ insights            │
│ ─────────────────── │
│ id (PK, UUID)       │
│ user_id (FK)        │
│ title               │
│ description         │
│ type                │
│ priority            │
│ is_dismissed        │
│ created_at          │
└─────────────────────┘
```

**Detailed Schema:**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Transaction types enum
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

-- Insight types enum
CREATE TYPE insight_type AS ENUM ('spending_increase', 'budget_recommendation', 'unusual_expense', 'positive_reinforcement');

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color e.g., #f56565
  type transaction_type NOT NULL,
  is_predefined BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name, type)
);

-- Create index for faster category lookups
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(user_id, type);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  type transaction_type NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category_id);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);

-- Insights table
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  type insight_type NOT NULL,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  is_dismissed BOOLEAN DEFAULT false,
  metadata JSONB, -- Additional data (category_id, amounts, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_insights_user_id ON insights(user_id, is_dismissed);

-- Row Level Security (RLS) Policies

-- Categories RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own non-predefined categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id AND is_predefined = false);

CREATE POLICY "Users can delete their own non-predefined categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id AND is_predefined = false);

-- Transactions RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Insights RLS
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own insights"
  ON insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights"
  ON insights FOR UPDATE
  USING (auth.uid() = user_id);

-- Updated_at trigger for transactions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Seed Data (Default Categories):**

```sql
-- This will be run for each new user via a trigger or onboarding flow
INSERT INTO categories (user_id, name, color, type, is_predefined) VALUES
  -- Expense categories
  (auth.uid(), 'Dining', '#f56565', 'expense', true),
  (auth.uid(), 'Transport', '#4299e1', 'expense', true),
  (auth.uid(), 'Entertainment', '#9f7aea', 'expense', true),
  (auth.uid(), 'Utilities', '#48bb78', 'expense', true),
  (auth.uid(), 'Shopping', '#ed8936', 'expense', true),
  (auth.uid(), 'Healthcare', '#38b2ac', 'expense', true),
  (auth.uid(), 'Rent', '#e53e3e', 'expense', true),
  -- Income categories
  (auth.uid(), 'Salary', '#38a169', 'income', true),
  (auth.uid(), 'Freelance', '#4299e1', 'income', true),
  (auth.uid(), 'Investment', '#9f7aea', 'income', true),
  (auth.uid(), 'Gift', '#f56565', 'income', true);
```

**TypeScript Types (generated from Supabase):**

```typescript
// types/database.types.ts (generated via supabase gen types typescript)
export type TransactionType = 'income' | 'expense';
export type InsightType = 'spending_increase' | 'budget_recommendation' | 'unusual_expense' | 'positive_reinforcement';

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          amount: number;
          type: TransactionType;
          date: string; // ISO date string
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          type: TransactionType;
          date?: string;
          notes?: string | null;
        };
        Update: {
          category_id?: string;
          amount?: number;
          type?: TransactionType;
          date?: string;
          notes?: string | null;
        };
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          type: TransactionType;
          is_predefined: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color: string;
          type: TransactionType;
          is_predefined?: boolean;
        };
      };
      insights: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          type: InsightType;
          priority: number;
          is_dismissed: boolean;
          metadata: Record<string, any> | null;
          created_at: string;
        };
      };
    };
  };
}
```

## API Contracts

All API routes are located in `src/app/api/` and follow Next.js App Router conventions. Authentication is handled via Supabase Auth middleware.

### Transactions API

**GET /api/transactions**
```typescript
// Query params: ?startDate=2025-01-01&endDate=2025-01-31&category=uuid&type=income|expense
Response: {
  data: Transaction[];
  count: number;
}
```

**POST /api/transactions**
```typescript
Request: {
  amount: number;
  type: 'income' | 'expense';
  category_id: string;
  date: string; // ISO date
  notes?: string;
}
Response: {
  data: Transaction;
}
```

**PUT /api/transactions/:id**
```typescript
Request: Partial<{
  amount: number;
  category_id: string;
  date: string;
  notes: string;
}>
Response: {
  data: Transaction;
}
```

**DELETE /api/transactions/:id**
```typescript
Response: {
  success: boolean;
}
```

### Categories API

**GET /api/categories**
```typescript
// Query params: ?type=income|expense
Response: {
  data: Category[];
}
```

**POST /api/categories**
```typescript
Request: {
  name: string;
  color: string; // Hex color
  type: 'income' | 'expense';
}
Response: {
  data: Category;
}
```

**PUT /api/categories/:id**
```typescript
Request: Partial<{
  name: string;
  color: string;
}>
Response: {
  data: Category;
}
```

**DELETE /api/categories/:id**
```typescript
// Only allows deletion of non-predefined categories
Response: {
  success: boolean;
}
```

### AI Insights API

**POST /api/insights/generate**
```typescript
// Generates new AI insights for the authenticated user
Request: {
  forceRegenerate?: boolean; // Optional: bypass cache
}
Response: {
  data: Insight[];
  generated_at: string;
}
```

**PUT /api/insights/:id/dismiss**
```typescript
Response: {
  success: boolean;
}
```

### Export API

**GET /api/export/csv**
```typescript
// Query params: ?startDate=2025-01-01&endDate=2025-01-31
Response: CSV file download
Content-Type: text/csv
Content-Disposition: attachment; filename="transactions-2025-01.csv"
```

**POST /api/export/pdf**
```typescript
Request: {
  month: string; // YYYY-MM format
}
Response: PDF file download
Content-Type: application/pdf
Content-Disposition: attachment; filename="budget-report-2025-01.pdf"
```

### Error Response Format

All errors follow a consistent format:

```typescript
Response (4xx/5xx): {
  error: {
    message: string;
    code?: string;
    details?: any;
  }
}
```

**Common Error Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., category name already exists)
- `500` - Internal Server Error

## Security Architecture

## Security Architecture

- **Authentication:** We will use Supabase Auth with email/password and social login providers.
- **Authorization:** We will use Supabase's Row Level Security (RLS) to enforce data access policies at the database level.
- **Data Protection:** All communication between the client and server will be encrypted using HTTPS. Sensitive data will be encrypted at rest.

## Performance Architecture

### Performance Targets (from PRD)

**Load Time:**
- Initial page load: **< 2 seconds** on 3G connection
- Dashboard rendering: **< 1 second** after page load
- Transaction form: **< 500ms** to interactive

**Response Time:**
- Transaction save: **< 200ms** perceived time (optimistic UI)
- Chart updates: **< 300ms** after data change
- Search/filter: **< 500ms** for typical datasets
- AI insight generation: **< 2 seconds**

**Bundle Size:**
- No explicit limit (cloud-hosted, not PWA)
- Target: Reasonable code splitting for optimal load times

### Optimization Strategies

**Frontend Optimizations:**

1. **Code Splitting** - Next.js automatic route-based splitting
```typescript
// Lazy load heavy components
const SpendingByCategory = dynamic(() => import('@/components/dashboard/SpendingByCategory'), {
  loading: () => <Skeleton height="300px" />
});
```

2. **Server-Side Rendering** - Initial dashboard data from server
```typescript
// app/(dashboard)/page.tsx
export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const { data: transactions } = await supabase.from('transactions').select('*');
  return <Dashboard initialData={transactions} />;
}
```

3. **Optimistic UI Updates** - Immediate feedback for transactions
```typescript
// Optimistic update pattern
const handleCreate = async (transaction) => {
  const tempId = crypto.randomUUID();
  mutate([...transactions, { ...transaction, id: tempId }], false); // Update UI immediately
  await createTransaction(transaction); // Then persist
  mutate(); // Revalidate
};
```

4. **SWR for Data Fetching** - Automatic caching and revalidation
```typescript
// lib/hooks/useTransactions.ts
export function useTransactions() {
  return useSWR('/api/transactions', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000
  });
}
```

**Backend Optimizations:**

1. **Database Indexing** - Indexes on frequently queried columns
```sql
CREATE INDEX idx_transactions_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category_id);
```

2. **Query Optimization** - Efficient joins and selections
```typescript
// Only select needed columns
const { data } = await supabase
  .from('transactions')
  .select('id, amount, date, categories(name, color)')
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date', { ascending: false });
```

3. **Caching Strategy** - Cache AI insights for 1 hour
```typescript
// Simple in-memory cache for insights (upgrade to Redis in Phase 2)
const insightsCache = new Map<string, { data: Insight[], timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
```

**Chart Performance:**

1. **Data Aggregation on Server** - Reduce client-side computation
```typescript
// API route aggregates data before sending to client
export async function GET(req: Request) {
  // Aggregate transactions by category in database query
  const { data } = await supabase.rpc('get_spending_by_category', {
    start_date: startDate,
    end_date: endDate
  });
  return Response.json({ data });
}
```

2. **Memoization** - Prevent unnecessary recalculations
```typescript
const chartData = useMemo(() => {
  return transactions.reduce((acc, t) => {
    // ... aggregation logic
  }, []);
}, [transactions]);
```

## AI Insights Architecture

### Rule-Based Insights Engine

The AI insights system uses deterministic rules rather than machine learning for the MVP. This ensures predictable, trustworthy insights without third-party API dependencies.

**Insight Rules (from PRD FR29-FR37):**

1. **Spending Increase Detection** (Priority: High)
```typescript
// Detect >20% month-over-month increase in category
if (currentMonthSpending > previousMonthSpending * 1.2) {
  generateInsight({
    type: 'spending_increase',
    title: `${categoryName} spending increased 40%`,
    description: `You spent $${current} this month, up from $${previous} last month. Consider setting a $${recommended} monthly limit.`,
    priority: 4
  });
}
```

2. **Budget Limit Recommendations** (Priority: Medium)
```typescript
// Based on 3-month average + 10% buffer
const avgSpending = calculateAverage(last3Months);
const recommendedLimit = avgSpending * 1.1;
generateInsight({
  type: 'budget_recommendation',
  title: `Set a budget for ${categoryName}`,
  description: `Based on your spending pattern ($${avgSpending}/month average), consider a $${recommendedLimit} monthly budget.`,
  priority: 3
});
```

3. **Unusual Expense Flagging** (Priority: High)
```typescript
// Detect transactions >2 standard deviations from mean
if (transaction.amount > (mean + 2 * stdDev)) {
  generateInsight({
    type: 'unusual_expense',
    title: `Unusual ${categoryName} expense detected`,
    description: `$${transaction.amount} is significantly higher than your typical ${categoryName} spending ($${mean} average).`,
    priority: 5
  });
}
```

4. **Positive Reinforcement** (Priority: Low)
```typescript
// Celebrate under-budget categories
if (currentSpending < budgetLimit * 0.9) {
  generateInsight({
    type: 'positive_reinforcement',
    title: `Great job on ${categoryName}!`,
    description: `You're ${percentage}% under budget. You've saved $${saved} this month.`,
    priority: 2
  });
}
```

**Implementation Location:**
- `lib/ai/insightRules.ts` - Rule definitions
- `lib/ai/spendingAnalysis.ts` - Statistical calculations (mean, stddev, trends)
- `lib/ai/budgetRecommendations.ts` - Budget calculation logic
- `lib/services/insightService.ts` - Main service that runs all rules

**Caching Strategy:**
- Insights cached for 1 hour per user
- Regenerate on: new month, >10 new transactions, manual refresh
- Cache invalidation on category changes

**Future Enhancements (Phase 2):**
- Machine learning models for pattern prediction
- Seasonal spending detection
- Anomaly detection using clustering
- Integration with external APIs (optional)

## Deployment Architecture

The application will be deployed to Vercel with automatic CI/CD pipelines.

**Deployment Workflow:**

1. **Production Deployment** (main branch)
   - Trigger: Push to `main` branch
   - Build: `npm run build`
   - Deploy: Automatic deployment to production URL
   - Database migrations: Run via Supabase CLI or migrations panel

2. **Preview Deployments** (feature branches)
   - Trigger: Push to any branch
   - Build: Full production build
   - Deploy: Unique preview URL
   - Database: Connects to same Supabase project (use separate project in future)

3. **Environment Variables** (stored in Vercel)
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
   SUPABASE_SERVICE_ROLE_KEY=xxx (server-only)
   ```

**Deployment Checklist:**
1. Run database migrations in Supabase dashboard
2. Seed default categories (if needed)
3. Verify environment variables in Vercel
4. Test authentication flow in production
5. Monitor error logging (Vercel logs + Sentry optional)

**Performance Monitoring:**
- Vercel Analytics for Core Web Vitals
- Supabase Dashboard for database query performance
- Error tracking (Sentry optional)

## Development Environment

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- A Supabase account

### Setup Commands

```bash
# 1. Clone the repository
git clone <repository-url>
cd smart-budget-application

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Add your Supabase credentials to .env.local

# 4. Start the development server
npm run dev
```

## Architecture Decision Records (ADRs)

### ADR-001: Data Persistence
- **Status:** Accepted
- **Date:** 2025-11-14
- **Context:** The application requires a database to store user data, transactions, categories, and other information. The database should be reliable, scalable, and easy to integrate with the chosen technology stack.
- **Decision:** We will use Supabase as the data persistence layer. Supabase provides a managed PostgreSQL database, which is a powerful and reliable relational database.
- **Consequences:**
    - We will use the `@supabase/supabase-js` library to interact with the database.
    - The database schema will be managed using Supabase's built-in tools or a separate migration tool.
    - We will rely on Supabase for database backups and maintenance.

### ADR-002: API Pattern
- **Status:** Accepted
- **Date:** 2025-11-14
- **Context:** The application needs a way for the frontend to communicate with the backend to fetch and manipulate data.
- **Decision:** We will use a RESTful API for communication between the frontend and backend. This aligns with the suggestion in the PRD and is a well-understood, standard approach.
- **Consequences:**
    - We will define API endpoints for each resource (e.g., `/api/transactions`, `/api/categories`).
    - We will use standard HTTP methods (GET, POST, PUT, DELETE) to interact with the resources.
    - The API will be documented using a tool like Swagger or OpenAPI.

### ADR-003: Authentication
- **Status:** Accepted
- **Date:** 2025-11-14
- **Context:** The application needs to manage user accounts and secure access to personal financial data.
- **Decision:** We will use Supabase Auth for user authentication. This integrates seamlessly with our chosen data persistence layer (Supabase) and simplifies the overall architecture.
- **Consequences:**
    - We will use the `@supabase/supabase-js` library for user sign-up, sign-in, and session management.
    - We will rely on Supabase's built-in security features, such as Row Level Security (RLS), to protect user data.
    - We can easily implement social login providers (e.g., Google, GitHub) through Supabase's configuration.

### ADR-004: Real-time
- **Status:** Accepted
- **Date:** 2025-11-14
- **Context:** The application's dashboard needs to update in real-time when new transactions are added or existing ones are modified.
- **Decision:** We will use Supabase Realtime to listen for database changes and update the frontend.
- **Consequences:**
    - We will use the `@supabase/supabase-js` library to subscribe to database changes.
    - This avoids the need to manage a separate WebSocket server.
    - We will need to design the frontend to handle real-time updates efficiently.

### ADR-005: Deployment Target
- **Status:** Accepted
- **Date:** 2025-11-14
- **Context:** The application needs to be deployed to a hosting platform that is reliable, scalable, and easy to use.
- **Decision:** We will deploy the application to Vercel. Vercel is a platform specialized in hosting Next.js applications and provides a seamless deployment experience.
- **Consequences:**
    - We will connect our GitHub repository to Vercel for continuous deployment.
    - Vercel will automatically build and deploy the application on every push to the main branch.
    - We will use Vercel's environment variable management to store our Supabase credentials and other secrets.

### ADR-006: Chart Library Selection
- **Status:** Accepted
- **Date:** 2025-11-14
- **Context:** The application requires interactive charts for data visualization (pie charts for category breakdown, line charts for trends). Options include Recharts, Chart.js, and Nivo.
- **Decision:** We will use Recharts for all data visualizations.
- **Rationale:**
    - **React-First API:** Composable components (`<PieChart><Pie /></PieChart>`) integrate naturally with React
    - **SVG Quality:** Vector graphics scale perfectly across all screen sizes and resolutions
    - **Matches UX Spec:** Specified in the UX Design Specification document
    - **Bundle Size:** ~80KB gzipped (acceptable for visual-first dashboard)
    - **TypeScript Support:** Full type definitions included
- **Consequences:**
    - Charts will be rendered as SVG (high quality, accessible)
    - May need optimization for very large datasets (>1000 points) via data sampling
    - Easier to customize and theme compared to Canvas-based alternatives

### ADR-007: State Management Strategy
- **Status:** Accepted
- **Date:** 2025-11-14
- **Context:** The application needs to manage server state (transactions, categories) and UI state (forms, modals). Options include Redux, Zustand, Jotai, and SWR/React Query.
- **Decision:** We will use SWR for server state management and React Context for UI state.
- **Rationale:**
    - **SWR for Server State:** Automatic caching, revalidation, and optimistic updates
    - **React Context for UI State:** Simple solution for theme, modal state, sidebar open/close
    - **No Redux Needed:** Application complexity doesn't justify Redux boilerplate
    - **Next.js Integration:** SWR works seamlessly with Next.js data fetching patterns
- **Consequences:**
    - Simpler codebase with less boilerplate
    - Built-in optimistic UI updates for perceived performance
    - Automatic background revalidation keeps data fresh
    - May need to upgrade to React Query if caching requirements become more complex

### ADR-008: Form Handling
- **Status:** Accepted
- **Date:** 2025-11-14
- **Context:** Transaction entry forms need to be performant, validated, and meet the <30 second entry time requirement. Options include Formik, React Hook Form, and plain React state.
- **Decision:** We will use React Hook Form with Zod for schema validation.
- **Rationale:**
    - **Performance:** Minimal re-renders (uncontrolled inputs) crucial for sub-30-second entry
    - **Validation:** Zod provides type-safe schema validation with TypeScript inference
    - **Bundle Size:** Smaller than Formik (~25KB vs ~45KB gzipped)
    - **DX:** Excellent TypeScript support and intuitive API
- **Consequences:**
    - Forms will have better performance (less re-renders)
    - Type-safe validation schemas that match TypeScript types
    - Need to handle Chakra UI integration (register pattern)

### ADR-009: Data Export
- **Status:** Accepted
- **Date:** 2025-11-14
- **Context:** Users need to export their transaction data to CSV and PDF formats (PRD FR39-FR40). Options include server-side generation, client-side libraries, or third-party services.
- **Decision:** We will use client-side libraries (papaparse for CSV, jsPDF for PDF) with server-side fallback option.
- **Rationale:**
    - **Privacy:** Data never leaves user's browser for export (unless they explicitly upload elsewhere)
    - **Performance:** Offloads export processing to client
    - **No Server Costs:** No additional server processing or storage
    - **Library Maturity:** Both papaparse and jsPDF are well-maintained and battle-tested
- **Consequences:**
    - Export processing happens in browser (may be slow for very large datasets)
    - PDF formatting limited by jsPDF capabilities (sufficient for MVP)
    - Could add server-side export endpoint in Phase 2 if needed



---

_Generated by BMAD Decision Architecture Workflow v1.0_
_Date: 2025-11-14_
_For: Niki_