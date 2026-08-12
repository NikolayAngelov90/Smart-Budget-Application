---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-24'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - docs/phase-1/architecture.md
  - docs/phase-1/ux-design-specification.md
  - docs/phase-1/product-brief-Smart-Budget-Application-2025-11-14.md
workflowType: 'architecture'
project_name: 'Smart-Budget-Application'
user_name: 'Nikit'
date: '2026-03-23'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
41 FRs organized across 7 capability areas that define the Phase 2 product:

1. **Financial Intelligence & AI Coaching** (FR1-FR8) — Spending anomaly detection, predictive forecasting, smart nudges, budget recovery plans, subscription detection, seasonal awareness, household-level insights, lapsed-user re-engagement analysis. *Architectural implication:* Server-side AI engine with access to full transaction history, background processing, caching layer for computed insights.

2. **Financial Visualization & Awareness** (FR9-FR12) — Weekly digest, spending heatmap, annualized projections, shared household dashboard. *Architectural implication:* Scheduled background jobs (digest), calendar-based data aggregation (heatmap), real-time shared state (household dashboard).

3. **Goal Management & Savings** (FR13-FR17) — Savings goals with milestones, wishlist with budget impact, "What If" simulations, shared household goals. *Architectural implication:* New database tables (goals, wishlists), simulation engine, cross-user goal tracking with RLS.

4. **Household Collaboration** (FR18-FR23) — Household creation/invitation, shared categories, contribution splits, member management, database-level isolation. *Architectural implication:* Multi-tenancy via household_id, invitation flow with token validation, expanded RLS policies for shared access.

5. **Privacy & Transparency Controls** (FR24-FR27) — Per-category transparency levels, presets, personal allowance, data-layer enforcement. *Architectural implication:* Transparency metadata on categories/transactions, RLS policies that filter based on transparency level, preset configuration system.

6. **Engagement & Gamification** (FR28-FR33) — Streaks, Budget Score, achievements, comeback challenges, push notifications, opt-in/out. *Architectural implication:* Gamification state tables, streak calculation logic, Web Push API integration, feature flags for opt-in.

7. **Values-Based Planning & Platform** (FR34-FR41) — Values-based spending, progressive disclosure, GDPR deletion, accessibility, disclaimers. *Architectural implication:* User preferences/values storage, onboarding flow, cascade deletion procedures, aria-live regions.

**Non-Functional Requirements:**

| Category | Key Targets | Architectural Impact |
|----------|------------|---------------------|
| Performance | Page load <2s, transaction save <200ms, household sync <500ms, AI <3s | Optimistic UI, WebSocket scoping, background AI jobs |
| Security | RLS on every table, cross-household isolation, invitation tokens (single-use, 48h), no financial data in logs | Expanded RLS policies, token service, log sanitization |
| Scalability | 1-10 users MVP, architecture supports 1,000, up to 10 household members, 10K transactions/user | Indexed queries, scoped Realtime subscriptions |
| Accessibility | WCAG 2.1 Level A (AA where free), prefers-reduced-motion, aria-live, keyboard nav | Component-level a11y, motion preferences, data table alternatives |
| Reliability | Zero critical bugs 30+ days, 800+ tests maintained, last-write-wins for concurrent edits, 2 decimal financial accuracy | Conflict resolution strategy, decimal handling, comprehensive test coverage |

**Scale & Complexity:**

- Primary domain: Full-stack fintech PWA
- Complexity level: **High**
- Estimated architectural components: 12-15 major components (AI engine, household system, gamification engine, notification service, transparency layer, goal tracker, simulation engine, digest scheduler, invitation service, streak tracker, achievement system, real-time sync layer)

### Technical Constraints & Dependencies

**Existing Stack (non-negotiable — brownfield):**
- Next.js 15 App Router, React 18, Chakra UI 2.8+, Supabase (PostgreSQL + Auth + Realtime), SWR, React Hook Form + Zod, Recharts, date-fns, Jest 30 + React Testing Library
- Deployed on Vercel with CI/CD via GitHub Actions
- TypeScript strict mode throughout

**New Infrastructure Needed:**
- Supabase Realtime subscriptions (existing but unused at scale — needed for household sync)
- Web Push API + service worker for push notifications
- Background job capability for weekly digest generation
- Expanded database schema: households, goals, achievements, streaks, wishlists, transparency settings, invitations

**Key Constraints:**
- Solo developer — architecture must be simple enough for one person to maintain
- No external AI APIs — all intelligence is server-side deterministic rules (enhanced from Phase 1)
- Supabase free/pro tier limits on Realtime connections and database size
- Must not regress any existing Phase 1 functionality or performance

### Cross-Cutting Concerns Identified

1. **Row-Level Security expansion** — Every new table needs RLS. Household tables need dual-path RLS (owner access + household member access filtered by transparency level). This is the single most complex architectural concern.

2. **Real-time data synchronization** — Household mode requires WebSocket subscriptions scoped per household. Must handle connection lifecycle, reconnection, and fallback to SWR polling.

3. **Push notification infrastructure** — Web Push API requires service worker, VAPID keys, subscription management, and notification payload construction. Cuts across AI nudges, gamification milestones, household events, and re-engagement.

4. **Background processing** — Weekly digest, AI analysis, streak calculations, and achievement checks all need background execution. Vercel serverless has execution time limits — may need Supabase Edge Functions or cron-triggered API routes.

5. **Feature progressive disclosure** — New features must appear gradually based on user behavior, not overwhelm on first load. Requires user state tracking and conditional rendering logic.

