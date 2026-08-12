---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - docs/phase-1/ux-design-specification.md
---

# Smart-Budget-Application - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Smart-Budget-Application Phase 2, decomposing the requirements from the PRD, Architecture, and UX Design into implementable stories. Phase 1 (Epics 1-10) is complete with 808+ tests. Phase 2 epics continue from Epic 11.

## Requirements Inventory

### Functional Requirements

**Financial Intelligence & AI Coaching:**
- FR1: The system detects spending anomalies and trends from transaction history, surfacing specific, actionable insights
- FR2: The system generates end-of-month budget projections based on current spending pace and historical patterns
- FR3: The system delivers real-time smart nudges connecting spending decisions to their impact on user goals
- FR4: The system generates structured 30-day budget recovery plans for unhealthy spending patterns
- FR5: The system detects recurring charges (subscriptions) and identifies unused ones based on frequency gaps
- FR6: The system provides seasonal and cyclical spending awareness by analyzing yearly patterns
- FR7: The system generates household-level spending insights that aggregate data while respecting transparency settings
- FR8: The system generates fresh AI analysis when a lapsed user returns, summarizing changes during their absence

**Financial Visualization & Awareness:**
- FR9: Users can view a weekly financial digest: spending totals, notable trends, actionable highlights
- FR10: Users can view a calendar-style spending heatmap showing daily spending intensity
- FR11: Users can view annualized projections of spending patterns
- FR12: Household members can view a shared dashboard: combined spending, contribution progress, shared goal status

**Goal Management & Savings:**
- FR13: Users can create savings goals with target amounts and deadlines
- FR14: Users receive visual celebrations and notifications at goal milestones (25%, 50%, 75%, 100%)
- FR15: Users can view a wishlist where each item shows projected impact on existing goals and budget
- FR16: Users can run "What If" simulations toggling spending habits to see projected annual savings impact
- FR17: Household members can create shared savings goals with per-member contribution tracking

**Household Collaboration:**
- FR18: Users can create a household and invite other users via email
- FR19: Invited users can join a household through a verified invitation flow
- FR20: Household members can set up shared budget categories visible and manageable by all members
- FR21: Household members can configure income-proportional contribution splits without exposing exact income
- FR22: Household admins can remove members, immediately revoking all shared data access
- FR23: The system enforces household data isolation at the database level — no cross-household access via any path

**Privacy & Transparency Controls:**
- FR24: Household members can set transparency levels per category: fully shared, category-totals-only, or fully private
- FR25: Users can select from predefined transparency presets (Newlyweds, Roommates, Partners) during household setup
- FR26: Users can maintain a personal allowance — a private budget within a household invisible to other members
- FR27: The system enforces transparency restrictions at the data layer — private data inaccessible via any access path

**Engagement & Gamification:**
- FR28: Users can build and maintain daily/weekly logging streaks with streak freeze capability
- FR29: Users can view a Budget Score (0-100) reflecting financial health with levels and progression
- FR30: Users can unlock achievements and badges through financial milestones and consistent behavior
- FR31: The system presents comeback challenges for lapsed users without punishing absence
- FR32: The system sends push notifications for smart nudges, milestone celebrations, re-engagement, and household events
- FR33: Users can opt in or out of gamification features without affecting core budgeting functionality

**Values-Based Financial Planning:**
- FR34: Users can define a values-based spending plan aligning budget allocations to personal priorities rather than strict caps
- FR35: Users can view spending in the context of stated values — whether money flows toward or away from what matters

**Platform & Account Management:**
- FR36: New users can complete onboarding and enter their first transaction within 2 minutes with no mandatory configuration
- FR37: Users receive progressive feature disclosure — advanced capabilities appear as usage patterns warrant
- FR38: Users can delete their account with full cascade deletion of all personal data and GDPR compliance
- FR39: The system displays financial advice disclaimers clarifying AI insights are informational, not licensed advice
- FR40: Gamification animations respect `prefers-reduced-motion` and degrade gracefully on low-end devices
- FR41: All interactive elements are keyboard-navigable and announced to screen readers

### NonFunctional Requirements

**Performance:**
- NFR1: Phase 1 benchmarks maintained: page load <2s on 3G, dashboard render <1s, transaction save <200ms, chart updates <300ms
- NFR2: Household real-time sync: <500ms for shared data updates between members
- NFR3: AI pattern analysis: <3 seconds, non-blocking background process
- NFR4: Gamification state: <100ms local updates (local-first, background sync)
- NFR5: Weekly digest: background job, no user-facing latency
- NFR6: No jank or blocked interactions during AI analysis or real-time sync
- NFR7: Phase 2 client bundle increase: <50KB gzipped total

**Security:**
- NFR8: Financial data encrypted at rest and in transit (TLS 1.2+)
- NFR9: Row-Level Security on every table — no data without valid auth
- NFR10: Household isolation verified by integration tests for every transparency level
- NFR11: Cross-household leakage impossible — verified at database layer
- NFR12: Invitation tokens: single-use, 48h expiry, tied to specific email
- NFR13: AI analysis server-side only — no sensitive data in client-side logic
- NFR14: Account deletion cascades all personal data within 30 days
- NFR15: No financial data in application logs, error reports, or analytics

