# Smart-Budget-Application - Epic 7: Testing & Quality Infrastructure

**Date:** 2025-12-09
**Project Level:** Method (Full BMM)
**Tech-Spec:** [tech-spec-epic-7-testing-quality.md](tech-spec-epic-7-testing-quality.md)

---

## Epic 7: Testing & Quality Infrastructure

**Slug:** testing-quality-infrastructure

### Goal

Establish comprehensive automated testing infrastructure and quality validation processes to eliminate the critical technical debt of 29 untested stories from Epics 1-6. Create a sustainable quality foundation that prevents regressions, validates performance, and enables confident refactoring.

### Scope

**In Scope:**
- ✅ Test framework configuration with Jest + @testing-library/react
- ✅ 20 baseline smoke tests covering critical user flows (Auth, Transactions, Categories, Dashboard, AI Insights)
- ✅ CI/CD integration (GitHub Actions: tests, coverage, Lighthouse)
- ✅ Performance validation infrastructure (Lighthouse CI, benchmarks, monitoring)
- ✅ Centralized Realtime subscription manager (reduce overhead from 5 subscriptions to 1)
- ✅ Filter breadcrumbs UI (visual feedback for drill-down navigation)
- ✅ Component library documentation (catalog of reusable components)
- ✅ API naming convention documentation
- ✅ Testing guidelines for future development

**Out of Scope:**
- ❌ Full 90% test coverage (baseline 30-40% only)
- ❌ End-to-end (E2E) tests using Playwright/Cypress
- ❌ Visual regression testing (Chromatic/Percy)
- ❌ Load testing and stress tests
- ❌ Accessibility audit automation
- ❌ Security penetration testing

### Success Criteria

1. **Test Coverage:**
   - All 20 baseline tests passing in CI
   - 30-40% code coverage achieved
   - CI blocks PRs with failing tests
   - Coverage tracked in Codecov with badge in README

2. **Performance Validation:**
   - Dashboard loads <2s (verified with Lighthouse)
   - Chart updates <300ms (verified with benchmarks)
   - Lighthouse scores: Performance >90, Accessibility >95, Best Practices >90
   - Performance regression alerts configured (Vercel Analytics)

3. **Code Quality:**
   - Single centralized Realtime subscription manager deployed
   - Filter breadcrumbs component integrated in transaction page
   - No console errors in production builds

4. **Documentation:**
   - Component library doc lists minimum 10 reusable components
   - API naming convention doc published
   - Testing guidelines doc published with examples
   - All docs peer-reviewed and approved

### Dependencies

**Prerequisites:**
- ✅ Epics 1-6 completed (29 stories implemented)
- ✅ Jest framework already installed (package.json)
- ✅ jest.config.js already configured
- ✅ Vercel Analytics already integrated

**Blocking:**
- ⚠️ **This epic BLOCKS all future feature work** per retrospective recommendations
- ⚠️ No Epic 8+ should begin until baseline test coverage exists

---

## Story Map - Epic 7

```
Epic 7: Testing & Quality Infrastructure
│
├── Story 7.1: Test Framework Setup + Baseline Tests (CRITICAL)
│   ├── Create test infrastructure (__tests__/ structure)
│   ├── Mock Supabase, SWR, testing utilities
│   ├── Write 20 smoke tests (Auth, Transactions, Categories, Dashboard, Insights)
│   ├── CI/CD integration (test.yml, coverage.yml workflows)
│   └── Codecov integration
│
├── Story 7.2: Performance Validation Infrastructure
│   ├── Lighthouse CI setup (lighthouse.yml workflow)
│   ├── Performance benchmarks (dashboard, charts)
│   ├── Monitoring alerts (Vercel Analytics)
│   └── Performance regression detection
│
├── Story 7.3: Code Quality Improvements
│   ├── Centralized Realtime subscription manager
│   ├── Refactor dashboard hooks (remove individual subscriptions)
│   ├── Filter breadcrumbs component
│   └── Integration testing
│
└── Story 7.4: Documentation
    ├── Component library catalog
    ├── API naming conventions
    ├── Testing guidelines
    └── Update README with badges
```

**Implementation Sequence:**
1. **Story 7.1 FIRST** (blocks all others) - Establishes quality foundation
2. **Story 7.2 PARALLEL** with 7.1 (can run independently)
3. **Story 7.3** after 7.1 (needs test coverage to validate refactoring)
4. **Story 7.4 LAST** (consolidates learnings from 7.1-7.3)

---

## Stories - Epic 7

### Story 7.1: Test Framework Setup + Baseline Test Coverage

As a **developer**,
I want **automated tests covering critical user flows with CI/CD integration**,
So that **I can confidently make changes without introducing regressions and have immediate feedback on code quality**.

**Acceptance Criteria:**

**Given** the application has 29 untested stories from Epics 1-6
**When** this story is completed
**Then** 20 baseline smoke tests exist and pass consistently

**And** Test infrastructure includes:
- `__tests__/setup/` with Supabase mocks, test utilities, fixtures
- 20 smoke tests organized by domain (Auth, Transactions, Categories, Dashboard, Insights)
- GitHub Actions CI workflow running tests on every PR
- Codecov integration tracking coverage trends
- Coverage badge in README showing current percentage
- CI blocks PRs with failing tests or coverage below 30%

**Prerequisites:** Jest already configured (jest.config.js exists), testing libraries installed

**Technical Notes:**
- Mock Supabase client (auth, database, realtime) to avoid real database calls
- Mock SWR responses to control cache state
- Use @testing-library/react queries (getByRole, getByText, getByLabelText)
- Test structure mirrors src/ directory
- Focus on critical paths: signup flow, transaction CRUD, category seeding, dashboard calculations

