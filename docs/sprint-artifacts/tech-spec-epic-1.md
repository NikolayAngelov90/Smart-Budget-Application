# Epic Technical Specification: Foundation & Infrastructure

Date: 2025-11-15
Author: Niki
Epic ID: 1
Status: Draft

---

## Overview

Epic 1 establishes the complete technical foundation for the Smart Budget Application, enabling all subsequent development work. This epic implements the core technology stack (Next.js + Supabase + Chakra UI), authentication infrastructure, database schema with Row Level Security, and automated deployment pipeline. The goal is to create a production-ready base that allows the development team to immediately begin implementing user-facing features in subsequent epics without any foundational blockers. This epic delivers zero direct user value but is absolutely critical - no other epic can begin until this foundation is complete.

## Objectives and Scope

**In Scope:**
- Next.js 15+ project initialization using Nextarter Chakra starter template
- Complete Supabase PostgreSQL database setup with 4 tables (users, transactions, categories, insights)
- Row Level Security (RLS) policies ensuring user data isolation
- Authentication configuration (email/password + Google/GitHub OAuth)
- Next.js middleware for route protection
- Automated CI/CD deployment pipeline to Vercel
- Environment variable configuration across all environments
- Trust Blue (#2b6cb0) Chakra UI theme customization
- Database indexes for query performance
- Migration scripts for schema management

**Out of Scope:**
- User-facing UI components (covered in Epic 2+)
- Business logic for transactions, categories, or insights (Epic 3-6)
- Data visualization or dashboards (Epic 5)
- AI insight generation rules (Epic 6)
- Export functionality (Epic 7)
- Mobile app or PWA setup (Phase 2)
- Advanced performance optimizations beyond baseline setup

## System Architecture Alignment

This epic implements the foundational layer of the architecture defined in [architecture.md](../architecture.md):

**Components Established:**
- **Frontend Framework:** Next.js 15+ with App Router pattern (ADR-001, ADR-002)
- **UI Framework:** Chakra UI 2.8+ with custom Trust Blue theme
- **Database:** Supabase PostgreSQL with full schema (transactions, categories, insights tables)
- **Authentication:** Supabase Auth with email/password and OAuth providers (ADR-003)
- **Deployment:** Vercel with automatic deployments from GitHub (ADR-005)

**Architecture Constraints Addressed:**
- TypeScript strict mode enabled for type safety
- Row Level Security (RLS) for multi-tenant data isolation (auth.uid() = user_id pattern)
- Environment-based configuration (.env.local for development, Vercel env vars for production)
- Project structure following Next.js App Router conventions with feature-based organization

**Referenced Architecture Decisions:**
- ADR-001 (Data Persistence - Supabase)
- ADR-002 (API Pattern - REST via Next.js API routes)
- ADR-003 (Authentication - Supabase Auth)
- ADR-005 (Deployment - Vercel)

## Detailed Design

### Services and Modules

| Module/Service | Responsibility | Inputs | Outputs | Owner/Location |
|---|---|---|---|---|
| **Nextarter Chakra Starter** | Project scaffold with Next.js + Chakra UI pre-configured | - | Project structure, dependencies, base config | `npx create-next-app` |
| **Supabase Client (Browser)** | Client-side database and auth interactions | API requests from frontend | Query results, auth state | `src/lib/supabase/client.ts` |
| **Supabase Client (Server)** | Server-side database queries (SSR, API routes) | Server requests | Query results with RLS | `src/lib/supabase/server.ts` |
| **Auth Middleware** | Route protection, session validation | HTTP requests | Redirect decisions, user context | `src/middleware.ts` |
| **Database Migrations** | Schema creation and versioning | SQL migration files | Updated database schema | `supabase/migrations/001_initial_schema.sql` |
| **Chakra Theme Provider** | Global UI theme configuration | Theme config object | Styled components | `src/theme/index.ts` |
| **Vercel Deployment Service** | CI/CD pipeline, build, deployment | Git push to main/branches | Production/preview URLs | Vercel platform (external) |
| **Environment Config** | Secret management, API keys | .env.local / Vercel env vars | Runtime configuration | `.env.local`, Vercel dashboard |

**Key Integration Points:**
- Supabase clients integrate with database via `@supabase/supabase-js` SDK
- Auth middleware intercepts all route requests via Next.js middleware.ts
- Chakra theme wraps entire app via providers.tsx
- Vercel automatically triggers builds on GitHub pushes

### Data Models and Contracts

**Database Schema** (PostgreSQL via Supabase):

```sql
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

-- Insights table
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  type insight_type NOT NULL,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  is_dismissed BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes for Performance:**
```sql
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(user_id, type);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category_id);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);
CREATE INDEX idx_insights_user_id ON insights(user_id, is_dismissed);
```

**Row Level Security Policies:**
```sql
-- Categories RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own non-predefined categories" ON categories FOR UPDATE USING (auth.uid() = user_id AND is_predefined = false);
CREATE POLICY "Users can delete their own non-predefined categories" ON categories FOR DELETE USING (auth.uid() = user_id AND is_predefined = false);