**Scalability:**
- NFR16: MVP: 1-10 active users with zero performance degradation
- NFR17: Architecture supports 1,000 users without structural changes
- NFR18: Up to 10 members per household
- NFR19: AI performs within targets on up to 10,000 transactions per user
- NFR20: Indexed queries — no full table scans on key operations
- NFR21: Real-time subscriptions scoped per household, scaling linearly

**Accessibility:**
- NFR22: WCAG 2.1 Level A across all new features
- NFR23: Level AA where Chakra UI provides it by default
- NFR24: Gamification animations respect `prefers-reduced-motion`
- NFR25: Achievements and nudges announced via `aria-live` regions
- NFR26: Spending heatmap has accessible data table alternative
- NFR27: All forms fully keyboard-navigable
- NFR28: Color never sole indicator of meaning

**Reliability:**
- NFR29: Zero critical bugs for 30+ consecutive days before commercial launch
- NFR30: All new features covered by automated tests — expanding 800+ baseline
- NFR31: No regressions in Phase 1 functionality
- NFR32: Simultaneous household edits resolve correctly (last-write-wins with optimistic UI)
- NFR33: Financial calculations accurate to 2 decimal places, no floating-point drift
- NFR34: Graceful degradation: real-time sync falls back to SWR polling; AI falls back to rule-based insights
- NFR35: PWA offline transaction entry maintained for solo users

### Additional Requirements

**From Architecture (ADRs 010-024):**
- Brownfield project: no starter template needed, extend existing Next.js 15 + Supabase + Chakra UI stack
- Database migrations: additive-only schema changes (new tables, no breaking changes to Phase 1)
- ADR-010: Household multi-tenancy via `household_id` FK on shared categories/transactions
- ADR-011: Transparency levels stored as ENUM (`shared`, `category_only`, `private`) on categories
- ADR-012: Gamification uses separate tables (streaks, budget_scores, achievements, user_achievements)
- ADR-013: Goals table supports both solo (user_id only) and household (household_id) goals
- ADR-014: Detected subscriptions stored in dedicated table for Subscription Graveyard feature
- ADR-015: Dual-path RLS policies — owner access + household member access filtered by transparency
- ADR-016: Invitation tokens — single-use, 48h expiry, email-bound
- ADR-017: Supabase Realtime channels scoped per household, SWR fallback on disconnect
- ADR-018: Web Push API with VAPID keys, per-category notification toggles
- ADR-019: Vercel Cron for weekly digest, streak check, subscription detection
- ADR-020: Gamification components lazy-loaded via next/dynamic, feature gate via user_preferences
- ADR-021: Household route group `(household)/` with HouseholdContext provider
- ADR-022: Progressive disclosure via DB-backed user state tracking
- ADR-023: Sentry for error monitoring with financial data stripped from payloads
- ADR-024: Phase 2 database indexes for household, goals, streaks, members

**Implementation sequence from Architecture:**
1. Database schema migrations (foundation)
2. Household RLS policies (security before features)
3. Household CRUD + invitation flow
4. Real-time subscriptions
5. AI engine expansion
6. Gamification system
7. Push notifications
8. Background jobs (cron)

**From UX Design Specification (Phase 1 patterns to maintain):**
- Trust Blue theme (`#2b6cb0` primary) — all Phase 2 UI must use existing theme tokens
- Transaction entry must remain sub-30-second with existing flow preserved
- Dashboard-first information architecture with progressive disclosure
- Coaching tone for AI insights — encouraging, not judgmental, with specific dollar amounts
- Mobile-first responsive design: 320px → 2560px+
- Skeleton loading patterns (no full-page spinners)
- Standard CRUD form patterns with React Hook Form + Zod validation
- Category color system preserved for visual identification

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | 12 | Spending anomaly/trend detection |
| FR2 | 12 | End-of-month budget projections |
| FR3 | 12 | Real-time smart nudges |
| FR4 | 12 | 30-day budget recovery plans |
| FR5 | 11 | Subscription detection (Subscription Graveyard) |
| FR6 | 12 | Seasonal/cyclical spending awareness |
| FR7 | 13 | Household-level AI insights |
| FR8 | 12 | Lapsed user fresh AI analysis |
| FR9 | 11 | Weekly financial digest |
| FR10 | 11 | Spending heatmap |
| FR11 | 11 | Annualized spending projections |
| FR12 | 13 | Shared household dashboard |
| FR13 | 11 | Savings goals with targets/deadlines |
| FR14 | 11 | Goal milestone celebrations |
| FR15 | 14 | Wishlist with budget impact |
| FR16 | 14 | "What If" savings simulations |
| FR17 | 13 | Shared household savings goals |
| FR18 | 13 | Create household + invite |
| FR19 | 13 | Join household via invitation |
| FR20 | 13 | Shared budget categories |
| FR21 | 13 | Income-proportional contribution splits |
| FR22 | 13 | Member removal with access revocation |
| FR23 | 13 | Database-level household isolation |
| FR24 | 13 | Per-category transparency levels |
| FR25 | 13 | Transparency presets |
| FR26 | 13 | Personal allowance system |
| FR27 | 13 | Data-layer privacy enforcement |
| FR28 | 15 | Logging streaks with freeze |
| FR29 | 15 | Budget Score (0-100) |
| FR30 | 15 | Achievement/badge system |
| FR31 | 15 | Comeback challenges |
| FR32 | 15 | Push notifications |
| FR33 | 15 | Gamification opt-in/out |
| FR34 | 14 | Values-based spending plan |
| FR35 | 14 | Values-context spending view |
| FR36 | 11 | Zero-config onboarding (<2 min) |
| FR37 | 15 | Progressive feature disclosure |
| FR38 | 11 | GDPR account deletion |
| FR39 | 12 | Financial advice disclaimers |
| FR40 | 15 | Reduced motion respect |
| FR41 | 15 | Keyboard nav + screen reader |