6. **Gamification opt-in/out** — Gamification must be fully decoupled from core budgeting. All gamification components lazy-loaded. Feature flag per user.

7. **Financial data integrity** — DECIMAL(12,2) everywhere, no floating-point arithmetic in JavaScript for money, consistent rounding. Extends to household contribution calculations and goal progress tracking.

8. **Multi-user testing** — Household features need integration tests simulating multiple concurrent users with different transparency settings. Significantly more complex than solo-user test patterns.

## Starter Template Evaluation

### Project Context: Brownfield

This is a **brownfield project** with 10 completed epics, 808+ tests, and a production-deployed application. Starter template evaluation is not applicable — the foundation is established and proven.

### Established Technology Stack

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Framework | Next.js (App Router) | 15+ | Production, 10 epics complete |
| UI Framework | Chakra UI | 2.8+ | Full Trust Blue theme system |
| Database | Supabase PostgreSQL | Latest | RLS active, 3 tables (categories, transactions, insights) |
| Authentication | Supabase Auth | Latest | Email/password + social login |
| State Management | SWR + React Context | Latest | Server state caching + UI state |
| Forms | React Hook Form + Zod | 7+ / 3+ | Type-safe schema validation |
| Charts | Recharts | 2.12+ | SVG-based, React-first API |
| Dates | date-fns | 3+ | Lightweight, tree-shakeable |
| Testing | Jest + React Testing Library | 30+ / Latest | 808+ tests, 58 suites |
| Deployment | Vercel + GitHub Actions | Latest | CI/CD with preview deploys |
| Language | TypeScript (strict mode) | 5+ | Full coverage |

### Phase 2 New Dependencies (Anticipated)

| Dependency | Purpose | Notes |
|-----------|---------|-------|
| Web Push API | Push notifications for nudges, milestones, re-engagement | Browser-native, no external library |
| Supabase Realtime | Household real-time sync | Already in @supabase/supabase-js, currently unused at scale |
| Cron/Scheduler | Weekly digest generation | Vercel Cron or Supabase Edge Functions |
| Service Worker | PWA push notification handling | Extend existing PWA service worker |

### Architectural Decisions Already Established

All foundational architectural decisions were made in Phase 1 and are documented in `docs/phase-1/architecture.md` with 9 ADRs covering: data persistence (Supabase), API pattern (REST), authentication (Supabase Auth), real-time (Supabase Realtime), deployment (Vercel), charts (Recharts), state management (SWR + Context), form handling (React Hook Form + Zod), and data export (client-side).

**Phase 2 architecture decisions will extend these foundations, not replace them.**

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Household data model and RLS expansion — blocks all multi-user features
2. Real-time subscription architecture — blocks household sync
3. AI engine expansion strategy — blocks intelligence features

**Important Decisions (Shape Architecture):**
4. Gamification data model and component architecture
5. Push notification infrastructure
6. Background job strategy (cron)
7. Feature flag / progressive disclosure system

**Deferred Decisions (Post-MVP):**
- Bank feed integration (Plaid/Teller) — Epic 16+
- Freemium pricing model infrastructure — commercial launch
- Community/social features architecture — Epic 16+

### Data Architecture

**ADR-010: Household Multi-Tenancy Model**
- **Decision:** Add `households` and `household_members` tables. Add optional `household_id` FK to `categories` and `transactions` for shared items. Personal items retain `user_id` only; shared items have both `user_id` (creator) and `household_id`.
- **Rationale:** Additive schema change — existing solo-user queries unaffected. Shared items are explicitly marked, not implicitly inferred.
- **Affects:** Epics 13 (Household Mode)

**ADR-011: Transparency Level Storage**
- **Decision:** ENUM `visibility_level` (`shared`, `category_only`, `private`) on shared categories. Transparency presets stored as JSON configuration in `household_members.preset`.
- **Rationale:** Per-category granularity matches PRD FR24-FR25. Database-level enforcement via RLS ensures privacy even on direct API access.
- **Affects:** Epics 13 (Household), security architecture

**ADR-012: Gamification State Model**
- **Decision:** Separate tables for `streaks`, `budget_scores`, `achievements` (definitions), and `user_achievements` (unlocks). Streak calculation via daily cron, budget score recalculated on transaction changes.
- **Rationale:** Decoupled from core financial tables — gamification can be disabled without schema changes. Achievement definitions in DB allow adding new achievements without code changes.
- **Affects:** Epic 15 (Gamification)

**ADR-013: Goal & Wishlist Model**
- **Decision:** `goals` table with `user_id`, optional `household_id`, `target_amount`, `current_amount`, `deadline`. `goal_contributions` tracks per-member progress. `wishlists` table linked to goals for impact analysis.
- **Rationale:** Supports both solo and shared goals. Contribution tracking enables household progress visualization without exposing individual transaction details.
- **Affects:** Epics 12 (AI), 13 (Household), 14 (Values)

**ADR-014: Subscription Detection Storage**
- **Decision:** `detected_subscriptions` table populated by AI analysis of recurring transaction patterns. Fields: `user_id`, `merchant_pattern`, `estimated_amount`, `frequency`, `last_seen_at`, `status` (active/unused/cancelled).
- **Rationale:** Persistent storage enables Subscription Graveyard feature (FR5) and historical tracking of subscription savings.
- **Affects:** Epic 11 (Quick Wins)

### Authentication & Security

