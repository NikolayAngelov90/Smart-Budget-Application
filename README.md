# Smart Budget Application

[![CI](https://github.com/NikolayAngelov90/Smart-Budget-Application/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/NikolayAngelov90/Smart-Budget-Application/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/NikolayAngelov90/Smart-Budget-Application/branch/main/graph/badge.svg)](https://codecov.io/gh/NikolayAngelov90/Smart-Budget-Application)

Personal finance app for tracking spending, setting budgets, and sharing them with your household — with a rule-based coaching layer that explains where the money went and what is likely to happen next.

Installable PWA, works offline, English and Bulgarian.

**[Live app](https://smart-budget-application.vercel.app)**

## Features

**Track and see**
- Transaction entry in under 30 seconds, with predefined and custom categories
- Dashboard with a balance/flow hero, spending by category, trends, and month-over-month changes — the category view follows a week / month / 3-month / year selector
- Calendar-style spending heatmap and annualized projections
- CSV export, with the filters you have applied

**Coaching that explains itself**
- Spending anomalies, unusual expenses and budget-limit recommendations, each showing the arithmetic behind it
- End-of-month forecasts per category, and 30-day recovery plans when a month goes badly
- Subscription detection from recurring-charge patterns, seasonal awareness, and a weekly digest
- A re-engagement summary of what changed while you were away

Every insight is rule-based and deterministic — there is no LLM in the request path, so the numbers are reproducible and the reasoning is inspectable.

**Goals and planning**
- Savings goals with milestone celebrations
- A wishlist that shows what each purchase would do to your budget and goal dates
- "What if" simulations for changing a spending habit
- Values-based planning: allocate to what matters, then see whether money actually flows that way

**Households**
- Invite members by email; shared categories, shared savings goals, and a combined dashboard
- Per-category transparency: fully shared, totals-only, or private — enforced in the database, not the UI
- A personal allowance no other member can see
- Income-proportional contribution splits that never reveal anyone's income
- Admin removal revokes access immediately

**Habit, not chore**
- Logging streaks with freezes, a 0–100 budget score, achievements, and comeback challenges for lapsed users
- Web push for nudges, milestones and household events, with quiet hours
- All of it opt-out without touching core budgeting

**Built in**
- Row Level Security on every table, with an integration suite that proves isolation per transparency level
- Offline support and background sync
- `prefers-reduced-motion` respected; keyboard navigable and screen-reader announced

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 18, TypeScript (strict) |
| UI | Chakra UI v2 with a custom design system, Framer Motion, Recharts |
| Data | Supabase (Postgres + Auth + Realtime), SWR with a localStorage cache provider |
| Forms | React Hook Form + Zod |
| i18n | next-intl (en + bg, key parity enforced in CI) |
| Dates | date-fns v4 |
| Notifications | web-push (VAPID) |
| Testing | Jest 30, React Testing Library, Playwright, Lighthouse CI |
| Hosting | Vercel (`arn1`, co-located with the database region) |

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js 22 (the version CI and Vercel build against)
- npm
- A Supabase project

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/NikolayAngelov90/Smart-Budget-Application.git
    ```
2.  Install packages
    ```sh
    npm install
    ```
3.  Create `.env.local`. **Copy `.env.example`** — it is the authoritative list and explains each variable:
    ```sh
    cp .env.example .env.local
    ```
    The minimum to boot:
    ```
    NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
    SUPABASE_SECRET_KEY=sb_secret_...
    NEXT_PUBLIC_APP_URL=http://localhost:3001
    ```

    > Use the **modern** key names above. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    > / `SUPABASE_SERVICE_ROLE_KEY` names are still read as fallbacks, but the
    > legacy JWT anon key is **disabled on this project**, so a legacy value will
    > not authenticate. `SUPABASE_SECRET_KEY` bypasses RLS — server only, never
    > exposed to the browser.

    Push notifications and the cron routes need VAPID keys and `CRON_SECRET` as
    well; `npm run check-env` reports exactly what is missing. For OAuth setup see
    the [Authentication Setup Guide](docs/AUTH_SETUP_GUIDE.md).
4.  Apply the migrations in `supabase/migrations/` in order, then start the dev server
    ```sh
    npm run dev
    ```
    It serves on **port 3001**, not 3000.

## Testing

```bash
npm test                 # ~2,500 unit and integration tests
npm run test:watch       # re-run on change
npm run test:coverage    # coverage report
npm run test:rls         # RLS isolation suite — needs Docker
npm run check-env        # report any missing environment variables
```

`test:rls` runs against a **local** Supabase stack in Docker and proves the
database rejects cross-user and cross-household reads at every transparency
level. It is the suite worth running before touching a policy or a migration,
and CI runs it on every PR.

Two conventions worth knowing before writing tests here, both learned the
expensive way:

- Use the shared Supabase chain mock in `src/test-utils/supabaseChain.ts` rather
  than hand-rolling `mockReturnThis()` chains. A stub that ignores its arguments
  will happily let a `user_id` filter disappear while staying green.
- jsdom has no layout engine — every width it reports is `0` — so responsive and
  tap-target regressions cannot be caught by rendering. Those are pinned by
  source-level guards; see `src/components/household/__tests__/mobile-form-layout.test.ts`.

See [Testing Guidelines](docs/testing-guidelines.md) for the rest.

## Performance

| Metric | Target |
|---|---|
| Dashboard load | < 2s |
| Chart render | < 300ms |
| Lighthouse performance | > 90 |
| Lighthouse accessibility | > 95 |

Lighthouse CI runs on every PR; Vercel Analytics tracks Core Web Vitals in
production. To benchmark locally:

```bash
npm run build && npm run start
npm run benchmark        # in a second terminal
```

See the [Performance Testing Guide](docs/performance-testing.md).

## Contributing

When contributing to this codebase:

1. **Review Documentation**: Familiarize yourself with [Component Library](docs/component-library.md), [API Conventions](docs/api-conventions.md), and [Testing Guidelines](docs/testing-guidelines.md)
2. **Follow Patterns**: Use existing components and patterns documented in the component library
3. **Write Tests**: Maintain 90% coverage for new code (see testing guidelines)
4. **Run Checks**: Ensure tests pass and linter is clean before submitting
   ```bash
   npm run lint
   npm run type-check
   npm test
   ```

## Project Structure

```
src/
├── app/
│   ├── api/            # Route handlers (auth, dashboard, household, cron, …)
│   └── …               # Pages — App Router
├── components/         # Feature-grouped React components
├── lib/
│   ├── ai/             # Insight, forecast and recovery ENGINES — pure functions
│   ├── services/       # Data access and orchestration
│   ├── hooks/          # SWR hooks; keys live beside them
│   ├── swr/            # localStorage cache provider
│   └── utils/          # Dates, currency, formatting
├── test-utils/         # Shared Supabase chain mock
├── theme/              # Chakra design system (Quiet Ledger)
└── types/
messages/               # next-intl en + bg (key parity enforced in CI)
supabase/migrations/    # Applied in filename order (001-040, then timestamped)
docs/                   # Architecture, API conventions, testing, deployment
```

The engines in `lib/ai/` are deliberately **pure**: they take transactions and
return insights, with no database or network access. That is what makes the
financial logic testable without mocking anything, and it is why the
"AI" features are reproducible rather than probabilistic.

For more, see the [architecture documentation](_bmad-output/planning-artifacts/architecture.md).

## Documentation

Documentation lives in two places, and the split matters:

- **`_bmad-output/`** — the **live** planning and implementation record: the current
  PRD, architecture, epic breakdown, every story file, the retrospectives, and
  `sprint-status.yaml`. This is generated by the BMAD workflow and is the only
  copy that describes what was actually built.
- **`docs/`** — hand-written reference that outlives any one epic (API conventions,
  testing guidelines, deployment), plus `docs/phase-1/`, the archived 2025-11-14
  planning set. Those archived files stop at Epic 7 and each carries a header
  pointing at its live replacement.

### Product & Design
- **[Product Requirements Document (PRD)](_bmad-output/planning-artifacts/prd.md)** - Complete feature specifications and success criteria
- **[Epic Breakdown](_bmad-output/planning-artifacts/epics.md)** - Epics 11-16 with stories and acceptance criteria
- **[UX Design Specification](_bmad-output/planning-artifacts/ux-design-specification.md)** - Design system, color themes, and component specifications

### Technical Documentation
- **[Technical Architecture](_bmad-output/planning-artifacts/architecture.md)** - Technology stack, design decisions, and database schema
- **[Component Library](docs/component-library.md)** - Reusable React components catalog with usage examples
- **[API Conventions](docs/api-conventions.md)** - REST API naming patterns and endpoint documentation
- **[Testing Guidelines](docs/testing-guidelines.md)** - Testing standards, mocking strategies, and best practices

### Setup & Deployment
- **[Authentication Setup Guide](docs/AUTH_SETUP_GUIDE.md)** - Step-by-step instructions for configuring Supabase authentication
- **[Performance Testing Guide](docs/performance-testing.md)** - Performance benchmarks, Lighthouse CI, and optimization strategies
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Vercel setup and environment configuration
- **[Deployment Checklist](docs/deployment-checklist.md)** - Pre-release steps, including applying migrations

### Project Reports
- **[Implementation Readiness Report](_bmad-output/planning-artifacts/implementation-readiness-report-2026-06-02.md)** - Latest readiness assessment
- **[Sprint Status](_bmad-output/implementation-artifacts/sprint-status.yaml)** - Every story and its state
- **[Phase 1 archive](docs/phase-1/)** - The superseded 2025-11-14 planning set, kept for history

## Deployment

This application is deployed on [Vercel](https://vercel.com/). The `main` branch is automatically deployed to production. Preview deployments are created for all other branches.

### Vercel Deployment Link

To view the live deployed application, visit: **https://smart-budget-application.vercel.app**

### Deployment Configuration

For deployment setup and environment configuration see the [deployment guide](docs/DEPLOYMENT.md), and run through the [checklist](docs/deployment-checklist.md) before a release.
