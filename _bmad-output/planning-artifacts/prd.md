---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - docs/phase-1/PRD.md
  - docs/phase-1/product-brief-Smart-Budget-Application-2025-11-14.md
  - docs/phase-1/architecture.md
  - docs/phase-1/ux-design-specification.md
  - _bmad-output/brainstorming/brainstorming-session-2026-03-23-001.md
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 3
classification:
  projectType: 'web_app'
  domain: 'fintech'
  complexity: 'high'
  projectContext: 'brownfield'
---

# Product Requirements Document — Smart Budget Application Phase 2

**Author:** Nikit
**Date:** 2026-03-23
**Type:** Web Application (PWA) | Fintech | High Complexity | Brownfield
**Platform:** Next.js 15 App Router + Supabase + Chakra UI (Epics 1-10 complete, 808+ tests, full i18n/multi-currency/PWA)

## Executive Summary

Smart Budget Application Phase 2 evolves the existing personal finance tracker into an intelligent household financial operating system. Three interconnected capability pillars drive this evolution:

1. **AI Financial Intelligence** — proactive coaching on spending patterns, predictions, and savings opportunities
2. **Household Collaboration** — partners and roommates co-manage budgets with privacy-respecting transparency controls
3. **Gamification** — engagement mechanics that transform budgeting from a chore into a daily habit

The target expands from solo users to households — couples managing shared expenses, roommates splitting bills, families saving toward common goals. The product begins as a personal-use tool with a clear path to public launch, where household features drive multi-user adoption and gamification drives retention.

### What Makes This Special

No existing budget app combines all three pillars:

| Competitor | AI | Household | Gamification | All Three? |
|-----------|-----|-----------|--------------|-----------|
| YNAB | No | Basic shared | No | No |
| Mint | Basic | No | No | No |
| Splitwise | No | Splitting only | No | No |
| Goodbudget | No | Shared envelopes | No | No |
| Copilot Money | Yes | No | No | No |
| **Smart Budget Phase 2** | **Advanced** | **Privacy-respecting** | **Full system** | **Yes** |

The core insight: when AI coaching, social accountability, and gamification reinforce each other, users stick with budgeting. AI detects a household overspending on dining, nudges each partner with personalized suggestions, and rewards them with milestone celebrations when they hit their shared savings goal. Each pillar amplifies the others — AI makes household insights smarter, household context makes AI more relevant, gamification makes both feel rewarding.

## Success Criteria

### User Success

**Core Principle:** Every feature earns its place by solving a real problem, not by looking good on a feature list.

- AI insights are specific, timely, and actionable — users *do something different* as a result
- Household members both actively engage with shared budgets — not one person doing all the work
- Gamification motivates real behavior change (saving more, spending less) — not just collecting badges
- New features integrate seamlessly with existing flows — transaction entry stays under 30 seconds, dashboard stays glanceable
- Zero data inconsistency — financial data accurate across all household members and devices

### Business Success

**Phase 2 Validation (Personal Use):**
- Nikit uses all three pillars consistently for 3+ months without reverting to simpler tools
- At least one household test group actively co-manages a shared budget for 1+ month
- The app feels ready to show to others without caveats

**Commercial Readiness Indicators:**
- Zero critical bugs in production for 30+ consecutive days
- All existing performance benchmarks maintained with new features active
- New users productive within 2 minutes, no tutorial needed
- Household users return more frequently than solo users (proving the social model)

### Technical Success

- All new features covered by automated tests — maintaining 800+ test standard
- No regressions in existing functionality when new pillars are added
- Household RLS security: users can *never* see data they shouldn't — verified by integration tests
- AI pattern detection runs efficiently without degrading app performance
- Clean, maintainable codebase — new developers (or AI agents) can understand and extend any feature

### Measurable Outcomes

| Outcome | Target |
|---------|--------|
| App stability | Zero critical bugs for 30+ consecutive days |
| Test coverage | Maintain 800+ tests, expand with each epic |
| AI insight relevance | >80% of generated insights are actionable (not generic) |
| Household adoption | Both members active weekly in shared budget |
| Performance | Existing benchmarks maintained with all new features |
| Onboarding friction | New user productive within 2 minutes |

