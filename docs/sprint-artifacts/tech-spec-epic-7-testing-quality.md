# Smart-Budget-Application - Technical Specification
# Epic 7: Testing & Quality Infrastructure

**Author:** Niki
**Date:** 2025-12-09
**Project Level:** Method (Full BMM)
**Change Type:** Technical Debt Resolution + Infrastructure
**Development Context:** Brownfield - Add testing infrastructure to existing implemented application (Epics 1-6 complete, 29 stories without tests)

---

## Context

### Available Documents

**Retrospectives Completed:**
- ✅ [Epic 1 Retrospective](docs/sprint-artifacts/epic-1-retrospective.md) - Authentication & Basic Setup
- ✅ [Epic 2 Retrospective](docs/sprint-artifacts/epic-2-retrospective.md) - User Authentication & Onboarding
- ✅ [Epic 3 Retrospective](docs/sprint-artifacts/epic-3-retrospective.md) - Transaction Management
- ✅ [Epic 4 Retrospective](docs/sprint-artifacts/epic-4-retrospective.md) - Category Management
- ✅ [Epic 5 Retrospective](docs/sprint-artifacts/epic-5-retrospective.md) - Dashboard & Visualization
- ✅ [Epic 6 Retrospective](docs/sprint-artifacts/epic-6-retrospective.md) - AI Insights

**Critical Finding Across ALL Retrospectives:**
- **29 stories implemented WITHOUT automated tests** (Epics 1-6)
- Test framework installed but **ZERO test files written**
- **UNANIMOUS RECOMMENDATION:** Block all new feature work until testing infrastructure exists

### Project Stack

**Framework:** Next.js 15.5.7 (App Router)
**Runtime:** Node.js 22.x
**UI Library:** Chakra UI 2.8.0 + Framer Motion 10.16.0
**Forms:** React Hook Form 7.66.0 + Zod 4.1.12
**Data Fetching:** SWR 2.3.6
**Backend:** Supabase (Auth + Database + Realtime)
**Visualization:** Recharts 3.5.0
**Date Handling:** date-fns 4.1.0
**Analytics:** Vercel Analytics + Speed Insights

**Test Stack (Installed but Unused):**
- Jest 30.2.0
- @testing-library/react 16.3.0
- @testing-library/jest-dom 6.9.1
- jest-environment-jsdom 30.2.0
- ts-jest 29.4.6