---

### Story 7.2: Performance Validation Infrastructure

As a **product owner**,
I want **automated performance validation on every PR**,
So that **performance regressions are caught early and dashboard performance targets (<2s load, <300ms chart updates) are consistently met**.

**Acceptance Criteria:**

**Given** performance targets defined in retrospectives (dashboard <2s, charts <300ms)
**When** this story is completed
**Then** performance validation runs automatically on every PR

**And** Performance infrastructure includes:
- Lighthouse CI workflow (.github/workflows/lighthouse.yml)
- Lighthouse thresholds: Performance >90, Accessibility >95, Best Practices >90
- Performance benchmark scripts (scripts/benchmark.ts) measuring dashboard load and chart render times
- Vercel Analytics alerts for performance degradation >10% from baseline
- Performance budgets enforced (Total load <2s, LCP <1.5s, FID <100ms)
- CI comments on PRs with Lighthouse scores and performance comparison
- Performance regression detection fails CI if thresholds exceeded

**Prerequisites:** Story 7.1 (tests validate no functional regressions from performance optimizations)

**Technical Notes:**
- Run Lighthouse against production-like build (next build + next start)
- Store performance benchmarks in Git for trend analysis
- Use Vercel Analytics API for alerting
- Mobile + Desktop performance validation

---

### Story 7.3: Code Quality Improvements

As a **developer**,
I want **centralized Realtime subscription management and clear drill-down filter UI**,
So that **Supabase connection overhead is reduced and users understand when filters are active**.

**Acceptance Criteria:**

**Given** 5 separate Realtime subscriptions exist in dashboard hooks
**When** this story is completed
**Then** a single centralized subscription manager handles all transaction changes

**And** Realtime improvements include:
- `src/lib/realtime/subscriptionManager.ts` with single transactions table subscription
- Event emitter pattern notifying all SWR hooks of changes
- Dashboard hooks refactored to listen to manager (not create individual subscriptions)
- Automatic subscription cleanup on component unmount
- Performance improvement: 5 connections reduced to 1

**And** Filter breadcrumbs include:
- `src/components/transactions/FilterBreadcrumbs.tsx` component
- Reads category + month from URL query params
- Displays: "Filtering: Dining (November 2024)" with X to clear
- Click X navigates to `/transactions` (removes query params)
- Integrated into transaction list page
- Works with drill-down from pie chart, line chart, and month-over-month highlights

**Prerequisites:** Story 7.1 (tests validate Realtime refactoring doesn't break functionality)

**Technical Notes:**
- Use EventEmitter pattern for subscription manager
- Test with multiple dashboard components mounted simultaneously
- Verify real-time updates still work (<300ms latency)
- Filter breadcrumbs styled with Chakra UI

---

### Story 7.4: Documentation

As a **new developer joining the project**,
I want **comprehensive documentation of reusable components, API conventions, and testing guidelines**,
So that **I can contribute effectively without reinventing the wheel or breaking existing patterns**.

**Acceptance Criteria:**

**Given** reusable components and patterns exist but are undocumented
**When** this story is completed
**Then** three documentation files exist in docs/ directory

**And** Component library documentation includes:
- `docs/component-library.md` file
- Catalog of minimum 10 reusable components (CategoryBadge, CategoryMenu, StatCard, FAB, etc.)
- Props API for each component
- Usage examples with code snippets
- Screenshots or visual examples
- "When to use" guidance

**And** API conventions documentation includes:
- `docs/api-conventions.md` file
- Naming pattern: `/api/[domain]/[resource]-[action]`
- Examples of all existing API routes
- Query parameter conventions
- Response format standards (success/error structures)
- Status code guidelines (200, 201, 400, 401, 404, 500)

**And** Testing guidelines documentation includes:
- `docs/testing-guidelines.md` file
- How to write unit tests vs integration tests
- Test file naming conventions (`__tests__/*.test.ts(x)`)
- Mocking strategies (Supabase, SWR, Next.js router)
- Coverage expectations (90% for new code)
- Examples of good tests from Story 7.1

**And** README updates include:
- Test coverage badge from Codecov
- Link to all three documentation files
- "Getting Started" section updated with testing instructions

**Prerequisites:** Story 7.1 (provides testing examples), Story 7.3 (provides component examples)

**Technical Notes:**
- Use markdown with syntax highlighting
- Include table of contents for each doc
- Add visual diagrams where helpful (Mermaid syntax)
- Peer review all docs before marking story complete

---

## Implementation Timeline - Epic 7

**Total Stories:** 4

**Critical Path:**
1. Story 7.1 (Test Framework) - **MUST complete first** (blocks future work)
2. Story 7.2 (Performance) - Can run parallel with 7.1
3. Story 7.3 (Code Quality) - Depends on 7.1 for test coverage
4. Story 7.4 (Documentation) - Last, consolidates learnings

**Estimated Sequence:**
- **Sprint Week 1:** Story 7.1 + Story 7.2 (parallel)
- **Sprint Week 2:** Story 7.3 + Story 7.4 (sequential)

**Success Gate:**
✅ All 20 baseline tests passing
✅ CI/CD pipeline enforcing quality gates
✅ Performance validated and monitored
✅ Code quality improvements deployed
✅ Documentation published

**After Epic 7:**
- Technical debt from Epics 1-6 resolved
- Quality foundation established for Epic 8+
- Confidence to refactor and optimize safely
- New features can be developed with test coverage from day 1

---

**Epic Status:** Ready for Implementation
**Next Step:** Generate 4 detailed story files → Begin Story 7.1 execution