## Product Scope & Phased Development

### MVP Strategy

**Approach:** Problem-solving MVP — deliver features that make users' financial lives measurably better, validated by personal use before public launch.

**Resources:** Solo developer (Nikit) with AI-assisted development (Claude Code, BMAD Method). Household testing benefits from a second participant.

**Core Principle:** Each epic is independently valuable. If development pauses after any epic, the app is still better than before.

### Phase 2 MVP (Epics 11-12)

**Epic 11: Quick Wins — "The app just got smarter"**

| Feature | Journey Supported | Value |
|---------|------------------|-------|
| Weekly Financial Digest | Alex (Solo), Sam (New User) | Passive awareness without opening the app |
| Subscription Graveyard | Alex (Solo) | Immediate money savings with zero effort |
| Spending Heatmap | Alex (Solo), Sam (New User) | Visual pattern recognition at a glance |
| Goal Milestones with Celebrations | Alex (Solo), Sam (New User) | Emotional reward for saving progress |

**Epic 12: AI Financial Intelligence — "The app that coaches you"**

| Feature | Journey Supported | Value |
|---------|------------------|-------|
| Spending Pattern Detective | Alex (Solo), Sam (New User) | Proactive anomaly and trend detection |
| Predictive Budget Forecasting | Alex (Solo) | See end-of-month balance before problems |
| Smart Nudges | Alex (Solo), Sam (New User) | Real-time trade-off awareness |
| Budget Prescription Plans | Alex Returns (Lapsed) | Structured recovery for unhealthy patterns |

**MVP Journey Coverage:**
- Alex (Solo + AI) — fully supported
- Sam (New User) — fully supported
- Alex Returns (Lapsed) — partially supported (re-engagement via AI; streak mechanics deferred)

### Phase 2 Growth (Epics 13-15)

| Epic | Key Capability | Dependency |
|------|---------------|------------|
| **13: Household Mode** | Multi-user shared budgets with privacy controls | New RLS policies, Realtime subscriptions |
| **14: Values & Mindset** | Values-based spending, wishlist impact, savings simulator | Builds on AI from Epic 12 |
| **15: Gamification** | Streaks, budget score, achievements | Independent — any order after MVP |

**Epic 13 features:** Shared household accounts with role-based permissions, budget transparency levels, personal allowance system, transparency presets (Newlyweds, Roommates, Partners), income-proportional contribution splits.

**Epic 14 features:** Values-based spending plan, wishlist with budget impact analysis, "What If" savings simulator.

**Epic 15 features:** Duolingo-style streaks with freezes, Budget Score (0-100) with progression, achievement unlock system, expanded goal milestones.

**Journey Unlocked:** Maya & Jordan (Household) — requires Epic 13.

### Phase 3 Vision (Epic 16+)

- Spotify Wrapped for Finances (annual shareable year-in-review)
- Budget as a City Builder (visual world growing with financial health)
- Financial Compatibility Insights (AI-analyzed household spending personalities)
- Community savings challenges and anonymous benchmarks
- Bank feed integration (Plaid/Teller)
- Landing page and freemium monetization (free solo, premium household + AI)

### Risk Assessment

**Technical Risks:**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI pattern detection not useful on small datasets | Medium | High | Minimum data thresholds (30+ transactions) before advanced insights; fall back to existing rule-based engine |
| Household RLS complexity causes data leaks | Low | Critical | Comprehensive integration test suite for every transparency level *before* shipping |
| Gamification degrades UI performance | Low | Medium | Lazy-load gamification components; measure Core Web Vitals before/after |
| AI insights not perceived as valuable | Medium | High | Personal validation first — if insights aren't useful to the creator, they won't be useful to anyone |