-- Transactions RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Insights RLS
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own insights" ON insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own insights" ON insights FOR UPDATE USING (auth.uid() = user_id);
```

**Seed Data** (Default Categories):
```sql
-- Executed for each new user via signup trigger
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

**TypeScript Types** (to be generated via `supabase gen types typescript`):
```typescript
export type TransactionType = 'income' | 'expense';
export type InsightType = 'spending_increase' | 'budget_recommendation' | 'unusual_expense' | 'positive_reinforcement';

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: { id: string; user_id: string; category_id: string; amount: number; type: TransactionType; date: string; notes: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; user_id: string; category_id: string; amount: number; type: TransactionType; date?: string; notes?: string | null; };
        Update: { category_id?: string; amount?: number; type?: TransactionType; date?: string; notes?: string | null; };
      };
      categories: {
        Row: { id: string; user_id: string; name: string; color: string; type: TransactionType; is_predefined: boolean; created_at: string; };
        Insert: { id?: string; user_id: string; name: string; color: string; type: TransactionType; is_predefined?: boolean; };
      };
      insights: {
        Row: { id: string; user_id: string; title: string; description: string; type: InsightType; priority: number; is_dismissed: boolean; metadata: Record<string, any> | null; created_at: string; };
      };
    };
  };
}
```

### APIs and Interfaces

**No API endpoints created in Epic 1.** This epic establishes the infrastructure; API routes will be implemented in subsequent epics (Epic 2-7).

**Supabase Client Interfaces:**
```typescript
// src/lib/supabase/client.ts (browser)
import { createBrowserClient } from '@supabase/ssr';
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// src/lib/supabase/server.ts (server components, API routes)
import { createServerClient } from '@supabase/ssr';
export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: /* cookie handlers */ }
  );
}
```

**Auth Configuration:**
- Email/password provider enabled in Supabase dashboard
- Google OAuth: Client ID and Secret configured
- GitHub OAuth: Client ID and Secret configured
- Redirect URLs: `/auth/callback` for OAuth flows

### Workflows and Sequencing

**Story 1.1: Project Initialization**
1. Developer runs `npx create-next-app` with Nextarter Chakra template
2. Template creates project structure with Next.js + Chakra UI pre-configured
3. Developer installs dependencies (`npm install`)
4. Developer configures TypeScript strict mode in `tsconfig.json`
5. Developer runs `npm run dev` to verify setup
6. Developer commits initial project to Git

**Story 1.2: Supabase Setup**
1. Developer creates Supabase project at supabase.com
2. Developer runs migration SQL to create tables, indexes, RLS policies
3. Developer creates `.env.local` with Supabase URL and keys
4. Developer installs `@supabase/supabase-js` and `@supabase/ssr`
5. Developer creates client.ts and server.ts Supabase clients
6. Developer tests database connection with simple query