## Epic List

### Epic 11: Smart Financial Awareness
Users gain passive financial intelligence through automated visualizations, subscription tracking, savings goals, and a weekly digest — making the app noticeably smarter without requiring new habits.
**FRs covered:** FR5, FR9, FR10, FR11, FR13, FR14, FR36, FR38

### Epic 12: AI Financial Intelligence
The app transforms from a passive tracker into a proactive financial coach that detects patterns, predicts budget outcomes, delivers smart nudges, and creates recovery plans.
**FRs covered:** FR1, FR2, FR3, FR4, FR6, FR8, FR39

### Epic 13: Household Collaboration
Partners, couples, and roommates can co-manage budgets with privacy-respecting transparency controls, shared categories, contribution tracking, and a shared dashboard.
**FRs covered:** FR7, FR12, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27

### Epic 14: Values & Financial Planning
Users align spending with personal priorities through values-based budgeting, wishlist impact analysis, and "What If" savings simulations.
**FRs covered:** FR15, FR16, FR34, FR35

### Epic 15: Gamification & Engagement
Engagement mechanics transform budgeting from a chore into a rewarding habit through streaks, scores, achievements, push notifications, and progressive feature disclosure.
**FRs covered:** FR28, FR29, FR30, FR31, FR32, FR33, FR37, FR40, FR41

## Epic 11: Smart Financial Awareness

Users gain passive financial intelligence through automated visualizations, subscription tracking, savings goals, and a weekly digest — making the app noticeably smarter without requiring new habits.

### Story 11.1: Streamlined Onboarding Flow

As a new user,
I want to complete setup and enter my first transaction within 2 minutes with no mandatory configuration,
So that I experience immediate value without friction.

**Acceptance Criteria:**

**Given** a user has just signed up
**When** they land on the post-registration screen
**Then** they are guided through a minimal onboarding (name, optional currency) and can enter their first transaction
**And** no step is mandatory beyond basic authentication
**And** total time from signup to first transaction is achievable in under 2 minutes

### Story 11.2: Subscription Detection (Subscription Graveyard)

As a budget-conscious user,
I want the system to detect my recurring charges and flag potentially unused subscriptions,
So that I can identify and cancel subscriptions I'm paying for but not using.

**Acceptance Criteria:**

**Given** a user has 3+ months of transaction history
**When** the system analyzes transactions for recurring patterns
**Then** subscriptions are detected and listed with name, amount, and frequency
**And** subscriptions with gaps in expected charges are flagged as "potentially unused"
**And** the user can view, dismiss, or mark subscriptions as "keep"

### Story 11.3: Spending Heatmap

As a user reviewing spending habits,
I want to view a calendar-style heatmap showing daily spending intensity,
So that I can quickly spot high-spend days and patterns at a glance.

**Acceptance Criteria:**

**Given** a user has transaction data for the selected period
**When** they navigate to the spending heatmap view
**Then** a calendar grid displays daily spending intensity using color gradients
**And** hovering/tapping a day shows the total amount and transaction count
**And** an accessible data table alternative is available for screen readers

### Story 11.4: Annualized Spending Projections

As a user planning finances,
I want to see annualized projections of my spending patterns,
So that I understand the yearly cost of my current habits.

**Acceptance Criteria:**

**Given** a user has at least 1 month of spending data
**When** they view the annualized projections
**Then** each spending category shows projected yearly cost based on current patterns
**And** projections account for known recurring vs one-time expenses
**And** the user can see how projections change compared to previous periods

### Story 11.5: Savings Goals

As a user saving toward specific targets,
I want to create savings goals with target amounts and deadlines,
So that I can track progress toward financial milestones.

**Acceptance Criteria:**