**Market & Resource Risks:**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Household features too niche | Low | Medium | Each pillar stands alone — household is additive, not required |
| Gamification feels patronizing for finance | Medium | Medium | All gamification opt-in; subtle by default; never blocks core functionality |
| Solo developer burnout | Medium | High | Ship epics incrementally; take breaks between epics |
| Scope creep within epics | Medium | Medium | Strict story acceptance criteria; defer "nice-to-have" features |

**Innovation Risks:**

| Risk | Fallback Strategy |
|------|-------------------|
| Three pillars too complex simultaneously | Ship sequentially (AI → household → gamification) — each stands alone |
| Transparency model confusing to set up | Default to simplest preset, allow progressive customization |
| AI insights not better than existing rules engine | New AI enhances existing rules engine, not replaces it |

## User Journeys

### Journey 1: Alex — The Solo User Gets Smarter Tools

**Who:** Alex, 28, software developer. Uses Smart Budget for 3 months. Logs expenses consistently but finds insights basic — "I already know I spend a lot on food."

**Opening Scene:** Monday morning. Alex sees a Weekly Financial Digest notification: "Last week: $420 spent across 12 transactions. Dining up 35% vs your 4-week average. You have 3 subscriptions totaling $47/mo unused for 60+ days."

**Rising Action:** Alex taps Subscription Graveyard. Three services listed with last-used dates. A fitness app — $15.99/mo since January. Cancelled. "Projected annual savings: $192." The new spending heatmap shows weekends in deep red, weekdays light green. The pattern is instantly obvious.

**Climax:** A Smart Nudge: "You're on track to exceed dining budget by $180 this month. Reducing by 2 meals out this week keeps you on target — and moves your vacation goal forward by 1 week." The vacation goal feels tangible, connected to today's lunch.

**Resolution:** Over the next month: $192 saved from cancelled subscription, $120 reduced dining overspend, 50% vacation goal milestone hit. Celebration animation plays. Alex screenshots it for a friend: "This app actually made me save money."

**Capabilities:** Weekly digest, subscription detection, spending heatmap, smart nudges, goal milestone celebrations, AI pattern detection

### Journey 2: Maya & Jordan — Starting a Household Budget

**Who:** Maya, 31, marketing manager. Jordan, 29, freelance designer. Couple splitting expenses informally via Venmo. Low-grade tension about who pays for what.

**Opening Scene:** Maya (2-month solo user) creates a household and invites Jordan. Jordan signs up in under 2 minutes and joins. They choose "Partners" transparency preset (shared bills visible, personal spending shows category totals only).

**Rising Action:** Shared categories: Rent, Groceries, Utilities, Dining Out. 55/45 contribution split (Maya earns more). Jordan adds personal categories privately — Maya sees only "Jordan: Personal - $340 this month." They create a shared goal: "Anniversary Trip — $2,000 by August."

**Climax:** Three weeks in, AI detects: "Household grocery spending $680/month — 25% above combined historical average. Most increase from weekend shopping." Jordan realizes his Saturday farmers market hauls are adding up. Adjusts voluntarily — no argument, just data. Maya gets a personal nudge about coffee subscriptions.

**Resolution:** Month two: $340 saved toward the trip. Jordan at 42%, Maya at 58% — close to agreed ratio. Both get a celebration at the 25% milestone. Money becomes something they manage *together* without conflict.

**Capabilities:** Household creation/invitation, transparency presets, contribution ratios, shared goals, household AI insights, personal allowance privacy, household milestone celebrations

### Journey 3: Sam — Discovering the App for the First Time

**Who:** Sam, 24, recent graduate starting first job. Knows nothing about budgeting. Friend showed a spending heatmap screenshot.

**Opening Scene:** Sam downloads the PWA. Google login, 30 seconds. Clean empty dashboard: "Add your first transaction to get started." Tooltip points to the "+" button.

**Rising Action:** First expense: $12.50, Dining, today — 15 seconds. Dashboard shows a data point. A few more from the week — rent, groceries, concert ticket. Within 5 minutes, the heatmap shows 3 colored days, the category chart has 4 slices.

**Climax:** After one week of casual logging, first Weekly Digest: "Your first week: $847 spent. Rent is 65%. You spent $78 on dining across 5 transactions — that's $4,056/year at this pace." Sam has never thought about annualized spending. The number hits hard.