**ADR-015: Household RLS Strategy**
- **Decision:** Dual-path RLS policies on all household-related tables:
  - Path 1 (owner): `auth.uid() = user_id` — existing pattern
  - Path 2 (household member): `auth.uid() IN (SELECT user_id FROM household_members WHERE household_id = item.household_id)` with transparency filter
  - `category_only` visibility: aggregate function in RLS or API layer returns sums but blocks individual rows
- **Rationale:** Database-level enforcement means no amount of client-side or API manipulation can bypass privacy. This is the most critical security decision in Phase 2.
- **Affects:** All household features (Epic 13)

**ADR-016: Invitation Token System**
- **Decision:** `household_invitations` table with cryptographic UUID token, bound to specific email, 48-hour expiry, single-use. Validation checks: token exists, not expired, not used, email matches authenticated user.
- **Rationale:** Prevents unauthorized household access. Email binding ensures only intended recipient can accept.
- **Affects:** Epic 13 (Household)

### API & Communication Patterns

**ADR-017: Real-Time Subscription Architecture**
- **Decision:** Supabase Realtime channels scoped per household: `household:{household_id}`. Subscribe to INSERT/UPDATE/DELETE on shared transactions, categories, goals. Fallback to SWR polling (30s interval) on WebSocket disconnect.
- **Rationale:** Scoped channels prevent cross-household data leakage at the subscription level. SWR fallback ensures functionality on unreliable connections.
- **Affects:** Epic 13 (Household)

**ADR-018: Push Notification Architecture**
- **Decision:** Web Push API with VAPID keys. `push_subscriptions` table stores per-device endpoints. Server-side push from Vercel API routes. Notification categories: nudge, milestone, re-engagement, household_event — each independently toggleable by user.
- **Rationale:** Browser-native (no external service), works with existing PWA. Per-category toggles respect user preferences (FR33).
- **Affects:** Epics 11, 12, 13, 15

**ADR-019: Background Job Strategy**
- **Decision:** Vercel Cron Jobs for scheduled tasks:
  - `/api/cron/weekly-digest` — Monday 8:00 UTC
  - `/api/cron/streak-check` — Daily 00:00 UTC
  - `/api/cron/subscription-detect` — Weekly recurring charge scan
  - Secured with `CRON_SECRET` header validation
- **Rationale:** Vercel Cron is free tier compatible, no additional infrastructure. Simple API route pattern consistent with existing architecture.
- **Affects:** Epics 11, 12, 15

### Frontend Architecture

**ADR-020: Gamification Component Strategy**
- **Decision:** All gamification components lazy-loaded via `next/dynamic`. Feature gate via `user_preferences.gamification_enabled` boolean. Gamification state managed in dedicated SWR hooks (`useStreak`, `useBudgetScore`, `useAchievements`). Animations respect `prefers-reduced-motion`.
- **Rationale:** Zero performance impact when disabled. Lazy loading keeps core bundle lean (<50KB Phase 2 budget). Separate hooks prevent gamification logic from leaking into financial components.
- **Affects:** Epic 15 (Gamification), FR33, FR40

**ADR-021: Household Route Architecture**
- **Decision:** New route group `(household)/` for household-specific pages: dashboard, settings, members, shared goals. Household context provider wraps these routes, providing `householdId`, `memberRole`, `transparencySettings` via React Context.
- **Rationale:** Route-level separation keeps household logic contained. Context provider eliminates prop drilling for household state.
- **Affects:** Epic 13 (Household)

**ADR-022: Progressive Disclosure System**
- **Decision:** DB-backed user state tracking in `user_preferences`: `transaction_count`, `days_active`, `features_unlocked` (JSON array). Feature thresholds defined in constants file. No external feature flag service.
- **Rationale:** Simple, no external dependency. Thresholds can be adjusted without code changes. Consistent with solo developer scale.
- **Affects:** FR36, FR37

### Infrastructure & Deployment

**ADR-023: Error Monitoring**
- **Decision:** Add Sentry (free tier) for production error tracking. Financial data stripped from error payloads via `beforeSend` hook. Source maps uploaded on deploy.
- **Rationale:** Vercel logs are insufficient for production debugging at scale. Sentry free tier supports MVP user count. Log sanitization prevents financial data exposure.
- **Affects:** All epics, NFR (reliability)

**ADR-024: Database Indexing Strategy**
- **Decision:** Phase 2 indexes added via Supabase migrations:
  - `idx_transactions_household` on `(household_id, date DESC)`
  - `idx_goals_household` on `(household_id)`
  - `idx_streaks_user` on `(user_id, last_activity_date)`
  - `idx_household_members_lookup` on `(household_id, user_id)`
- **Rationale:** Household queries will join on household_id frequently. Indexed lookups prevent full table scans that would violate <500ms sync target.
- **Affects:** NFR (performance, scalability)

### Decision Impact Analysis

**Implementation Sequence:**
1. Database schema migrations — new tables, indexes, enums (foundation)
2. Household RLS policies — security before features (ADR-015, ADR-016)
3. Household CRUD + invitation flow — enables multi-user (ADR-010, ADR-011)
4. Real-time subscriptions — household sync (ADR-017)
5. AI engine expansion — pattern detection, forecasting (ADR-014)
6. Gamification system — streaks, scores, achievements (ADR-012, ADR-020)
7. Push notifications — cross-cutting, wired last (ADR-018)
8. Background jobs — digest, cron (ADR-019)