**Given** a logged-in user
**When** they create a new savings goal
**Then** they can set a name, target amount, and optional deadline
**And** the goal shows current progress as amount saved and percentage
**And** the user can add manual contributions to a goal
**And** goals are listed on a dedicated goals view

### Story 11.6: Goal Milestone Celebrations

As a user working toward savings goals,
I want to receive visual celebrations at key milestones (25%, 50%, 75%, 100%),
So that I feel motivated and rewarded for progress.

**Acceptance Criteria:**

**Given** a user has an active savings goal
**When** the goal reaches a milestone threshold (25%, 50%, 75%, 100%)
**Then** a celebration animation/notification is displayed
**And** the milestone is recorded so it only triggers once per threshold
**And** animations respect prefers-reduced-motion settings

### Story 11.7: Weekly Financial Digest

As a user who wants passive financial awareness,
I want to receive a weekly digest summarizing my spending, trends, and highlights,
So that I stay informed without actively checking the app daily.

**Acceptance Criteria:**

**Given** a user has opted into the weekly digest
**When** the weekly digest is generated (background job)
**Then** it includes: total spending for the week, comparison to previous week, top spending categories, and one actionable highlight
**And** the digest is viewable in-app
**And** the digest can be delivered as a push notification if enabled

### Story 11.8: GDPR Account Deletion

As a user who wants to leave the platform,
I want to delete my account with full cascade deletion of all personal data,
So that my privacy is protected and the app complies with GDPR.

**Acceptance Criteria:**

**Given** a logged-in user
**When** they initiate account deletion from settings
**Then** they must confirm the action with a secondary confirmation step
**And** all personal data (transactions, categories, goals, insights, preferences) is cascade deleted
**And** deletion completes within 30 days
**And** the user is logged out and cannot sign back in with the same credentials

## Epic 12: AI Financial Intelligence

The app transforms from a passive tracker into a proactive financial coach that detects patterns, predicts budget outcomes, delivers smart nudges, and creates recovery plans.

> **⚠️ Sprint sequencing note (added 2026-06-02).** The implementation sprint
> (`_bmad-output/implementation-artifacts/sprint-status.yaml`) sequences Epic 12
> by implementation dependency, so its story numbers differ from the planning
> numbers below. Use this mapping as the source of truth for traceability:
>
> | Plan (this file) | Sprint number | Title | Status |
> |------------------|---------------|-------|--------|
> | Story 12.2 | 12-1 | Spending Anomaly & Trend Detection | done |
> | Story 12.3 | 12-2 | End-of-Month Budget Projections | done |
> | Story 12.4 | 12-3 | Real-Time Smart Nudges | done |
> | Story 12.5 | 12-4 | 30-Day Budget Recovery Plans | backlog |
> | Story 12.6 | 12-5 | Seasonal & Cyclical Spending Awareness | backlog |
> | Story 12.7 | 12-6 | Lapsed User Re-engagement Analysis | backlog |
> | Story 12.1 | 12-7 | Financial Advice Disclaimers | done (2026-06-02) |
> | Story 12.8 | 12-8 | Engagement Analytics Dashboard | backlog |
>
> **FR32 partial delivery:** Sprint story 12-3 (Real-Time Smart Nudges, FR3)
> also implemented the Web Push infrastructure (VAPID keys, `push_subscriptions`
> table, service-worker push/notificationclick handlers) that FR32 / Epic 15
> Story 15.5 depends on. When Epic 15 is built, reuse this infrastructure rather
> than re-creating it.
>
> **Budget-limit proxy:** No budget-limits table exists in the MVP schema
> (confirmed in `architecture.md` and `insightService.ts`). Stories 12-2 and 12-3
> use each category's 3-month historical average as the budget proxy. Reconcile
> this if a dedicated budget table is added later.

### Story 12.1: Financial Advice Disclaimers

As a user viewing AI-generated insights,
I want clear disclaimers that insights are informational and not licensed financial advice,
So that I understand the limitations and the app avoids fiduciary liability.

**Acceptance Criteria:**

**Given** the system displays any AI-generated insight, nudge, or recovery plan
**When** the user views the content
**Then** a disclaimer is visible indicating the information is for educational purposes only and not licensed financial advice
**And** a persistent disclaimer is accessible from settings/about
**And** disclaimers do not obstruct the primary content

### Story 12.2: Spending Anomaly & Trend Detection

As a user tracking my budget,
I want the system to detect unusual spending patterns and surface actionable insights,
So that I'm alerted to problems before they become serious.

**Acceptance Criteria:**

**Given** a user has 2+ months of transaction history
**When** the AI analysis runs (background process)
**Then** anomalies (unusual spikes, new high-spend categories) are detected and surfaced as insights
**And** each insight includes the specific amount, category, and a plain-language explanation
**And** insights use a coaching tone — encouraging, not judgmental

### Story 12.3: End-of-Month Budget Projections

As a user managing monthly budgets,
I want to see projected end-of-month spending based on my current pace,
So that I know if I'm on track or heading for an overspend.

