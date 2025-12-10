# Smart Budget Application

[![codecov](https://codecov.io/gh/NikolayAngelov90/Smart-Budget-Application/branch/main/graph/badge.svg)](https://codecov.io/gh/NikolayAngelov90/Smart-Budget-Application)

Smart Budget is a personal finance management tool designed to provide financial visibility through quick transaction tracking, intelligent categorization, visual spending insights, and AI-powered budget optimization recommendations.

## Core Features

- **Quick Transaction Entry**: Add income and expense records in under 30 seconds with intelligent categorization.
- **Visual Intelligence Dashboard**: Understand spending patterns at a glance with interactive charts and real-time insights.
- **Smart Category System**: Organize transactions with pre-defined and custom categories for better organization.
- **AI-Powered Budget Optimization**: Receive personalized, actionable recommendations to optimize your budget and spending habits.
- **Data Export**: Export your transaction data to CSV or PDF for analysis and record-keeping.
- **Real-time Sync**: All changes are synchronized in real-time across devices with Supabase backend.
- **Privacy-First Architecture**: Bank-level security with Row Level Security (RLS) ensures your data is isolated and protected.

## Tech Stack

### Core Technologies

- **[Next.js](https://nextjs.org/)**: ^15.0.0
- **[React](https://reactjs.org/)**: ^18.3.0
- **[Chakra UI](https://chakra-ui.com/)**: ^2.8.0
- **[Supabase](https://supabase.io/)**: ^2.81.1
- **[Framer Motion](https://www.framer.com/motion/)**: ^10.16.0
- **[SWR](https://swr.vercel.app/)**: ^2.3.6

### Form Handling

- **[React Hook Form](https://react-hook-form.com/)**: ^7.66.0
- **[Zod](https://zod.dev/)**: ^4.1.12
- **[@hookform/resolvers](https://github.com/react-hook-form/resolvers)**: ^5.2.2

### Utilities

- **[date-fns](https://date-fns.org/)**: ^4.1.0
- **[react-icons](https://react-icons.github.io/react-icons/)**: ^5.5.0

### Development Dependencies

- **[TypeScript](https://www.typescriptlang.org/)**: ^5.3.0
- **[ESLint](https://eslint.org/)**: ^8.56.0
- **[Prettier](https://prettier.io/)**: ^3.1.0
- **[Jest](https://jestjs.io/)**: ^30.2.0
- **[React Testing Library](https://testing-library.com/react)**: ^16.3.0
- **[Playwright](https://playwright.dev/)**: ^1.57.0
- **[Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)**: ^0.15.1

## Performance

The application is designed with performance as a first-class concern. We maintain strict performance budgets and automated monitoring:

### Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Dashboard Load | <2s | ✅ Monitored |
| Chart Render | <300ms | ✅ Monitored |
| Lighthouse Performance | >90 | ✅ Automated |
| Lighthouse Accessibility | >95 | ✅ Automated |

### Automated Performance Testing

- **Lighthouse CI**: Runs on every PR to validate performance, accessibility, and best practices
- **Performance Benchmarks**: Automated benchmarks measure dashboard load time, chart render time, and real-time update latency
- **Vercel Analytics**: Real-time monitoring in production with Core Web Vitals tracking

### Running Performance Tests

```bash
# Build and start production server
npm run build
npm run start

# In a new terminal, run benchmarks
npm run benchmark
```

For detailed performance testing guide, see [docs/performance-testing.md](docs/performance-testing.md).

## Testing

The application includes comprehensive automated testing:

- **Unit Tests**: Jest + React Testing Library for component and service testing
- **Integration Tests**: API route testing and component integration
- **Performance Tests**: Lighthouse CI and custom benchmarks
- **Coverage Target**: 30% minimum (enforced in CI)

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- A Supabase account

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/NikolayAngelov90/Smart-Budget-Application.git
    ```
2.  Install NPM packages
    ```sh
    npm install
    ```
3.  Set up your environment variables by creating a `.env.local` file in the root of your project and adding your Supabase credentials:
    ```
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    NEXT_PUBLIC_APP_URL=http://localhost:3001
    ```
    For complete authentication setup including Google and GitHub OAuth, see the [Authentication Setup Guide](docs/AUTH_SETUP_GUIDE.md).
4.  Start the development server
    ```sh
    npm run dev
    ```

### Testing

Run the test suite to ensure everything is working correctly:

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

For detailed testing practices and patterns, see [Testing Guidelines](docs/testing-guidelines.md).

### Benchmarking

Measure application performance with automated benchmarks:

```bash
# Build production version
npm run build
npm run start

# In a new terminal, run benchmarks
npm run benchmark
```

Performance targets:
- Dashboard Load: <2s
- Chart Render: <300ms
- Lighthouse Performance: >90
- Lighthouse Accessibility: >95

For more details, see [Performance Testing Guide](docs/performance-testing.md).

### Contributing

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

The project follows a feature-based structure within the Next.js App Router pattern.

```
smart-budget-application/
├── src/
│   ├── app/                # Next.js App Router
│   ├── components/         # Shared React components
│   ├── lib/                # Business logic & utilities
│   ├── types/              # TypeScript definitions
│   └── theme/              # Chakra UI theme
├── supabase/               # Supabase configuration
│   ├── migrations/
│   └── seed.sql
└── ...
```

For more details, see the [architecture documentation](docs/architecture.md).

## Documentation

This project maintains comprehensive documentation in the `docs/` folder:

### Product & Design
- **[Product Requirements Document (PRD)](docs/PRD.md)** - Complete feature specifications and success criteria
- **[UX Design Specification](docs/ux-design-specification.md)** - Design system, color themes, and component specifications

### Technical Documentation
- **[Technical Architecture](docs/architecture.md)** - Technology stack, design decisions, and database schema
- **[Component Library](docs/component-library.md)** - Reusable React components catalog with usage examples
- **[API Conventions](docs/api-conventions.md)** - REST API naming patterns and endpoint documentation
- **[Testing Guidelines](docs/testing-guidelines.md)** - Testing standards, mocking strategies, and best practices

### Setup & Deployment
- **[Authentication Setup Guide](docs/AUTH_SETUP_GUIDE.md)** - Step-by-step instructions for configuring Supabase authentication
- **[Performance Testing Guide](docs/performance-testing.md)** - Performance benchmarks, Lighthouse CI, and optimization strategies
- **[Deployment Documentation](docs/1-4-deployment-pipeline-and-environment-setup.md)** - Vercel deployment setup and environment configuration

### Project Reports
- **[Implementation Readiness Report](docs/implementation-readiness-report-2025-11-14.md)** - Project readiness assessment

## Deployment

This application is deployed on [Vercel](https://vercel.com/). The `main` branch is automatically deployed to production. Preview deployments are created for all other branches.

### Vercel Deployment Link

To view the live deployed application, visit: **https://smart-budget-application.vercel.app**

### Deployment Configuration

For detailed deployment setup and environment configuration, refer to the [deployment documentation](docs/1-4-deployment-pipeline-and-environment-setup.md).