**Resolution:** First savings goal: "Emergency Fund — $1,000." Budget Score starts at Level 1: "Budget Beginner." Three weeks later: 15-day logging streak, Budget Score of 34, dining reduced 20%. Hidden achievement unlocked: "First $100 Saved." Hooked.

**Capabilities:** Zero-config onboarding, progressive disclosure, first-time guidance, weekly digest, annualized projections, savings goals, budget score, streaks, achievements

### Journey 4: Alex Returns — Lapsed User Re-engagement

**Who:** Alex again, 3 months later. Stopped logging for 6 weeks.

**Opening Scene:** Push notification: "Your 90-day streak ended, but your data is still here. Come back — your spending patterns might surprise you."

**Rising Action:** No guilt. App shows: "Let's catch up. Add a few recent transactions and I'll update your insights." Alex adds a week in 3 minutes via quick-entry.

**Climax:** Fresh AI analysis: "Your dining dropped 40% while you weren't tracking — interesting. But subscription spending increased $29/mo (2 new services)." Awareness from tracking was working; stopping led to subscription creep.

**Resolution:** New streak started. Old achievements preserved. Comeback challenge: "7-Day Comeback — log every day this week." Completed. "Phoenix" achievement unlocked. Re-engaged.

**Capabilities:** Re-engagement notifications, no-guilt return, quick catch-up flow, fresh AI analysis, streak restart, comeback challenges, preserved history

### Journey 5: Nikit — The Admin/Developer Managing the Platform

**Who:** Nikit, creator and maintainer. Moving toward public use.

**Opening Scene:** Vercel deployment green. Supabase queries normal. Test suite (900+ tests) passes on CI. New user signed up overnight.

**Rising Action:** Sentry alert — edge case in household invitation (same email domain). Error caught gracefully. Nikit reviews, identifies RLS policy fix, writes tests, deploys.

**Climax:** Analytics: 12 active households, 89% weekly retention, Budget Score trending up. AI generating 4.2 actionable insights/user/month (above 3/month target). User feedback: "The subscription graveyard saved me $45 last month."

**Resolution:** App stable, users engaged, three-pillar strategy validated by data. Time for freemium pricing.

**Capabilities:** Monitoring/observability, error handling, RLS management, analytics, CI/CD, user feedback channels

### Cross-Journey Patterns

- Every journey depends on AI insights being *specific and actionable* — generic insights break every story
- Gamification appears in 4 of 5 journeys — the engagement glue
- Household features create the strongest emotional moments (shared milestones, reduced conflict)
- Onboarding must be zero-friction — Sam's journey fails if setup exceeds 2 minutes

## Domain-Specific Requirements

### Security & Data Isolation

**Household RLS Architecture:**
- Granular RLS policies: shared categories/transactions visible to household members, private data visible only to owner
- Transparency enforcement at database level — private data inaccessible even via direct API calls
- Invitation flow validates email ownership; prevents unauthorized household access
- Member removal immediately revokes all shared data access

**AI Data Boundaries:**
- AI processes financial data server-side — insights never leak between users or across households
- Household insights aggregate data without exposing individual transactions when transparency restricts it
- Pattern detection is deterministic and explainable — no "black box" recommendations

### Compliance & Legal

**Data Protection (GDPR):**
- Right to export (CSV/PDF — already exists), right to deletion (cascade all data), right to portability
- Privacy policy and terms of service required before public launch
- Cookie consent and analytics disclosure

**Financial Advice Disclaimer:**
- AI insights are informational coaching, not licensed financial advice — clear disclaimer in app and ToS
- No fiduciary responsibility for budget recommendations or savings suggestions
- No guarantee of financial outcomes from AI-generated insights

## Innovation & Novel Patterns

### Primary: Three-Pillar Unified System

The core innovation is the *integration pattern* — AI, household collaboration, and gamification as a reinforcing loop. Each pillar is proven individually (Mint has AI, Splitwise has social, Duolingo has gamification). The innovation is making them amplify each other in a financial context.

