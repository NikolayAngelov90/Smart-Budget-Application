# Smart Budget Application

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
    ```
    For complete authentication setup including Google and GitHub OAuth, see the [Authentication Setup Guide](docs/AUTH_SETUP_GUIDE.md).
4.  Start the development server
    ```sh
    npm run dev
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

- **[Product Requirements Document (PRD)](docs/PRD.md)** - Complete feature specifications and success criteria
- **[Technical Architecture](docs/architecture.md)** - Technology stack, design decisions, and database schema
- **[Authentication Setup Guide](docs/AUTH_SETUP_GUIDE.md)** - Step-by-step instructions for configuring Supabase authentication
- **[UX Design Specification](docs/ux-design-specification.md)** - Design system, color themes, and component specifications
- **[Implementation Readiness Report](docs/implementation-readiness-report-2025-11-14.md)** - Project readiness assessment

## Deployment

This application is deployed on [Vercel](https://vercel.com/). The `main` branch is automatically deployed to production. Preview deployments are created for all other branches.

### Vercel Deployment Link

To view the live deployed application, visit: **https://smart-budget-application.vercel.app**

### Deployment Configuration

For detailed deployment setup and environment configuration, refer to the [deployment documentation](docs/1-4-deployment-pipeline-and-environment-setup.md).