### Existing Codebase Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login, signup, password reset)
│   ├── dashboard/         # Dashboard page
│   ├── transactions/      # Transaction list page
│   ├── categories/        # Category management page
│   ├── insights/          # AI insights page
│   └── api/               # API routes
│       ├── auth/          # Auth endpoints (onboarding)
│       ├── transactions/  # Transaction CRUD
│       ├── categories/    # Category CRUD
│       ├── dashboard/     # Dashboard stats, charts
│       └── insights/      # AI insights generation
├── components/            # React components
│   ├── common/           # Shared components (FAB, modals)
│   ├── layout/           # Layout (Sidebar, Header, MobileNav)
│   ├── transactions/     # Transaction components
│   ├── categories/       # Category components (Badge, Menu, Modal)
│   ├── dashboard/        # Dashboard components (charts, stats)
│   └── insights/         # AI insights components
├── lib/                  # Business logic & utilities
│   ├── auth/            # Auth helpers (client, server)
│   ├── supabase/        # Supabase clients
│   ├── services/        # Business services (seedCategories, insights, rate limiting)
│   ├── hooks/           # Custom React hooks (SWR wrappers, Realtime)
│   ├── ai/              # AI logic (insight rules, analysis)
│   ├── redis/           # Redis client (rate limiting)
│   └── utils/           # Utilities (currency, constants)
└── types/               # TypeScript types
```

**Test Configuration:**
- `jest.config.js` - Configured for Next.js with jsdom, 90% coverage threshold
- `jest.setup.js` - Exists (testing-library setup)
- **NO test directories** - `__tests__/` folders do not exist

---

## The Problem

### Problem Statement

**CRITICAL TECHNICAL DEBT:** The Smart Budget Application has **29 user stories** (spanning 6 epics) implemented **WITHOUT ANY automated tests**. This creates:

1. **High Regression Risk:** Changes to core features (auth, transactions, categories, dashboard) cannot be validated programmatically
2. **Unmaintainable Codebase:** 90% coverage threshold configured but 0% actual coverage
3. **Fragile Refactoring:** Cannot safely refactor code (e.g., centralized Realtime subscription manager) without tests
4. **Quality Gate Missing:** No CI/CD pipeline validation - production deployments have no automated quality checks
5. **Developer Confidence Crisis:** Every code change is a manual QA effort with unknown impact

**Additional Quality Issues Identified:**
- Performance validation incomplete (Lighthouse audit not run, no benchmarks)
- Multiple Supabase Realtime subscriptions creating overhead (inefficient)
- Drill-down filtering lacks visual feedback (no filter breadcrumbs)
- Component library undocumented (reusable components not catalogued)
- API naming conventions inconsistent (no documentation)

### Proposed Solution

Implement a **comprehensive Testing & Quality Infrastructure** across 4 stories:

1. **Story 7.1:** Test Framework Setup + Baseline Test Coverage (20 smoke tests for Epics 1-6)
2. **Story 7.2:** Performance Validation Infrastructure (Lighthouse, benchmarks, monitoring)
3. **Story 7.3:** Code Quality Improvements (centralized Realtime manager, filter breadcrumbs)
4. **Story 7.4:** Documentation (component library, API conventions, testing guidelines)

**Success Criteria:**
- All 20 baseline tests passing in CI/CD
- 90% coverage threshold enforced (block merges below threshold)
- Performance regressions detected automatically
- Dashboard loads <2s, chart updates <300ms (validated with benchmarks)
- Realtime subscription overhead reduced (single shared subscription)
- Filter breadcrumbs provide clear drill-down UX
- Component library + API docs published

### Scope

**In Scope:**

✅ Test framework configuration and CI/CD integration
✅ 20 smoke tests covering critical user flows (Epics 1-6):
  - Authentication (signup, login, session)
  - Transaction CRUD + real-time sync
  - Category management (seeding, CRUD)
  - Dashboard data aggregation + charts
  - Month-over-month calculations
  - AI insights generation
✅ Performance validation infrastructure:
  - Lighthouse CI setup
  - Performance benchmarks (dashboard load, chart updates)
  - Monitoring integration (Vercel Analytics)
✅ Centralized Realtime subscription manager (reduce overhead)
✅ Filter breadcrumbs UI (show active drill-down filters)
✅ Component library documentation (reusable components catalog)
✅ API naming convention documentation
✅ Testing guidelines for future stories

**Out of Scope:**

❌ Full test coverage (90% threshold) - baseline only (target: 30-40% to start)
❌ End-to-end (E2E) tests - focus on unit + integration tests first
❌ Visual regression testing - Chromatic/Percy deferred
❌ Load testing - performance monitoring only, no stress tests
❌ Accessibility audits - WCAG compliance validation deferred to future epic
❌ Security penetration testing - separate security epic needed

---

## Implementation Details

### Source Tree Changes

**New Test Structure:**
```
__tests__/                                    # Root test directory
├── setup/                                    # Test setup files
│   ├── supabase-mock.ts                     # Mock Supabase client
│   ├── test-utils.tsx                       # Testing library wrappers
│   └── fixtures.ts                          # Test data fixtures
├── lib/
│   ├── auth/
│   │   └── auth.test.ts                     # Auth helper tests
│   ├── services/
│   │   ├── seedCategoriesService.test.ts    # Category seeding tests
│   │   └── insightService.test.ts           # AI insight service tests
│   └── ai/
│       └── insightRules.test.ts             # Insight rules tests
├── components/
│   ├── categories/
│   │   ├── CategoryBadge.test.tsx           # Badge component tests
│   │   └── CategoryMenu.test.tsx            # Menu component tests
│   ├── dashboard/
│   │   ├── StatCard.test.tsx                # Stat card tests
│   │   └── MonthOverMonth.test.tsx          # Month comparison tests
│   └── insights/
│       └── AIInsightCard.test.tsx           # Insight card tests
└── app/
    └── api/
        ├── transactions/
        │   └── route.test.ts                # Transaction API tests
        ├── categories/
        │   └── route.test.ts                # Category API tests
        └── dashboard/
            └── stats/
                └── route.test.ts            # Dashboard stats API tests
```

**New Infrastructure Files:**
```
.github/workflows/
├── test.yml                                  # CI: Run tests on every PR
├── lighthouse.yml                            # CI: Lighthouse performance audit
└── coverage.yml                              # CI: Enforce coverage threshold