### Secondary: Privacy-Respecting Household Finance

Most shared finance tools are all-or-nothing. The transparency level system (shared, category-only, private) with presets (Newlyweds, Roommates, Partners) acknowledges real-world complexity of financial relationships without forcing uncomfortable defaults.

### Tertiary: Emotional Budget Interfaces

Values-based spending (align to priorities, not hard caps) and visual metaphors (garden, city builder) shift budgeting from "restriction tool" to "alignment tool" — a fundamentally different emotional relationship with money.

### Validation Approach

1. **AI:** >80% of insights actionable using real transaction data
2. **Household:** 1-2 real couples/roommates for 30 days — both members stay active, financial conflict decreases
3. **Gamification:** Streaks and achievements increase logging frequency vs. Phase 1 baseline
4. **Integration:** Users of all three pillars retain better than users of one or two

## Web Application Requirements

### Browser & Platform Support

**Maintained:** Chrome, Firefox, Safari, Edge (latest 2 versions). iOS Safari 14+, Chrome Mobile Android 10+. Screen sizes 320px to 2560px+. PWA installable with offline transaction entry.

**Phase 2 Additions:** WebSocket support for household real-time sync. Push notifications (Web Push API) for nudges, milestones, re-engagement. Graceful animation degradation on low-end devices.

### Responsive Design

**Existing breakpoints maintained:** Desktop (1024px+), Tablet (768-1023px), Mobile (<768px).

**Phase 2 additions:**
- Household dashboard: side-by-side on desktop, stacked on mobile
- Spending heatmap: horizontal scroll on mobile, full calendar on desktop
- Achievement displays: grid on desktop, horizontal scroll on mobile
- Transparency settings: full form on desktop, step-by-step wizard on mobile

### SEO Strategy

- Authenticated app routes: no SEO needed
- Public landing page (`/`): static route for commercial launch — product description, pricing, sign-up CTA
- Open Graph tags for landing page sharing only

## Functional Requirements

### Financial Intelligence & AI Coaching

- **FR1:** The system detects spending anomalies and trends from transaction history, surfacing specific, actionable insights
- **FR2:** The system generates end-of-month budget projections based on current spending pace and historical patterns
- **FR3:** The system delivers real-time smart nudges connecting spending decisions to their impact on user goals
- **FR4:** The system generates structured 30-day budget recovery plans for unhealthy spending patterns
- **FR5:** The system detects recurring charges (subscriptions) and identifies unused ones based on frequency gaps
- **FR6:** The system provides seasonal and cyclical spending awareness by analyzing yearly patterns
- **FR7:** The system generates household-level spending insights that aggregate data while respecting transparency settings
- **FR8:** The system generates fresh AI analysis when a lapsed user returns, summarizing changes during their absence

### Financial Visualization & Awareness

- **FR9:** Users can view a weekly financial digest: spending totals, notable trends, actionable highlights
- **FR10:** Users can view a calendar-style spending heatmap showing daily spending intensity
- **FR11:** Users can view annualized projections of spending patterns (e.g., "$4,056/year on dining at this pace")
- **FR12:** Household members can view a shared dashboard: combined spending, contribution progress, shared goal status

### Goal Management & Savings

- **FR13:** Users can create savings goals with target amounts and deadlines
- **FR14:** Users receive visual celebrations and notifications at goal milestones (25%, 50%, 75%, 100%)
- **FR15:** Users can view a wishlist where each item shows projected impact on existing goals and budget
- **FR16:** Users can run "What If" simulations toggling spending habits to see projected annual savings impact
- **FR17:** Household members can create shared savings goals with per-member contribution tracking

### Household Collaboration

- **FR18:** Users can create a household and invite other users via email
- **FR19:** Invited users can join a household through a verified invitation flow
- **FR20:** Household members can set up shared budget categories visible and manageable by all members
- **FR21:** Household members can configure income-proportional contribution splits without exposing exact income
- **FR22:** Household admins can remove members, immediately revoking all shared data access
- **FR23:** The system enforces household data isolation at the database level — no cross-household access via any path