**Story 1.3: Authentication Configuration**
1. Developer enables email/password auth in Supabase dashboard
2. Developer configures Google OAuth (client ID/secret)
3. Developer configures GitHub OAuth (client ID/secret)
4. Developer creates Next.js middleware.ts for route protection
5. Developer sets up auth route groups: (auth) and (dashboard)
6. Developer tests auth flows (signup, login, logout, token refresh)

**Story 1.4: Deployment Pipeline**
1. Developer pushes code to GitHub repository
2. Developer connects GitHub repo to Vercel
3. Developer configures environment variables in Vercel dashboard
4. Vercel automatically builds and deploys on push to main
5. Developer verifies production deployment at Vercel URL
6. Developer tests preview deployments on feature branches

**Sequencing:** Stories 1.1 → 1.2 → 1.3 → 1.4 (strict sequence, no parallelization possible)

## Non-Functional Requirements

### Performance

- **Build Time:** < 2 minutes for production build on Vercel (baseline, no optimizations yet)
- **Initial Load:** No specific target in Epic 1 (empty app); <2s target applies after Epic 5 dashboard
- **Database Query Performance:** Indexes configured for <100ms queries on typical datasets (up to 10K transactions)
- **Type Generation:** `supabase gen types` completes in <30 seconds

**Note:** Performance targets for user-facing features (transaction save <200ms, dashboard load <2s) apply to later epics.

### Security

- **Authentication:** Supabase Auth with JWT tokens, session management, automatic token refresh
- **Authorization:** Row Level Security (RLS) enforces `auth.uid() = user_id` at database level
- **Data Protection:** HTTPS enforced by Vercel (automatic TLS certificates)
- **Secret Management:**
  - Development: .env.local (gitignored)
  - Production: Vercel environment variables (encrypted at rest)
- **OAuth Security:** State parameter verification, PKCE flow for public clients
- **Session Timeout:** 30 days for "remember me", 24 hours otherwise (configured in Supabase)
- **Password Requirements:** Enforced by Supabase Auth (minimum 8 characters)

### Reliability/Availability

- **Database:** Supabase managed PostgreSQL with automatic backups (daily)
- **Deployment:** Vercel edge network with automatic failover
- **Uptime Target:** Inherit Supabase (99.9%) and Vercel (99.99%) SLAs
- **Error Recovery:** Basic error boundaries configured; detailed error handling in later epics
- **Migration Rollback:** Database migrations support rollback via Supabase dashboard

### Observability

- **Logging:**
  - Development: Browser console.log
  - Production: Vercel logs (stdout/stderr captured)
- **Metrics:**
  - Vercel Analytics enabled for Core Web Vitals tracking
  - Supabase Dashboard for database query performance
- **Tracing:** Not implemented in Epic 1 (optional for Phase 2)
- **Error Tracking:** Console errors only; Sentry integration deferred to Phase 2

## Dependencies and Integrations