docs/
├── component-library.md                      # Reusable components catalog
├── api-conventions.md                        # API naming standards
└── testing-guidelines.md                     # How to write tests

src/lib/
└── realtime/
    └── subscriptionManager.ts                # Centralized Realtime manager
```

**Modified Files:**
- `src/components/transactions/TransactionList.tsx` - Add filter breadcrumbs
- `src/app/transactions/page.tsx` - Display active filters from URL params
- All dashboard components - Use centralized Realtime manager
- `package.json` - Add performance monitoring scripts

### Technical Approach

**Story 7.1: Test Framework Setup (2-3 days)**

1. **Create Test Setup Infrastructure:**
   - `__tests__/setup/supabase-mock.ts` - Mock Supabase client (auth, database, realtime)
   - `__tests__/setup/test-utils.tsx` - Wrap render() with providers (Chakra, SWR, Supabase)
   - `__tests__/setup/fixtures.ts` - Seed data (users, transactions, categories, insights)
   - Update `jest.setup.js` - Import testing-library matchers

2. **Write 20 Baseline Tests** (prioritized by criticality):
   - **Auth (3 tests):**
     - User signup flow (email validation, password requirements)
     - User login flow (session creation)
     - Session management (auto-logout after inactivity)
   - **Transactions (5 tests):**
     - Create transaction (validation, optimistic UI)
     - Edit transaction (update, SWR mutation)
     - Delete transaction (confirmation, optimistic update)
     - Transaction list filtering (category, date range)
     - Real-time sync (Supabase Realtime subscription)
   - **Categories (4 tests):**
     - Seed default categories on signup (idempotency)
     - Create custom category (validation, uniqueness)
     - Edit category (name, color)
     - Delete category with transactions (orphaning logic)
   - **Dashboard (5 tests):**
     - Dashboard stats calculation (balance, income, expenses)
     - Month-over-month comparison (percentage calc, >20% threshold)
     - Spending by category aggregation (percentage calc)
     - Trends aggregation (6 months, date grouping)
     - Chart drill-down URL generation
   - **AI Insights (3 tests):**
     - Insight rule evaluation (high spending category)
     - Insight generation (rule matching)
     - Insight metadata (actionable, dismissible)

3. **CI/CD Integration:**
   - `.github/workflows/test.yml`:
     - Run tests on every PR (node 22.x)
     - Upload coverage report to Codecov
     - Fail if coverage < 30% (gradually increase to 90%)
   - `.github/workflows/coverage.yml`:
     - Daily coverage report
     - Track coverage trends over time

**Story 7.2: Performance Validation (1 day)**

1. **Lighthouse CI Setup:**
   - Install `@lhci/cli`
   - `.github/workflows/lighthouse.yml` - Run on every PR
   - Lighthouse config:
     - Target: Dashboard page (most complex)
     - Thresholds: Performance >90, Accessibility >95, Best Practices >90
     - Budget: Total load time <2s, LCP <1.5s, FID <100ms

2. **Performance Benchmarks:**
   - `scripts/benchmark.ts` - Measure dashboard load time, chart render time
   - Store benchmarks in Git (track regressions)
   - Fail CI if dashboard load >2s or chart update >300ms

3. **Monitoring Integration:**
   - Verify Vercel Analytics tracking page load times
   - Set up alerts for performance degradation (>10% slower than baseline)

**Story 7.3: Code Quality Improvements (2 days)**

1. **Centralized Realtime Subscription Manager:**
   - `src/lib/realtime/subscriptionManager.ts`:
     - Single subscription to `transactions` table changes
     - Event emitter pattern to notify SWR hooks
     - Automatic cleanup on unmount
   - Refactor dashboard hooks (useDashboardStats, useSpendingByCategory, useTrends, useMonthOverMonth):
     - Remove individual Realtime subscriptions
     - Listen to centralized manager events
   - **Benefit:** Reduces Supabase connection overhead from 5 subscriptions to 1

2. **Filter Breadcrumbs UI:**
   - `src/components/transactions/FilterBreadcrumbs.tsx`:
     - Read category + month from URL query params
     - Display: "Filtering: Dining (November 2024)" with X to clear
     - Click X → navigate to `/transactions` (remove query params)
   - Integrate into `src/app/transactions/page.tsx`
   - **Benefit:** Clear visual feedback for drill-down navigation from dashboard

**Story 7.4: Documentation (1 day)**

1. **Component Library Documentation:**
   - `docs/component-library.md`:
     - List all reusable components (CategoryBadge, CategoryMenu, StatCard, FAB, etc.)
     - Props API, usage examples, when to use
     - Screenshots/code snippets
   - **Benefit:** Prevents reinventing the wheel, promotes consistency

2. **API Naming Convention Documentation:**
   - `docs/api-conventions.md`:
     - Standard: `/api/[domain]/[resource]-[action]`
     - Examples: `/api/dashboard/stats`, `/api/categories/route.ts`
     - Query params, response formats, error codes
   - **Benefit:** Makes API discoverable, easier to maintain

3. **Testing Guidelines:**
   - `docs/testing-guidelines.md`:
     - How to write tests (unit vs integration)
     - Test file naming (`__tests__/*.test.ts(x)`)
     - Mocking Supabase, SWR, Next.js router
     - Coverage expectations (90% for new code)
   - **Benefit:** Onboards future developers, enforces quality

### Existing Patterns to Follow

**Code Style (from .eslintrc + .prettierrc):**
- TypeScript strict mode
- Single quotes
- No semicolons (Prettier removes them)
- 2-space indentation
- Import order: external → internal → relative

**Component Patterns:**
- Functional components with hooks
- React Hook Form + Zod for forms
- Chakra UI components (no custom CSS)
- SWR for data fetching (5-second deduplication)
- Optimistic UI updates (mutate before API call)

**Testing Patterns (to establish):**
- Jest + @testing-library/react
- Test files in `__tests__/` mirror src structure
- Naming: `ComponentName.test.tsx`, `serviceName.test.ts`
- Mocking: Mock external dependencies (Supabase, API calls)
- Assertions: `expect()` from Jest, queries from @testing-library

### Integration Points

**CI/CD:**
- GitHub Actions workflows (test.yml, lighthouse.yml, coverage.yml)
- Vercel deployment (run tests before deploy)

**Supabase:**
- Mock Supabase client in tests (no real DB calls)
- Test Realtime subscription manager integration

**SWR:**
- Mock SWR responses in tests
- Test cache invalidation logic

**Dashboard Components:**
- Refactor to use centralized Realtime manager
- Test chart drill-down URL generation

---

## Development Context

### Relevant Existing Code

**Test Configuration:**
- `jest.config.js` (lines 1-36) - Already configured, just needs test files
- `jest.setup.js` - Exists, ready for testing-library setup
- `package.json` (lines 17-19) - Test scripts already defined

**Components to Test (High Priority):**
- `src/lib/services/seedCategoriesService.ts` - Category seeding logic (idempotency critical)
- `src/lib/ai/insightRules.ts` - AI insight rules (complex business logic)
- `src/app/api/dashboard/month-over-month/route.ts` - Month comparison calc (error-prone math)
- `src/components/dashboard/MonthOverMonth.tsx` - Drill-down navigation logic
- `src/components/categories/CategoryBadge.tsx` - Reusable component (3 variants)

**Realtime Subscriptions to Centralize:**
- `src/lib/hooks/useDashboardStats.ts` - Subscribes to transactions table
- `src/lib/hooks/useSpendingByCategory.ts` - Subscribes to transactions table
- `src/lib/hooks/useTrends.ts` - Subscribes to transactions table
- `src/lib/hooks/useMonthOverMonth.ts` - Subscribes to transactions table
- `src/components/dashboard/CategorySpendingChart.tsx` - Subscribes to transactions table

### Dependencies

**Framework/Libraries:**
- Next.js 15.5.7 (App Router, API Routes, SSR)
- React 18.3.0 + React DOM 18.3.0
- TypeScript 5.3.0
- Chakra UI 2.8.0 (UI components)
- React Hook Form 7.66.0 + Zod 4.1.12 (forms)
- SWR 2.3.6 (data fetching, caching)
- Supabase 2.81.1 (auth, database, realtime)
- Recharts 3.5.0 (charts)
- date-fns 4.1.0 (date operations)

**Testing Stack:**
- Jest 30.2.0 (test runner)
- @testing-library/react 16.3.0 (React testing utilities)
- @testing-library/jest-dom 6.9.1 (DOM matchers)
- jest-environment-jsdom 30.2.0 (browser environment)
- ts-jest 29.4.6 (TypeScript support)

**CI/CD:**
- GitHub Actions (workflows)
- Vercel (deployment, analytics)
- Codecov (coverage tracking - to be added)

**Performance:**
- @lhci/cli (Lighthouse CI - to be added)
- @vercel/analytics 1.6.1 (analytics)
- @vercel/speed-insights 1.3.1 (performance monitoring)

### Internal Modules

**Core Modules to Test:**
- `src/lib/auth/` - Authentication helpers (client, server, session management)
- `src/lib/supabase/` - Supabase client wrappers
- `src/lib/services/` - Business services (categories, insights, rate limiting)
- `src/lib/ai/` - AI logic (insight rules, spending analysis)
- `src/lib/hooks/` - Custom React hooks (SWR + Realtime patterns)
- `src/lib/utils/` - Utilities (currency formatting, constants)

**Component Families:**
- `src/components/categories/` - Category components (Badge, Menu, Modal)
- `src/components/dashboard/` - Dashboard components (charts, stats, comparisons)
- `src/components/insights/` - AI insights components
- `src/components/transactions/` - Transaction components (modal, list)
- `src/components/layout/` - Layout components (Sidebar, Header, MobileNav)

### Configuration Changes

**CI/CD Workflows (New):**
- `.github/workflows/test.yml` - Run Jest on every PR
- `.github/workflows/lighthouse.yml` - Performance audit on every PR
- `.github/workflows/coverage.yml` - Daily coverage report

**Test Setup (New):**
- `__tests__/setup/supabase-mock.ts` - Mock Supabase client
- `__tests__/setup/test-utils.tsx` - Testing library wrappers
- `__tests__/setup/fixtures.ts` - Test data fixtures

**Package.json Updates:**
- Add `@lhci/cli` for Lighthouse CI
- Add `codecov` for coverage reporting
- Add performance benchmark scripts

### Existing Conventions (Brownfield)

**File Naming:**
- Components: PascalCase (e.g., `CategoryBadge.tsx`)
- Utilities: camelCase (e.g., `seedCategoriesService.ts`)
- API routes: `route.ts` (Next.js App Router convention)
- Tests: Match source file name with `.test.ts(x)` suffix

**Code Organization:**
- Feature-based organization (components/categories/, components/dashboard/)
- Shared components in components/common/
- Business logic in lib/ (services, hooks, utilities)
- Types in types/ (database.types.ts, category.types.ts)

**Import Patterns:**
- `@/` alias for src/ (configured in tsconfig.json)
- Named exports preferred over default exports
- Group imports: external → internal → relative

**Error Handling:**
- Try-catch in API routes (return 400/401/500 with error message)
- Toast notifications in UI (Chakra UI useToast)
- Console.error for debugging (no formal logging yet)

### Test Framework & Standards

**Testing Framework:** Jest 30.2.0 + @testing-library/react 16.3.0

**Test File Naming:**
- Unit tests: `__tests__/lib/**/*.test.ts`
- Component tests: `__tests__/components/**/*.test.tsx`
- API tests: `__tests__/app/api/**/*.test.ts`

**Test Organization:**
- Tests mirror src/ structure
- Test setup in `__tests__/setup/`
- Shared fixtures in `__tests__/setup/fixtures.ts`

**Mocking Strategy:**
- Mock Supabase client (no real database calls)
- Mock SWR responses (control cache state)
- Mock Next.js router (control navigation)
- Mock Chakra UI toast (verify notifications)

**Assertion Style:**
- Jest `expect()` matchers
- @testing-library queries (getByRole, getByText, getByLabelText)
- @testing-library/jest-dom matchers (toBeInTheDocument, toHaveTextContent)

**Coverage Requirements:**
- Baseline: 30-40% coverage (initial goal)
- Target: 90% coverage (jest.config.js threshold)
- Enforce in CI: Block PRs below threshold
- Track: Upload to Codecov, display badge in README

**Test Types:**
- Unit tests: Pure functions, utilities, services
- Integration tests: Components with hooks, API routes
- Smoke tests: Critical user flows (auth, CRUD operations)
- NO E2E tests yet (deferred to future epic)

---

## Implementation Stack

**Next.js 15.5.7** - Latest stable, App Router
**TypeScript 5.3.0** - Strict mode enabled
**React 18.3.0** - Concurrent rendering, suspense
**Chakra UI 2.8.0** - Component library
**Jest 30.2.0** - Test runner
**@testing-library/react 16.3.0** - React testing utilities
**Supabase 2.81.1** - Backend (auth, database, realtime)
**SWR 2.3.6** - Data fetching, caching
**Recharts 3.5.0** - Data visualization
**date-fns 4.1.0** - Date manipulation

**CI/CD:**
- GitHub Actions (test, lighthouse, coverage workflows)
- Vercel (deployment, analytics, speed insights)
- Codecov (coverage tracking)

**Performance Monitoring:**
- Lighthouse CI
- Vercel Analytics
- Performance benchmarks (dashboard load, chart render)

---

## Epic + Story Breakdown

This tech-spec generates **Epic 7** with **4 stories**:

### Epic 7: Testing & Quality Infrastructure

**Goal:** Establish automated testing infrastructure and quality validation to eliminate technical debt from Epics 1-6 (29 untested stories).

**Stories:**

1. **Story 7.1: Test Framework Setup + Baseline Test Coverage**
   - Set up test infrastructure (__tests__/ structure, mocks, fixtures)
   - Write 20 smoke tests covering critical user flows (Epics 1-6)
   - Configure CI/CD (test.yml, coverage.yml)
   - **Acceptance Criteria:** All 20 tests passing, 30-40% coverage, CI blocks PRs with failing tests

2. **Story 7.2: Performance Validation Infrastructure**
   - Set up Lighthouse CI (performance audits on every PR)
   - Create performance benchmarks (dashboard load <2s, chart updates <300ms)
   - Integrate monitoring (Vercel Analytics alerts)
   - **Acceptance Criteria:** Lighthouse scores >90, benchmarks pass, alerts configured

3. **Story 7.3: Code Quality Improvements**
   - Centralized Realtime subscription manager (reduce from 5 to 1 subscription)
   - Filter breadcrumbs UI (show active drill-down filters with clear button)
   - **Acceptance Criteria:** Single Realtime subscription, filter breadcrumbs visible on transaction page

4. **Story 7.4: Documentation**
   - Component library documentation (catalog of reusable components)
   - API naming convention documentation
   - Testing guidelines for future development
   - **Acceptance Criteria:** 3 docs published in docs/, all reusable components catalogued

---

## Success Metrics

**Test Coverage:**
- ✅ 20 baseline tests passing
- ✅ 30-40% code coverage (baseline)
- ✅ CI pipeline blocks PRs with failing tests
- ✅ Coverage tracked in Codecov

**Performance:**
- ✅ Dashboard loads <2s (validated with Lighthouse)
- ✅ Chart updates <300ms (validated with benchmarks)
- ✅ Lighthouse scores: Performance >90, Accessibility >95, Best Practices >90
- ✅ Performance alerts configured (Vercel Analytics)

**Code Quality:**
- ✅ Realtime subscriptions reduced from 5 to 1 (centralized manager)
- ✅ Filter breadcrumbs provide clear drill-down UX
- ✅ No console errors in production

**Documentation:**
- ✅ Component library doc lists all reusable components (min 10)
- ✅ API convention doc published
- ✅ Testing guidelines doc published
- ✅ All docs reviewed and approved

---

## Risk Assessment

**High Risk:**
- Writing tests for complex business logic (month-over-month calc, insight rules) may reveal bugs in existing implementation → **Mitigation:** Fix bugs as discovered, add regression tests
- 90% coverage threshold is ambitious for existing code → **Mitigation:** Start with 30-40%, gradually increase to 90% over next 3 epics
- Refactoring Realtime subscriptions may break real-time updates → **Mitigation:** Test thoroughly, deploy with feature flag

**Medium Risk:**
- Lighthouse CI may fail initially (current performance unknown) → **Mitigation:** Baseline first, then set thresholds
- CI pipeline may slow down PR reviews (tests take time) → **Mitigation:** Optimize test suite, parallelize tests

**Low Risk:**
- Documentation may become outdated → **Mitigation:** Include docs in PR review checklist
- Filter breadcrumbs UI may need UX iteration → **Mitigation:** Get user feedback early

---

## Next Steps

1. **Generate Epic 7 + 4 Stories** from this tech-spec
2. **Story 7.1: Test Framework Setup** - Start implementation
3. **CI/CD Integration** - Set up GitHub Actions workflows
4. **Validate Baseline Tests** - All 20 tests passing
5. **Deploy to Staging** - Verify no regressions
6. **Continue with Stories 7.2-7.4** - Performance, quality, documentation

---

**Ready for Story Generation:** ✅

This tech-spec provides comprehensive context for generating 4 detailed user stories with acceptance criteria, tasks, and implementation guidance.