### Privacy & Transparency Controls

- **FR24:** Household members can set transparency levels per category: fully shared, category-totals-only, or fully private
- **FR25:** Users can select from predefined transparency presets (Newlyweds, Roommates, Partners) during household setup
- **FR26:** Users can maintain a personal allowance — a private budget within a household invisible to other members
- **FR27:** The system enforces transparency restrictions at the data layer — private data inaccessible via any access path

### Engagement & Gamification

- **FR28:** Users can build and maintain daily/weekly logging streaks with streak freeze capability
- **FR29:** Users can view a Budget Score (0-100) reflecting financial health with levels and progression
- **FR30:** Users can unlock achievements and badges through financial milestones and consistent behavior
- **FR31:** The system presents comeback challenges for lapsed users without punishing absence
- **FR32:** The system sends push notifications for smart nudges, milestone celebrations, re-engagement, and household events
- **FR33:** Users can opt in or out of gamification features without affecting core budgeting functionality

### Values-Based Financial Planning

- **FR34:** Users can define a values-based spending plan aligning budget allocations to personal priorities rather than strict caps
- **FR35:** Users can view spending in the context of stated values — whether money flows toward or away from what matters

### Platform & Account Management

- **FR36:** New users can complete onboarding and enter their first transaction within 2 minutes with no mandatory configuration
- **FR37:** Users receive progressive feature disclosure — advanced capabilities appear as usage patterns warrant
- **FR38:** Users can delete their account with full cascade deletion of all personal data and GDPR compliance
- **FR39:** The system displays financial advice disclaimers clarifying AI insights are informational, not licensed advice
- **FR40:** Gamification animations respect `prefers-reduced-motion` and degrade gracefully on low-end devices
- **FR41:** All interactive elements are keyboard-navigable and announced to screen readers

## Non-Functional Requirements

### Performance

- Phase 1 benchmarks maintained: page load <2s on 3G, dashboard render <1s, transaction save <200ms, chart updates <300ms
- Household real-time sync: <500ms for shared data updates between members
- AI pattern analysis: <3 seconds, non-blocking background process
- Gamification state: <100ms local updates (local-first, background sync)
- Weekly digest: background job, no user-facing latency
- No jank or blocked interactions during AI analysis or real-time sync
- Phase 2 client bundle increase: <50KB gzipped total

### Security

- Financial data encrypted at rest and in transit (TLS 1.2+)
- Row-Level Security on every table — no data without valid auth
- Household isolation verified by integration tests for every transparency level
- Cross-household leakage impossible — verified at database layer
- Invitation tokens: single-use, 48h expiry, tied to specific email
- AI analysis server-side only — no sensitive data in client-side logic
- Account deletion cascades all personal data within 30 days
- No financial data in application logs, error reports, or analytics

### Scalability

- MVP: 1-10 active users with zero performance degradation
- Architecture supports 1,000 users without structural changes (Supabase + Vercel serverless)
- Up to 10 members per household
- AI performs within targets on up to 10,000 transactions per user
- Indexed queries — no full table scans on key operations
- Real-time subscriptions scoped per household, scaling linearly with households

### Accessibility

- WCAG 2.1 Level A across all new features
- Level AA where Chakra UI provides it by default (contrast, focus indicators, keyboard nav)
- Gamification animations respect `prefers-reduced-motion`
- Achievements and nudges announced via `aria-live` regions
- Spending heatmap has accessible data table alternative
- All forms fully keyboard-navigable
- Color never sole indicator of meaning — patterns or labels alongside color

### Reliability

- Zero critical bugs for 30+ consecutive days before commercial launch
- All new features covered by automated tests — expanding 800+ baseline
- No regressions in Phase 1 functionality
- Simultaneous household edits resolve correctly (last-write-wins with optimistic UI)
- Financial calculations accurate to 2 decimal places, no floating-point drift
- Graceful degradation: real-time sync falls back to SWR polling; AI falls back to rule-based insights
- PWA offline transaction entry maintained for solo users