**Acceptance Criteria:**

**Given** a user has active budget categories with spending this month
**When** they view their budget dashboard
**Then** each category shows a projected end-of-month total based on current spending pace and historical patterns
**And** categories projected to exceed budget are visually flagged
**And** projections update as new transactions are added

### Story 12.4: Real-Time Smart Nudges

As a user making spending decisions,
I want to receive timely nudges connecting my spending to goal impact,
So that I can make more informed choices in the moment — both while using the app and when I'm away from it.

**Acceptance Criteria:**

**Given** a user has active goals and budget limits
**When** a transaction is saved that impacts a goal or approaches a budget limit
**Then** a contextual nudge is displayed connecting the transaction to its impact
**And** nudges are non-blocking (toast/banner, not modal) when the user is in-session

**Given** the user has granted push notification permission
**When** a significant budget event occurs (category > 80% of limit, goal at risk) and the user is not in an active session
**Then** a push notification is delivered to their device with a one-line summary and a deep link back to the relevant budget view
**And** the user can configure push notification preferences (enable/disable by nudge type) in Settings
**And** push notifications respect quiet hours (configurable, default: 22:00–08:00 local time)

### Story 12.5: 30-Day Budget Recovery Plans

As a user who has overspent,
I want the system to generate a structured recovery plan,
So that I have a clear path back to healthy spending.

**Acceptance Criteria:**

**Given** a user has exceeded budget in one or more categories
**When** they request or are offered a recovery plan
**Then** the system generates a 30-day plan with daily/weekly spending targets per category
**And** the plan is realistic based on the user's historical minimum spending
**And** progress against the plan is trackable

### Story 12.6: Seasonal & Cyclical Spending Awareness

As a user planning ahead,
I want the system to identify seasonal and cyclical spending patterns,
So that I can anticipate and prepare for predictable expenses.

**Acceptance Criteria:**

**Given** a user has 6+ months of transaction history
**When** the system analyzes yearly spending patterns
**Then** seasonal trends are identified (e.g., holiday spending, back-to-school, summer travel)
**And** upcoming predicted seasonal spikes are surfaced proactively
**And** the user sees a timeline of expected future expenses

### Story 12.7: Lapsed User Re-engagement Analysis

As a returning user after a period of inactivity,
I want a fresh AI summary of what changed during my absence,
So that I can quickly re-orient and continue managing my finances.

**Acceptance Criteria:**

**Given** a user returns after 14+ days of inactivity
**When** they open the app
**Then** a welcome-back summary is displayed with: spending changes, new subscription charges, goal progress/regression, and one recommended action
**And** the summary is generated as a background process (<3s)
**And** the user can dismiss the summary

### Story 12.8: Engagement Analytics Dashboard

As a product owner and power user,
I want to see how the app's AI insights and features are being used,
So that we can identify what's valuable and what to improve in future epics.

**Background:** Analytics events have been collected since Stories 9-4 (insight engagement) and 9-5 (export and PWA analytics). The data exists but has never been visualized.

**Acceptance Criteria:**

**Given** analytics data has been collected across multiple epics
**When** an authenticated user with the `analytics_viewer` role visits `/analytics`
**Then** they see a dashboard showing:
  - Insight engagement rate (views → dismissals → acted-on) per insight type over time
  - Export usage breakdown (CSV vs PDF, frequency, file size distribution)
  - PWA install funnel (prompt shown → installed → retained after 7 days)
  - Weekly active users trend

**And** all charts support date range filtering (last 7 / 30 / 90 days / custom)
**And** the dashboard is read-only and does not expose personally identifiable information
**And** access is restricted to users with the `analytics_viewer` role (enforced server-side)

## Epic 13: Household Collaboration

Partners, couples, and roommates can co-manage budgets with privacy-respecting transparency controls, shared categories, contribution tracking, and a shared dashboard.

### Story 13.1: Household Creation & Database Foundation

As a user who shares finances with others,
I want to create a household,
So that I can start managing shared budgets with my partner or roommates.

**Acceptance Criteria:**

**Given** a logged-in user with no existing household
**When** they create a new household
**Then** a household is created with the user as admin
**And** the household has database-level isolation (RLS policies enforce no cross-household access)
**And** the user can set a household name

### Story 13.2: Household Invitation Flow

As a household admin,
I want to invite other users to join my household via email,
So that we can collaborate on shared finances.

**Acceptance Criteria:**

**Given** a household admin
**When** they send an invitation to an email address
**Then** a single-use invitation token is generated with 48-hour expiry, tied to the specific email
**And** the invited user receives notification of the invitation
**And** duplicate invitations to the same email are prevented while an active invite exists

### Story 13.3: Join Household via Invitation

As an invited user,
I want to accept a household invitation and join the shared space,
So that I can participate in shared financial management.

**Acceptance Criteria:**

**Given** a user has received a valid invitation
**When** they accept the invitation
**Then** they are added as a member of the household
**And** expired or already-used tokens are rejected with a clear message
**And** the inviting admin is notified of the new member