**Package Dependencies** (from `package.json`):
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@chakra-ui/react": "^2.8.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "framer-motion": "^10.16.0",
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/ssr": "^0.1.0",
    "typescript": "^5.3.0"
  },
  "devDependencies": {
    "eslint": "^8.56.0",
    "eslint-config-next": "^15.0.0",
    "prettier": "^3.1.0"
  }
}
```

**External Integrations:**
- **Supabase:** PostgreSQL database, Authentication, Real-time (project-specific URL)
- **Vercel:** Hosting, CI/CD, preview deployments (linked via GitHub integration)
- **Google OAuth:** Client ID and Secret from Google Cloud Console
- **GitHub OAuth:** Client ID and Secret from GitHub Developer Settings

**Version Constraints:**
- Node.js: >=18.17.0
- npm: >=9.0.0
- Next.js: 15+ (App Router required)
- Chakra UI: 2.8+ (v2 stable)
- Supabase JS: ^2.39 (latest stable)

## Acceptance Criteria (Authoritative)

**AC-1.1:** Project runs successfully in development mode (`npm run dev`) with no console errors

**AC-1.2:** TypeScript strict mode enabled and all type checks pass (`npm run type-check`)

**AC-1.3:** ESLint and Prettier configured and passing (`npm run lint`)

**AC-1.4:** Chakra UI Trust Blue theme (#2b6cb0) configured and rendering correctly

**AC-1.5:** Next.js App Router project structure established with (auth) and (dashboard) route groups

**AC-2.1:** Supabase project created with PostgreSQL database accessible

**AC-2.2:** All 4 tables created (users via Supabase Auth, transactions, categories, insights)

**AC-2.3:** All database indexes created and verified in Supabase dashboard

**AC-2.4:** Row Level Security (RLS) enabled on all tables

**AC-2.5:** RLS policies enforce `auth.uid() = user_id` constraint (verified via test query)

**AC-2.6:** Supabase connection successful from Next.js app (test query returns data)

**AC-2.7:** TypeScript types generated from Supabase schema (`types/database.types.ts` exists)

**AC-3.1:** Email/password authentication enabled and functional (test signup/login works)

**AC-3.2:** Google OAuth configured and functional (test login via Google works)

**AC-3.3:** GitHub OAuth configured and functional (test login via GitHub works)

**AC-3.4:** Next.js middleware redirects unauthenticated requests from protected routes

**AC-3.5:** Session persists across page refreshes (token stored in httpOnly cookie)

**AC-3.6:** Session timeout configured (30 days with "remember me", 24 hours otherwise)

**AC-4.1:** GitHub repository connected to Vercel

**AC-4.2:** Automatic deployment triggers on push to main branch

**AC-4.3:** Production build completes successfully in < 2 minutes

**AC-4.4:** Application accessible via Vercel production URL

**AC-4.5:** Environment variables configured in Vercel dashboard

**AC-4.6:** HTTPS enabled and working (Vercel automatic TLS)

**AC-4.7:** Preview deployments created for feature branches

## Traceability Mapping

| AC | Epic/Story | Component/Module | Test Verification |
|---|---|---|---|
| AC-1.1 | Story 1.1 | Next.js project setup | Manual: `npm run dev` executes without errors |
| AC-1.2 | Story 1.1 | TypeScript configuration | CI: `npm run type-check` in GitHub Actions |
| AC-1.3 | Story 1.1 | ESLint/Prettier config | CI: `npm run lint` in GitHub Actions |
| AC-1.4 | Story 1.1 | Chakra theme (`src/theme/`) | Manual: Visual inspection of Trust Blue color |
| AC-1.5 | Story 1.1 | Next.js route structure | Manual: Verify folder structure exists |
| AC-2.1 | Story 1.2 | Supabase project | Manual: Login to Supabase dashboard |
| AC-2.2 | Story 1.2 | Database schema | Manual: Verify tables in Supabase SQL editor |
| AC-2.3 | Story 1.2 | Database indexes | Manual: Check indexes tab in Supabase dashboard |
| AC-2.4 | Story 1.2 | RLS configuration | Manual: Verify RLS enabled in table settings |
| AC-2.5 | Story 1.2 | RLS policies | Integration test: Query as different users, verify isolation |
| AC-2.6 | Story 1.2 | Supabase clients | Unit test: `createClient().from('categories').select()` |
| AC-2.7 | Story 1.2 | Type generation | Manual: Run `supabase gen types`, verify file created |
| AC-3.1 | Story 1.3 | Email auth | E2E test: Signup flow with email/password |
| AC-3.2 | Story 1.3 | Google OAuth | Manual test: Login via Google (requires real OAuth) |
| AC-3.3 | Story 1.3 | GitHub OAuth | Manual test: Login via GitHub (requires real OAuth) |
| AC-3.4 | Story 1.3 | Auth middleware | Integration test: Access /dashboard without auth → redirect to /login |
| AC-3.5 | Story 1.3 | Session persistence | Manual test: Login, refresh page, verify still authenticated |
| AC-3.6 | Story 1.3 | Session timeout | Manual test: Verify config in Supabase dashboard |
| AC-4.1 | Story 1.4 | Vercel integration | Manual: Verify in Vercel dashboard |
| AC-4.2 | Story 1.4 | CI/CD pipeline | Manual: Push to main, verify deployment triggered |
| AC-4.3 | Story 1.4 | Build performance | Manual: Check build logs in Vercel, verify < 2 min |
| AC-4.4 | Story 1.4 | Production deployment | Manual: Visit Vercel URL, verify app loads |
| AC-4.5 | Story 1.4 | Environment config | Manual: Verify env vars in Vercel dashboard |
| AC-4.6 | Story 1.4 | HTTPS | Manual: Verify URL uses https:// protocol |
| AC-4.7 | Story 1.4 | Preview deployments | Manual: Create branch, push, verify preview URL created |

## Risks, Assumptions, Open Questions

**RISK-1:** Supabase project region selection impacts latency for international users
- **Mitigation:** Choose region closest to primary user base (US-East for MVP)
- **Severity:** Medium
- **Owner:** Infrastructure team

**RISK-2:** OAuth provider configuration may require domain verification or app review
- **Mitigation:** Complete Google/GitHub OAuth setup early in Story 1.3
- **Severity:** Medium
- **Owner:** Developer

**RISK-3:** Vercel free tier limits may be exceeded during development
- **Mitigation:** Monitor usage in Vercel dashboard, upgrade to Pro if needed
- **Severity:** Low
- **Owner:** Project sponsor

**ASSUMPTION-1:** Developers have access to Google Cloud Console and GitHub Developer Settings to create OAuth apps
- **Validation Required:** Confirm access before starting Story 1.3

**ASSUMPTION-2:** Team has GitHub repository already created
- **Validation Required:** Create repository before starting Story 1.4

**ASSUMPTION-3:** Supabase free tier (500MB database, 50K monthly active users) sufficient for MVP
- **Validation:** Monitor metrics post-launch

**QUESTION-1:** Should we set up a separate Supabase project for preview deployments?
- **Decision Needed:** Before Story 1.4 completion
- **Impact:** Data isolation between environments

**QUESTION-2:** Do we need custom email templates for Supabase Auth emails (verification, password reset)?
- **Decision Needed:** Story 1.3
- **Impact:** User experience, branding consistency

## Test Strategy Summary

**Unit Tests (Story 1.1, 1.2):**
- Supabase client initialization (`client.ts`, `server.ts`)
- TypeScript type checks pass across entire codebase
- ESLint rules configured correctly

**Integration Tests (Story 1.2, 1.3):**
- RLS policy enforcement: Verify users can only access their own data
- Auth middleware redirect logic: Unauthenticated → /login, Authenticated → allowed
- Database connection from Next.js: SELECT query returns expected data

**End-to-End Tests (Story 1.3, 1.4):**
- Email signup flow: Enter email/password → Verify email → Login successfully
- OAuth flow: Click "Login with Google" → Redirect to Google → Callback → Authenticated
- Deployment pipeline: Push to main → Build succeeds → App accessible at Vercel URL

**Manual Verification (All Stories):**
- Visual inspection of Chakra UI theme (Trust Blue colors)
- Supabase dashboard: Tables, indexes, RLS policies created
- Vercel dashboard: Deployment successful, environment variables configured
- OAuth provider consoles: Apps configured correctly

**Test Coverage Goals:**
- Unit tests: Not required for Epic 1 (infrastructure setup)
- Integration tests: RLS policies, auth middleware (critical security)
- E2E tests: Full signup/login flows (at least email auth)

**Testing Tools:**
- **Framework:** Jest + React Testing Library (configured but minimal tests in Epic 1)
- **E2E:** Playwright (optional for Epic 1, required from Epic 2+)
- **CI:** GitHub Actions (run lint, type-check, build on all PRs)

**Deferred Testing:**
- Performance testing: After Epic 5 (dashboard with real data)
- Accessibility testing: After Epic 2 (first UI components)
- Load testing: Phase 2 (post-launch optimization)