**Cross-Component Dependencies:**
- ADR-015 (Household RLS) → blocks ADR-010, ADR-011, ADR-017, ADR-021
- ADR-010 (Household Model) → blocks ADR-013 (shared goals), ADR-017 (realtime)
- ADR-012 (Gamification Model) → independent, can ship in any order after schema
- ADR-018 (Push) → depends on service worker + ADR-019 (cron for scheduled notifications)
- ADR-019 (Background Jobs) → depends on ADR-014 (subscription detection data)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 25+ areas where AI agents could make different choices, organized into 5 categories below.

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case`, plural (`transactions`, `categories`, `households`, `household_members`)
- Columns: `snake_case` (`user_id`, `household_id`, `created_at`, `visibility_level`)
- Foreign keys: `{referenced_table_singular}_id` (`user_id`, `category_id`, `household_id`)
- Indexes: `idx_{table}_{columns}` (`idx_transactions_household`, `idx_streaks_user`)
- Enums: `snake_case` type name, `snake_case` values (`transaction_type`, `visibility_level`)

**API Naming Conventions:**
- Endpoints: plural, kebab-case (`/api/transactions`, `/api/household-members`)
- Route params: `[id]` (Next.js App Router convention)
- Query params: `camelCase` (`startDate`, `categoryId`)
- Cron routes: `/api/cron/{job-name}` (`/api/cron/weekly-digest`)

**Code Naming Conventions:**
- Components: `PascalCase` files and exports (`TransactionCard.tsx`, `HouseholdDashboard.tsx`)
- Hooks: `use` prefix, `camelCase` (`useTransactions`, `useHousehold`, `useStreak`)
- Services: `camelCase` files (`transactionService.ts`, `householdService.ts`)
- Utils: `camelCase` files (`formatters.ts`, `validators.ts`)
- Types: `PascalCase` interfaces, `camelCase` files (`Transaction`, `HouseholdMember`)
- Constants: `UPPER_SNAKE_CASE` (`CACHE_TTL`, `MAX_HOUSEHOLD_MEMBERS`)

### Structure Patterns

**Project Organization (Feature-Based):**
```
src/components/
  household/          # Household feature components
    HouseholdDashboard.tsx
    MemberList.tsx
    InvitationForm.tsx
    TransparencySettings.tsx
  gamification/       # Lazy-loaded gamification components
    StreakDisplay.tsx
    BudgetScore.tsx
    AchievementCard.tsx
  ai/                 # AI visualization components
    SpendingHeatmap.tsx
    WeeklyDigest.tsx
    SubscriptionGraveyard.tsx
    SmartNudge.tsx
```

**Test Location (Mirror Source):**
```
src/__tests__/
  components/household/HouseholdDashboard.test.tsx
  services/householdService.test.ts
  api/household/route.test.ts
  integration/household-rls.test.ts