### Story 13.4: Transparency Presets & Per-Category Controls

As a household member,
I want to choose a transparency preset and fine-tune visibility per category,
So that I control exactly what financial data is shared.

**Acceptance Criteria:**

**Given** a user is joining or configuring a household
**When** they set up transparency
**Then** they can select a preset (Newlyweds: mostly shared, Roommates: bills only, Partners: balanced)
**And** they can override any category to: fully shared, category-totals-only, or fully private
**And** transparency settings are enforced at the data layer — private data is inaccessible via any access path

### Story 13.5: Shared Budget Categories

As a household member,
I want to create and manage shared budget categories,
So that household expenses are tracked collectively.

**Acceptance Criteria:**

**Given** a household exists with 2+ members
**When** a member creates a shared budget category
**Then** the category is visible and manageable by all household members
**And** transactions tagged to shared categories appear in the shared view
**And** personal categories remain private to the individual

### Story 13.6: Personal Allowance System

As a household member,
I want to maintain a personal allowance — a private budget within the household,
So that I have financial autonomy for personal spending.

**Acceptance Criteria:**

**Given** a user is part of a household
**When** they configure a personal allowance
**Then** the allowance has its own budget amount invisible to other members
**And** transactions within the allowance are completely private
**And** the allowance does not affect shared budget calculations

### Story 13.7: Income-Proportional Contribution Splits

As a household member,
I want to configure contribution splits based on income proportions without revealing exact income,
So that shared expenses are divided fairly.

**Acceptance Criteria:**

**Given** a household has shared budget categories
**When** members configure contribution splits
**Then** they can enter a percentage (not an exact income amount)
**And** shared expenses show each member's fair share based on their percentage
**And** contribution progress is tracked against the fair share

### Story 13.8: Shared Household Dashboard

As a household member,
I want to view a shared dashboard showing combined spending, contribution progress, and shared goal status,
So that everyone has visibility into the household's financial health.

**Acceptance Criteria:**

**Given** a household has active shared categories and members
**When** a member views the household dashboard
**Then** it displays: combined spending by shared category, each member's contribution progress, and shared goal status
**And** only data permitted by transparency settings is shown
**And** the dashboard updates in real-time (<500ms) when another member makes changes

### Story 13.9: Shared Household Savings Goals

As a household member,
I want to create shared savings goals with per-member contribution tracking,
So that we can save together toward common targets.

**Acceptance Criteria:**

**Given** a household exists
**When** a member creates a shared savings goal
**Then** the goal is visible to all household members
**And** each member's contributions are tracked individually
**And** the goal shows total progress and per-member breakdown

### Story 13.10: Household-Level AI Insights

As a household member,
I want the system to generate spending insights at the household level,
So that we get collective financial intelligence.

**Acceptance Criteria:**

**Given** a household has shared transaction data
**When** the AI analysis runs for the household
**Then** insights aggregate shared data while respecting each member's transparency settings
**And** private category data is never included in household insights
**And** insights use household context (e.g., "Your household spent 20% more on groceries this month")

### Story 13.11: Member Removal & Access Revocation

As a household admin,
I want to remove a member from the household with immediate access revocation,
So that former members cannot access shared financial data.

**Acceptance Criteria:**

**Given** a household admin
**When** they remove a member
**Then** the member's access to all shared data is immediately revoked
**And** the member's personal data (private categories, allowance) is preserved for their solo use
**And** shared transactions attributed to the removed member remain in household history
**And** the removed member is notified

## Epic 14: Values & Financial Planning

Users align spending with personal priorities through values-based budgeting, wishlist impact analysis, and "What If" savings simulations.

### Story 14.1: Values-Based Spending Plan

As a user who wants intentional spending,
I want to define a values-based spending plan that aligns budget allocations to my personal priorities,
So that my money flows toward what matters most to me rather than just staying under arbitrary caps.

**Acceptance Criteria:**

**Given** a logged-in user
**When** they create a values-based spending plan
**Then** they can define personal values (e.g., Health, Family, Growth, Fun)
**And** they can assign budget categories to one or more values
**And** they can set a priority ranking for their values
**And** the plan is saved and editable from settings

### Story 14.2: Values-Context Spending View

As a user with a values-based plan,
I want to view my spending in the context of my stated values,
So that I can see whether my money flows toward or away from what matters.

**Acceptance Criteria:**

**Given** a user has defined values and mapped categories
**When** they view the values spending view
**Then** spending is grouped and visualized by value (not just category)
**And** each value shows total spend, percentage of overall budget, and trend direction
**And** misalignment is highlighted (e.g., "Fun" ranked #4 but receiving 35% of spend)

### Story 14.3: Wishlist with Budget Impact Analysis

As a user considering a purchase,
I want to add items to a wishlist and see the projected impact on my existing goals and budget,
So that I can make informed decisions about discretionary spending.

**Acceptance Criteria:**

**Given** a user has active goals and budget categories
**When** they add an item to their wishlist with a price
**Then** the system shows: impact on current month's remaining budget, delay to nearest savings goal deadline, and which value the purchase aligns with (if values plan exists)
**And** the user can mark items as "purchased" or "removed"
**And** the wishlist persists across sessions

### Story 14.4: "What If" Savings Simulations

As a user exploring financial changes,
I want to run simulations toggling spending habits to see projected annual savings impact,
So that I can understand the long-term effect of small changes.

**Acceptance Criteria:**

**Given** a user has spending history
**When** they open the "What If" simulator
**Then** they can toggle spending adjustments (e.g., "reduce dining out by 30%", "cancel Netflix")
**And** the simulator shows projected monthly and annual savings from the combined changes
**And** the impact on active savings goals is shown (e.g., "You'd reach your vacation goal 2 months earlier")
**And** simulations are exploratory — no changes are applied to actual budgets

## Epic 15: Gamification & Engagement

Engagement mechanics transform budgeting from a chore into a rewarding habit through streaks, scores, achievements, push notifications, and progressive feature disclosure.

### Story 15.1: Logging Streaks with Streak Freeze

As a user building financial habits,
I want to build and maintain daily/weekly logging streaks with streak freeze capability,
So that I'm motivated to log consistently without being punished for occasional misses.

**Acceptance Criteria:**

**Given** a user logs at least one transaction
**When** the streak system evaluates activity
**Then** consecutive days/weeks of logging increment the streak counter
**And** the user can activate a streak freeze (1 free per week) to preserve their streak during a missed day
**And** streak state updates locally in <100ms with background sync

### Story 15.2: Budget Score

As a user tracking financial health,
I want to view a Budget Score (0-100) reflecting my financial health with levels and progression,
So that I have a single metric showing how well I'm managing money.

**Acceptance Criteria:**

**Given** a user has budget categories and transaction history
**When** they view their Budget Score
**Then** a score from 0-100 is displayed based on: budget adherence, logging consistency, and goal progress
**And** the score includes a level/tier (e.g., Beginner, Steady, Master)
**And** the user can see which factors are helping or hurting their score
**And** the score updates after each transaction

### Story 15.3: Achievement & Badge System

As a user reaching financial milestones,
I want to unlock achievements and badges through milestones and consistent behavior,
So that I feel a sense of accomplishment and progression.

**Acceptance Criteria:**

**Given** a user performs trackable actions (first transaction, 7-day streak, first goal completed, etc.)
**When** a milestone condition is met
**Then** the achievement is unlocked with a visual notification
**And** badges are displayed on a dedicated achievements view
**And** each badge shows the unlock date and condition
**And** animations respect prefers-reduced-motion settings

### Story 15.4: Comeback Challenges

As a returning user after a period of inactivity,
I want to be presented with a comeback challenge instead of punishment,
So that I'm encouraged to re-engage rather than feeling guilty about my absence.

**Acceptance Criteria:**

**Given** a user returns after 7+ days of inactivity
**When** they open the app
**Then** a friendly comeback challenge is presented (e.g., "Log 3 transactions this week to reignite your streak")
**And** completing the challenge restores a portion of the previous streak
**And** the challenge is optional and dismissible
**And** no negative messaging about the absence

### Story 15.5: Push Notifications

As a user who wants timely financial nudges,
I want to receive push notifications for smart nudges, milestones, re-engagement, and household events,
So that I stay engaged without needing to open the app.

**Acceptance Criteria:**

**Given** a user has granted notification permissions
**When** a notifiable event occurs (nudge, milestone, comeback, household invite)
**Then** a push notification is delivered via Web Push API
**And** the user can configure per-category notification toggles (nudges, achievements, household, digest)
**And** notifications link to the relevant in-app view
**And** users who decline permissions are never re-prompted

### Story 15.6: Gamification Opt-In/Out

As a user who may or may not want gamification,
I want to opt in or out of gamification features without affecting core budgeting,
So that I can use the app my way.

**Acceptance Criteria:**

**Given** a logged-in user
**When** they toggle gamification in settings
**Then** all gamification UI (streaks, scores, badges, challenges) is shown or hidden
**And** core budgeting features (transactions, budgets, goals, insights) work identically regardless of the toggle
**And** opting out preserves gamification data (can opt back in later)

### Story 15.7: Progressive Feature Disclosure

As a new user,
I want advanced features to appear gradually as my usage warrants,
So that I'm not overwhelmed on day one.

**Acceptance Criteria:**

**Given** a user's activity state is tracked (transaction count, days active, features used)
**When** usage thresholds are met
**Then** new features are surfaced with a brief introduction (e.g., "You've logged 30 transactions — check out your Spending Heatmap")
**And** users can access all features early via settings if they choose
**And** disclosure state is persisted per user

### Story 15.8: Accessibility Compliance for Engagement Features

As a user with accessibility needs,
I want all gamification and engagement features to be fully keyboard-navigable and screen-reader friendly,
So that engagement features are inclusive.

**Acceptance Criteria:**

**Given** a user navigates engagement features (streaks, scores, badges, notifications)
**When** they use keyboard or screen reader
**Then** all interactive elements are keyboard-navigable with visible focus indicators
**And** achievements and nudges are announced via aria-live regions
**And** animations respect prefers-reduced-motion and degrade gracefully on low-end devices
**And** color is never the sole indicator of meaning

---

## Epic 16: Design System Rollout (Phase 3)

**Phase:** 3 (post–Phase 2). Follows the "Quiet Ledger" frontend redesign whose
foundation (design-system tokens + app shell + dashboard) shipped 2026-07-23
(commits `0674eda`→`2712c7d`, see memory `redesign-quiet-ledger`).

**Goal:** Roll the Quiet Ledger design system deep into every remaining primary
screen so the whole product — not just the dashboard — reads as one cohesive,
premium, mobile-first personal-finance companion. Each screen moves from
"inherits the new theme" to "deliberately redesigned for its job."

**Design system to apply (already on main):** evergreen `accent`, `income`
(evergreen) / `expense` (clay, never alarm-red), warm `canvas`/`surface`
semantic tokens with a dark-ready set; Space Grotesk (display + tabular
amounts, `.tnum`) + Onest (body); Card/Button/Heading variants; `SectionHeader`
primitive; soft radii/shadows; `prefers-reduced-motion` baseline. Reuse these —
do NOT invent new tokens per screen.

**Cross-cutting constraints (every story):** preserve all existing
functionality (data fetching, realtime, filters, optimistic mutations, exports,
i18n en+bg with CI-enforced parity, offline handling); keep the full jest suite
green (baseline 2052 pass / 54 skip); no horizontal overflow at 320px; ≥44px
touch targets; visible focus; AA contrast; honor reduced motion. GitHub-Flow:
one branch + PR (Vercel preview) per story → review → merge to main.

**Stories:**

### Story 16.1: Transactions Screen Redesign

As a person reviewing my money,
I want the Transactions screen to be a calm, scannable, mobile-first list,
so that I can find and understand any transaction at a glance and act on it fast.

**Acceptance Criteria:**

**Given** the transactions list
**When** it renders
**Then** transactions are grouped under clear date headers (Today / Yesterday / weekday · date) instead of one flat chronological run
**And** each row reads as a calm line — category identity + description/notes + time context on the left, amount on the right — not a heavy full card per transaction
**And** amounts use the `income` (evergreen) / `expense` (clay) semantic tokens with tabular figures, and income/expense is ALSO signalled by a sign/glyph, never colour alone
**And** the type indicator is localized (not the raw `"income"`/`"expense"` string)

**Given** filters and search
**When** I use them on mobile or desktop
**Then** search stays prominent and always visible, secondary filters collapse behind a clear control on mobile, and every existing filter (date range, category, type, currency), the debounced search, URL drill-down, filter breadcrumbs, and pagination keep working exactly as before

**Given** the list has no results
**When** it is empty (no transactions vs. filtered-to-empty)
**Then** I see a guiding empty state with a clear next action ("Add your first transaction") for the no-data case, and a distinct "no matches — clear filters" state for the filtered case

**Given** loading / error / offline / delete-undo / CSV-export flows
**When** they occur
**Then** they keep their existing behavior (skeletons, realtime sync, pull-to-refresh, swipe-to-edit/delete on mobile, optimistic delete with 5s undo, large-export progress modal, offline banner) restyled onto the new design system, with no functional regression

### Story 16.2: Transaction Composer Redesign

As a person adding money in or out,
I want an amount-first, bottom-sheet composer,
so that I can record a transaction in under 20 seconds on my phone.

(Amount-led numeric input, fast expense/income toggle, recent + frequent
categories, optional notes/date/recurring, optimistic save + clear confirm.
Builds on the existing `TransactionEntryModal`.)

### Story 16.3: Categories Screen Redesign

As a person organizing spending,
I want a visual categories screen showing spend, budgets and trends per category,
so that categories feel understandable, not like an admin settings table.

### Story 16.4: Insights Screen Redesign

As a person trying to improve my finances,
I want prioritized, categorized AI insights (what changed / opportunities /
progress / warnings / recommendations),
so that the single most valuable insight is obvious first.

### Story 16.5: Settings Screen Redesign + Dark Mode

As a person managing my account,
I want grouped, mobile-native settings and a Light/Dark/System appearance toggle,
so that settings are simple and I can use the app in the mode I prefer (the
semantic tokens are already dark-ready).

### Story 16.6: Dashboard Period Selector

As a person reviewing my money over time,
I want a Week/Month/3-Months/Year selector on the dashboard hero,
so that I can see my balance and flow for the period I care about.

### Story 16.7: Goals & Household Screen Polish

As a person using shared and goal features,
I want Goals and Household brought onto the restructured layouts and design
system, so that the whole app feels consistent.