```

**Service Layer Pattern:**
- One service file per domain: `householdService.ts`, `gamificationService.ts`, `aiInsightService.ts`
- Services call Supabase client, not API routes
- API routes call services, not Supabase directly
- Components use SWR hooks, not services directly

### Format Patterns

**API Response Formats:**
```typescript
// Success
{ data: T }
// Error
{ error: { message: string; code?: string; details?: any } }
// List with count
{ data: T[]; count: number }
```

**Date/Time Formats:**
- Database: `TIMESTAMP WITH TIME ZONE` stored in UTC
- API JSON: ISO 8601 strings (`2026-03-24T08:00:00Z`)
- Display: User's local timezone via `date-fns` format functions
- Date-only fields: `DATE` type, ISO date string (`2026-03-24`)

**Financial Amount Handling:**
- Database: `DECIMAL(12, 2)` — never float
- JavaScript: Integer cents for calculations when precision critical, `Intl.NumberFormat` for display
- API: number type in JSON, always 2 decimal places
- Never use floating-point arithmetic for money operations

### Communication Patterns

**Supabase Realtime Events:**
- Channel naming: `household:{household_id}`
- Event types: `INSERT`, `UPDATE`, `DELETE` on subscribed tables
- Client pattern: subscribe in `useEffect`, unsubscribe on cleanup
- SWR integration: Realtime events trigger `mutate()` to refresh SWR cache

**Push Notification Payloads:**
```typescript
{
  type: 'nudge' | 'milestone' | 'reengagement' | 'household_event',
  title: string,
  body: string,
  data?: { url?: string, actionType?: string }
}
```

**State Management Patterns:**
- Server state: SWR hooks per domain (`useHousehold`, `useGoals`, `useStreak`)
- UI state: React Context for cross-component state (`HouseholdContext`, `GamificationContext`)
- Optimistic updates: `mutate(newData, false)` → API call → `mutate()` revalidation
- No global state store (no Redux/Zustand)

### Process Patterns

**Error Handling:**
- API routes: try/catch → return `NextResponse.json({ error: { message } }, { status })`
- Client: SWR `error` state → Chakra UI `Alert` component
- Error boundaries: per-route, not per-component
- Financial data: never in error messages or logs

**Loading States:**
- SWR provides `isLoading` and `isValidating`
- Skeleton components for initial load (Chakra `Skeleton`)
- No full-page spinners — skeleton per section
- Gamification: local-first state, background sync (no loading flash)

**Authentication Flow:**
- Middleware checks auth on all `(dashboard)` and `(household)` routes
- API routes: `createServerSupabaseClient()` → verify session → proceed or 401
- Household routes: additional check — user is member of requested household

**Validation Pattern:**
- Client: Zod schemas in form via React Hook Form `zodResolver`
- Server: Same Zod schemas reused in API routes
- Database: constraints as last line of defense (CHECK, NOT NULL, FK)

### Enforcement Guidelines

**All AI Agents MUST:**
1. Follow existing naming conventions — check existing files before creating new ones
2. Place tests in `src/__tests__/` mirroring the source path
3. Use the service layer pattern — never call Supabase directly from API routes or components
4. Return API responses in the established `{ data }` / `{ error: { message } }` format
5. Use SWR hooks for data fetching — never `fetch()` directly in components
6. Validate with Zod on both client and server
7. Never expose financial amounts in error messages or console logs
8. Lazy-load gamification components with `next/dynamic`
9. Respect existing Chakra UI theme tokens — no hardcoded colors or spacing

**Anti-Patterns (MUST AVOID):**
- Calling Supabase client directly in React components (use hooks → services)
- Using `any` type (TypeScript strict mode enforced)
- Storing financial amounts as float/number without DECIMAL
- Creating new Context providers when SWR hook would suffice
- Adding gamification logic to core financial components
- Hardcoding household IDs or user IDs in queries (always derive from auth session)
- Full-page loading spinners instead of section skeletons
- Importing gamification modules in non-gamification bundles

## Project Structure & Boundaries

### Complete Project Directory Structure

```
smart-budget-application/
├── .github/
│   └── workflows/
│       └── test.yml                    # CI/CD pipeline
├── public/
│   ├── icons/                          # PWA icons, category icons
│   ├── manifest.json                   # PWA manifest
│   └── sw.js                           # NEW: Service worker (push notifications)
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql      # Phase 1 schema
│   │   ├── 002_households.sql          # NEW: households, household_members, invitations
│   │   ├── 003_goals.sql               # NEW: goals, goal_contributions, wishlists
│   │   ├── 004_gamification.sql        # NEW: streaks, budget_scores, achievements, user_achievements
│   │   ├── 005_subscriptions.sql       # NEW: detected_subscriptions
│   │   ├── 006_push.sql               # NEW: push_subscriptions
│   │   ├── 007_user_preferences.sql    # NEW: user_preferences, transparency_settings
│   │   └── 008_household_rls.sql       # NEW: expanded RLS policies
│   ├── seed.sql
│   └── config.toml
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx                # Dashboard
│   │   │   ├── layout.tsx              # Dashboard layout
│   │   │   ├── transactions/page.tsx
│   │   │   ├── categories/page.tsx
│   │   │   ├── insights/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   ├── goals/                  # NEW
│   │   │   │   └── page.tsx            # Goals management
│   │   │   ├── heatmap/                # NEW
│   │   │   │   └── page.tsx            # Spending heatmap
│   │   │   └── subscriptions/          # NEW
│   │   │       └── page.tsx            # Subscription graveyard
│   │   ├── (household)/                # NEW: Household route group
│   │   │   ├── layout.tsx              # Household layout with context provider
│   │   │   ├── dashboard/page.tsx      # Shared household dashboard
│   │   │   ├── members/page.tsx        # Member management
│   │   │   ├── settings/page.tsx       # Transparency & contribution settings
│   │   │   ├── goals/page.tsx          # Shared goals
│   │   │   └── invite/page.tsx         # Invitation acceptance
│   │   ├── api/
│   │   │   ├── transactions/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── categories/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── insights/
│   │   │   │   └── route.ts
│   │   │   ├── export/
│   │   │   │   ├── csv/route.ts
│   │   │   │   └── pdf/route.ts
│   │   │   ├── households/             # NEW
│   │   │   │   ├── route.ts            # POST create, GET list
│   │   │   │   ├── [id]/route.ts       # GET, PUT, DELETE household
│   │   │   │   ├── [id]/members/route.ts     # GET members, DELETE remove
│   │   │   │   └── [id]/invite/route.ts      # POST send invitation
│   │   │   ├── invitations/            # NEW
│   │   │   │   └── [token]/route.ts    # POST accept invitation
│   │   │   ├── goals/                  # NEW
│   │   │   │   ├── route.ts            # POST create, GET list
│   │   │   │   ├── [id]/route.ts       # GET, PUT, DELETE
│   │   │   │   └── [id]/contribute/route.ts  # POST contribution
│   │   │   ├── gamification/           # NEW
│   │   │   │   ├── streak/route.ts     # GET streak status
│   │   │   │   ├── score/route.ts      # GET budget score
│   │   │   │   └── achievements/route.ts     # GET achievements
│   │   │   ├── subscriptions/          # NEW
│   │   │   │   └── route.ts            # GET detected, PUT status
│   │   │   ├── push/                   # NEW
│   │   │   │   ├── subscribe/route.ts  # POST subscribe to push
│   │   │   │   └── unsubscribe/route.ts # POST unsubscribe
│   │   │   ├── digest/                 # NEW
│   │   │   │   └── route.ts            # GET weekly digest data
│   │   │   └── cron/                   # NEW
│   │   │       ├── weekly-digest/route.ts      # Vercel Cron
│   │   │       ├── streak-check/route.ts       # Vercel Cron
│   │   │       └── subscription-detect/route.ts # Vercel Cron
│   │   ├── layout.tsx
│   │   ├── providers.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── transactions/
│   │   │   ├── TransactionCard.tsx
│   │   │   ├── TransactionForm.tsx
│   │   │   ├── TransactionList.tsx
│   │   │   ├── QuickAmountInput.tsx
│   │   │   └── DateQuickPicker.tsx
│   │   ├── dashboard/
│   │   │   ├── StatCard.tsx
│   │   │   ├── DashboardStats.tsx
│   │   │   ├── ChartContainer.tsx
│   │   │   ├── SpendingByCategory.tsx
│   │   │   └── SpendingTrends.tsx
│   │   ├── categories/
│   │   │   ├── CategorySelector.tsx
│   │   │   ├── CategoryBadge.tsx
│   │   │   └── CategoryManager.tsx
│   │   ├── insights/
│   │   │   ├── AIInsightCard.tsx
│   │   │   └── InsightsList.tsx
│   │   ├── common/
│   │   │   ├── FloatingActionButton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── forms/
│   │   │   └── FormField.tsx
│   │   ├── household/                  # NEW
│   │   │   ├── HouseholdDashboard.tsx
│   │   │   ├── MemberList.tsx
│   │   │   ├── MemberCard.tsx
│   │   │   ├── InvitationForm.tsx
│   │   │   ├── TransparencySettings.tsx
│   │   │   ├── ContributionSplitEditor.tsx
│   │   │   ├── SharedGoalCard.tsx
│   │   │   └── TransparencyPresetPicker.tsx
│   │   ├── gamification/               # NEW (all lazy-loaded)
│   │   │   ├── StreakDisplay.tsx
│   │   │   ├── BudgetScore.tsx
│   │   │   ├── AchievementCard.tsx
│   │   │   ├── AchievementGrid.tsx
│   │   │   ├── ComebackChallenge.tsx
│   │   │   ├── MilestoneAnimation.tsx
│   │   │   └── LevelBadge.tsx
│   │   ├── ai/                         # NEW
│   │   │   ├── SpendingHeatmap.tsx
│   │   │   ├── WeeklyDigestCard.tsx
│   │   │   ├── SubscriptionGraveyard.tsx
│   │   │   ├── SmartNudge.tsx
│   │   │   ├── BudgetForecast.tsx
│   │   │   ├── RecoveryPlan.tsx
│   │   │   └── PatternDetector.tsx
│   │   └── goals/                      # NEW
│   │       ├── GoalCard.tsx
│   │       ├── GoalForm.tsx
│   │       ├── GoalProgress.tsx
│   │       ├── WishlistItem.tsx
│   │       └── WhatIfSimulator.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── services/
│   │   │   ├── transactionService.ts
│   │   │   ├── categoryService.ts
│   │   │   ├── insightService.ts
│   │   │   ├── exportService.ts
│   │   │   ├── householdService.ts     # NEW
│   │   │   ├── invitationService.ts    # NEW
│   │   │   ├── goalService.ts          # NEW
│   │   │   ├── gamificationService.ts  # NEW
│   │   │   ├── subscriptionService.ts  # NEW
│   │   │   ├── pushService.ts          # NEW
│   │   │   └── digestService.ts        # NEW
│   │   ├── ai/
│   │   │   ├── insightRules.ts
│   │   │   ├── spendingAnalysis.ts
│   │   │   ├── budgetRecommendations.ts
│   │   │   ├── patternDetection.ts     # NEW: anomaly & trend detection
│   │   │   ├── forecastEngine.ts       # NEW: predictive budget forecasting
│   │   │   ├── nudgeEngine.ts          # NEW: smart nudge generation
│   │   │   ├── recoveryPlanner.ts      # NEW: budget recovery plans
│   │   │   └── subscriptionDetector.ts # NEW: recurring charge analysis
│   │   ├── gamification/               # NEW
│   │   │   ├── streakCalculator.ts
│   │   │   ├── scoreCalculator.ts
│   │   │   ├── achievementDefinitions.ts
│   │   │   └── achievementChecker.ts
│   │   ├── utils/
│   │   │   ├── dateUtils.ts
│   │   │   ├── formatters.ts
│   │   │   ├── validators.ts
│   │   │   ├── constants.ts
│   │   │   └── moneyUtils.ts           # NEW: safe decimal arithmetic
│   │   ├── hooks/
│   │   │   ├── useTransactions.ts
│   │   │   ├── useCategories.ts
│   │   │   ├── useInsights.ts
│   │   │   ├── useBreakpoint.ts
│   │   │   ├── useDebounce.ts
│   │   │   ├── useHousehold.ts         # NEW
│   │   │   ├── useHouseholdMembers.ts  # NEW
│   │   │   ├── useGoals.ts             # NEW
│   │   │   ├── useStreak.ts            # NEW
│   │   │   ├── useBudgetScore.ts       # NEW
│   │   │   ├── useAchievements.ts      # NEW
│   │   │   ├── useSubscriptions.ts     # NEW
│   │   │   ├── useWeeklyDigest.ts      # NEW
│   │   │   ├── useRealtimeHousehold.ts # NEW: Supabase Realtime hook
│   │   │   └── usePushNotifications.ts # NEW
│   │   ├── contexts/                   # NEW
│   │   │   ├── HouseholdContext.tsx
│   │   │   └── GamificationContext.tsx
│   │   ├── schemas/                    # NEW: shared Zod schemas
│   │   │   ├── householdSchemas.ts
│   │   │   ├── goalSchemas.ts
│   │   │   ├── invitationSchemas.ts
│   │   │   └── transparencySchemas.ts
│   │   └── test-utils/
│   │       └── (existing test utilities)
│   │
│   ├── types/
│   │   ├── database.types.ts
│   │   ├── transaction.types.ts
│   │   ├── category.types.ts
│   │   ├── insight.types.ts
│   │   ├── household.types.ts          # NEW
│   │   ├── goal.types.ts               # NEW
│   │   ├── gamification.types.ts       # NEW
│   │   ├── subscription.types.ts       # NEW
│   │   ├── push.types.ts               # NEW
│   │   └── index.ts
│   │
│   ├── theme/
│   │   ├── index.ts
│   │   ├── colors.ts
│   │   ├── components/
│   │   └── foundations.ts
│   │
│   ├── __tests__/
│   │   ├── components/
│   │   │   ├── (existing component tests)
│   │   │   ├── household/              # NEW
│   │   │   ├── gamification/           # NEW
│   │   │   ├── ai/                     # NEW
│   │   │   └── goals/                  # NEW
│   │   ├── services/
│   │   │   ├── (existing service tests)
│   │   │   ├── householdService.test.ts  # NEW
│   │   │   ├── goalService.test.ts       # NEW
│   │   │   └── gamificationService.test.ts # NEW
│   │   ├── api/
│   │   │   ├── (existing API tests)
│   │   │   ├── households/             # NEW
│   │   │   ├── goals/                  # NEW
│   │   │   └── gamification/           # NEW
│   │   ├── integration/                # NEW
│   │   │   ├── household-rls.test.ts
│   │   │   ├── transparency-levels.test.ts
│   │   │   ├── invitation-flow.test.ts
│   │   │   └── cross-household-isolation.test.ts
│   │   ├── ai/                         # NEW
│   │   │   ├── patternDetection.test.ts
│   │   │   ├── forecastEngine.test.ts
│   │   │   └── subscriptionDetector.test.ts
│   │   └── utils/
│   │       └── (existing util tests)
│   │
│   └── middleware.ts
│
├── .env.local.example
├── .eslintrc.json
├── .gitignore
├── next.config.js
├── vercel.json                         # NEW: cron job configuration
├── package.json
├── tsconfig.json
└── README.md
```

### Architectural Boundaries

**API Boundaries:**
- `/api/transactions`, `/api/categories`, `/api/insights`, `/api/export` — existing, solo-user scoped via RLS
- `/api/households/**` — household management, requires household membership validation
- `/api/goals/**` — supports both solo (`user_id` only) and household (`household_id`) goals
- `/api/gamification/**` — read-only endpoints, state computed by services/cron
- `/api/cron/**` — secured by `CRON_SECRET` header, no user auth
- `/api/push/**` — push subscription management, user-scoped

**Component Boundaries:**
- Core financial (`transactions/`, `categories/`, `dashboard/`) — NEVER import from `gamification/` or `household/`
- Gamification (`gamification/`) — self-contained, lazy-loaded, imports only from `lib/gamification/` and `lib/hooks/`
- Household (`household/`) — self-contained in `(household)/` route group, uses `HouseholdContext`
- AI (`ai/`) — imports from `lib/ai/` and `lib/hooks/`, no direct Supabase access

**Data Boundaries:**
- Solo user data: RLS via `auth.uid() = user_id` (existing pattern)
- Household shared data: RLS via `household_members` membership check + transparency filter
- Gamification data: user-scoped only, no cross-user visibility
- AI insights: user-scoped; household insights aggregated server-side respecting transparency

**Service Boundaries:**
- Each service owns one domain — no cross-service imports
- Services access Supabase via `server.ts` client
- API routes import services, never other API routes
- Hooks import services, never Supabase directly

### Requirements to Structure Mapping

| FR Group | Routes | Components | Services | AI Logic |
|----------|--------|------------|----------|----------|
| FR1-FR8 (AI Intelligence) | `/api/insights` | `ai/` | `insightService` | `ai/*.ts` |
| FR9-FR12 (Visualization) | `(dashboard)/heatmap`, `/api/digest` | `ai/SpendingHeatmap`, `ai/WeeklyDigestCard` | `digestService` | `patternDetection` |
| FR13-FR17 (Goals) | `(dashboard)/goals`, `/api/goals` | `goals/` | `goalService` | — |
| FR18-FR23 (Household) | `(household)/**`, `/api/households` | `household/` | `householdService`, `invitationService` | — |
| FR24-FR27 (Privacy) | `(household)/settings` | `household/TransparencySettings` | `householdService` | — |
| FR28-FR33 (Gamification) | `/api/gamification` | `gamification/` | `gamificationService` | — |
| FR34-FR35 (Values) | `(dashboard)/settings` | extends settings | extends preferences | — |
| FR36-FR41 (Platform) | All routes | `common/` | All services | — |

### Data Flow

**Solo User Flow:**
```
User → Component → SWR Hook → API Route → Service → Supabase (RLS: user_id)
```

**Household Flow:**
```
User → Component → SWR Hook → API Route → Service → Supabase (RLS: household membership + transparency)
              ↑
    Realtime subscription ← Supabase Realtime (channel: household:{id})
```

**AI Insight Flow:**
```
Cron/User Request → API Route → insightService → ai/*.ts engines → Supabase (read transactions) → generate insights → Supabase (write insights)
```

**Push Notification Flow:**
```
Cron/Event → pushService → Web Push API → Service Worker → Browser Notification
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All 15 Phase 2 ADRs (010-024) extend the established Phase 1 stack without conflicts. Supabase Realtime, Web Push API, and Vercel Cron integrate natively with Next.js 15 + Supabase. No version incompatibilities detected — all technologies are part of or compatible with the existing dependency tree.

**Pattern Consistency:**
Naming conventions (snake_case DB, camelCase JS, PascalCase components) applied uniformly to all Phase 2 additions. Service layer pattern extended consistently to all 7 new services. API response format (`{ data }` / `{ error: { message } }`) maintained across all new endpoints.

**Structure Alignment:**
New route groups (`(household)/`), component directories, and service files follow the established feature-based organization. Test structure mirrors source structure. No structural contradictions with Phase 1 patterns.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage (41/41):**

| FR Group | ADRs | Components | Services | Status |
|----------|------|------------|----------|--------|
| FR1-FR8 (AI Intelligence) | ADR-014 | `ai/` | `insightService`, `lib/ai/*.ts` | ✅ Covered |
| FR9-FR12 (Visualization) | ADR-019 | `ai/SpendingHeatmap`, `ai/WeeklyDigestCard` | `digestService` | ✅ Covered |
| FR13-FR17 (Goals) | ADR-013 | `goals/` | `goalService` | ✅ Covered |
| FR18-FR23 (Household) | ADR-010, ADR-015, ADR-016 | `household/` | `householdService`, `invitationService` | ✅ Covered |
| FR24-FR27 (Privacy) | ADR-011, ADR-015 | `household/TransparencySettings` | `householdService` | ✅ Covered |
| FR28-FR33 (Gamification) | ADR-012, ADR-020 | `gamification/` | `gamificationService` | ✅ Covered |
| FR34-FR35 (Values) | ADR-022 | extends settings | extends preferences | ✅ Covered |
| FR36-FR41 (Platform) | ADR-022, ADR-023 | `common/` | all services | ✅ Covered |

**Non-Functional Requirements Coverage:**

| NFR Category | Architectural Support | Status |
|-------------|----------------------|--------|
| Performance (<500ms household sync) | Scoped Realtime subscriptions (ADR-017), lazy loading (ADR-020) | ✅ |
| Security (RLS, isolation) | Dual-path RLS (ADR-015), invitation tokens (ADR-016) | ✅ |
| Scalability (1,000 users) | Indexed queries (ADR-024), scoped subscriptions, Vercel serverless | ✅ |
| Accessibility (WCAG 2.1 A) | Chakra UI, `prefers-reduced-motion`, `aria-live` regions | ✅ |
| Reliability (zero critical bugs) | Graceful degradation, last-write-wins, DECIMAL(12,2) | ✅ |

### Implementation Readiness Validation ✅

**Decision Completeness:**
- 15 ADRs with clear decisions, rationale, and affected epics
- All technology choices verified against existing stack
- Implementation sequence defined with dependency ordering

**Structure Completeness:**
- Complete directory tree with all new files and directories marked
- Clear boundary rules: which components can import from where
- Requirements-to-structure mapping for all 41 FRs

**Pattern Completeness:**
- Naming patterns cover DB, API, code, and file naming
- Process patterns cover error handling, loading states, auth flow, validation
- Communication patterns cover Realtime events, push notifications, state management

### Gap Analysis Results

**No Critical Gaps.**

**Minor Gaps (Non-blocking, documented for future resolution):**

1. **`category_only` transparency implementation** — ADR-015 leaves open whether aggregation happens in RLS or API layer. *Decision for implementation:* API-layer aggregation for MVP simplicity; can strengthen to RLS-level enforcement post-MVP.

2. **Weekly digest timezone handling** — Cron runs at fixed UTC time. *Decision for implementation:* Acceptable for MVP (1-10 users). Add `timezone` field to `user_preferences` when user base grows.

3. **Sentry SDK specifics** — ADR-023 names Sentry but not the exact package. *Decision for implementation:* Use `@sentry/nextjs` with standard Next.js integration pattern.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (brownfield, 10 epics complete)
- [x] Scale and complexity assessed (high complexity, fintech domain)
- [x] Technical constraints identified (solo developer, Supabase tier limits)
- [x] Cross-cutting concerns mapped (8 concerns identified)

**✅ Architectural Decisions**
- [x] 15 Phase 2 ADRs documented with versions and rationale
- [x] Technology stack fully specified (extends Phase 1)
- [x] Integration patterns defined (Realtime, Push, Cron)
- [x] Performance considerations addressed (lazy loading, indexed queries, scoped subs)

**✅ Implementation Patterns**
- [x] Naming conventions established (DB, API, code, files)
- [x] Structure patterns defined (feature-based, service layer)
- [x] Communication patterns specified (Realtime, push payloads, state management)
- [x] Process patterns documented (error handling, loading, auth, validation)

**✅ Project Structure**
- [x] Complete directory structure defined with Phase 2 additions
- [x] Component boundaries established (core/household/gamification/AI isolation)
- [x] Integration points mapped (4 data flow diagrams)
- [x] Requirements to structure mapping complete (41 FRs → specific files)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Brownfield foundation with 808+ tests and proven patterns reduces risk
- Additive schema design — no breaking changes to Phase 1 tables
- Clear component isolation — gamification, household, and AI are independently deployable
- Comprehensive RLS strategy ensures security at the data layer
- Implementation sequence respects dependency ordering

**Areas for Future Enhancement:**
- Strengthen `category_only` transparency from API-level to RLS-level enforcement
- Add user timezone support for scheduled notifications
- Consider Redis caching if insight computation exceeds Vercel function time limits
- Evaluate Supabase Edge Functions as alternative to Vercel Cron for complex background jobs

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions (ADR-010 through ADR-024) exactly as documented
- Use implementation patterns consistently — check existing files before creating new ones
- Respect project structure and component boundaries (no cross-boundary imports)
- Refer to this document for all architectural questions before making independent decisions

**Implementation Priority Order:**
1. Database schema migrations (new tables, indexes, enums)
2. Household RLS policies (security foundation)
3. Household CRUD + invitation flow
4. Real-time subscriptions
5. AI engine expansion
6. Gamification system
7. Push notifications
8. Background jobs (cron)
