# Smart-Budget-Application - Epic Breakdown

**Author:** Niki
**Date:** 2025-11-14
**Project Level:** Greenfield
**Target Scale:** MVP (6-8 weeks)

---

## Overview

This document provides the complete epic and story breakdown for Smart-Budget-Application, decomposing the requirements from the [PRD](./PRD.md) into implementable stories.

**Living Document Notice:** This is the initial version. It will be updated after UX Design and Architecture workflows add interaction and technical details to stories.

## Epic Summary

**7 Epics Total** - Sequenced for incremental value delivery:

1. **Foundation & Infrastructure** - Project setup, deployment pipeline, authentication foundation
2. **User Authentication & Onboarding** - Complete auth flows and first-time user experience
3. **Transaction Management** - Core transaction CRUD with optimized entry flow
4. **Category System** - Pre-defined and custom categories with visual organization
5. **Financial Dashboard & Visualizations** - Charts, metrics, and visual intelligence
6. **AI Budget Insights** - Rules-based insight generation and presentation
7. **Data Export & Settings** - CSV/PDF export, account settings, data portability

**Coverage:** All 52 functional requirements mapped to stories across 7 epics

---

## Functional Requirements Inventory

**Transaction Management (FR1-FR10):**
- FR1: Users can create income transaction records with amount, date, category, and optional notes
- FR2: Users can create expense transaction records with amount, date, category, and optional notes
- FR3: Users can view a complete history of all transactions in chronological order
- FR4: Users can filter transaction history by date range, category, or transaction type
- FR5: Users can search transactions by keyword (notes, category name, or amount)
- FR6: Users can edit existing transaction details
- FR7: Users can delete transactions from their history
- FR8: System persists all transaction data immediately with no data loss
- FR9: Transaction entry interface defaults to current date for rapid entry
- FR10: Transaction entry can be completed in under 30 seconds

**Category Management (FR11-FR17):**
- FR11: System provides pre-defined common expense categories
- FR12: System provides pre-defined common income categories
- FR13: Users can create custom transaction categories with names and color assignments
- FR14: Users can edit existing category names and properties
- FR15: Users can delete custom categories (system prevents deletion of predefined)
- FR16: System displays categories with color-coding for visual differentiation
- FR17: Transaction entry shows recently-used categories first for quick selection

**Data Visualization & Dashboard (FR18-FR28):**
- FR18: Users can view a dashboard showing financial summary and key metrics
- FR19: System displays monthly spending overview visualized by category
- FR20: System displays income vs expenses comparison showing net balance
- FR21: System displays spending trends over time as line chart
- FR22: System displays category breakdown showing percentage of total spending
- FR23: System displays month-over-month comparison highlighting changes
- FR24: Charts update in real-time when transactions are added/modified
- FR25: Dashboard loads and displays within 2 seconds
- FR26: Charts are responsive and render correctly on mobile and desktop
- FR27: Users can interact with charts (hover for details, click for drill-down)
- FR28: System provides accessible data table alternatives to visual charts

**AI Budget Optimization & Insights (FR29-FR37):**
- FR29: System analyzes spending patterns to identify trends and anomalies
- FR30: System generates personalized spending insights with specific percentages
- FR31: System recommends budget limits based on historical spending data
- FR32: System flags unusual expenses or emerging spending pattern changes
- FR33: System provides actionable optimization recommendations with specific dollar amounts
- FR34: AI insights presented in plain language coaching tone
- FR35: Users can view list of all AI-generated insights and recommendations
- FR36: Users can dismiss individual AI insights if not relevant
- FR37: System generates at least 3 meaningful insights per month when sufficient data exists

**Data Ownership & Export (FR38-FR43):**
- FR38: System stores user data securely in cloud database with RLS ensuring isolation
- FR39: Users can export complete transaction data to CSV format
- FR40: Users can export financial reports to PDF format
- FR41: System provides clear indication of where data is stored and how it's protected
- FR42: Data persists across browser sessions, device restarts, and syncs across devices
- FR43: Data automatically syncs across all devices where user is logged in

**User Interface & Navigation (FR44-FR47):**
- FR44: Application provides responsive design (mobile 320px+ and desktop 1024px+)
- FR45: Users can navigate between main sections via clear navigation
- FR46: System provides visual feedback for all user actions
- FR47: Application caches data for offline viewing (Phase 2: offline transaction entry)

**User Authentication & Account Management (FR48-FR52):**
- FR48: Users can create accounts using email/password or social login (Google, GitHub)
- FR49: Users can securely log in and log out of their accounts
- FR50: Users can reset forgotten passwords via email verification
- FR51: System maintains secure user sessions with automatic timeout after inactivity
- FR52: Users can access their account from multiple devices using same credentials

---

## FR Coverage Map

**Epic 1 (Foundation):** Enables all FRs through infrastructure setup
**Epic 2 (Authentication):** FR48, FR49, FR50, FR51, FR52
**Epic 3 (Transactions):** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10
**Epic 4 (Categories):** FR11, FR12, FR13, FR14, FR15, FR16, FR17
**Epic 5 (Dashboard):** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR44, FR45, FR46
**Epic 6 (AI Insights):** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37
**Epic 7 (Export):** FR38, FR39, FR40, FR41, FR42, FR43, FR47

---

## Epic 1: Foundation & Infrastructure

**Goal:** Establish the technical foundation for Smart Budget Application with Next.js, Supabase, and Chakra UI, enabling all subsequent development.

**Business Value:** Zero user-facing value initially, but critical enabler for all features. Sets up deployment pipeline, core dependencies, and project structure following architecture decisions.

**Covers:** Infrastructure requirements for all 52 FRs

### Story 1.1: Project Initialization and Base Setup

As a developer,
I want the Next.js + Chakra UI project scaffolding with proper configuration,
So that I have a solid foundation to build all features on.

**Acceptance Criteria:**

**Given** I need to start development
**When** I initialize the project using the Nextarter Chakra starter
**Then** I have a working Next.js 15+ application with Chakra UI 2.8+ pre-configured

**And** TypeScript is enabled with strict mode
**And** ESLint and Prettier are configured for code quality
**And** Project structure follows Next.js App Router pattern
**And** Basic layout components (AppLayout, Sidebar) are scaffolded
**And** Trust Blue theme (#2b6cb0) is configured in Chakra theme
**And** Application runs successfully on localhost with `npm run dev`

**Prerequisites:** None (first story)

**Technical Notes:**
- Run: `npx create-next-app@latest smart-budget-application --example https://github.com/agustinusnathaniel/nextarter-chakra`
- Configure `tsconfig.json` with strict: true, paths for @ imports
- Set up src/ directory structure: app/, components/, lib/, types/, theme/
- Create initial Chakra theme in `src/theme/` with Trust Blue color palette
- Verify all dependencies install correctly (Next.js 15+, Chakra UI 2.8+, TypeScript 5+)

---

### Story 1.2: Supabase Project Setup and Database Schema

As a developer,
I want the Supabase project configured with complete database schema and RLS policies,
So that I have a secure, cloud-native backend for all data operations.

**Acceptance Criteria:**

**Given** I need cloud database infrastructure
**When** I set up Supabase project and run migrations
**Then** PostgreSQL database is configured with all required tables

**And** 4 tables created: users (Supabase Auth), transactions, categories, insights
**And** All tables have UUID primary keys using `uuid_generate_v4()`
**And** Foreign key constraints properly defined (transactions → categories, etc.)
**And** Row Level Security (RLS) enabled on all tables
**And** RLS policies ensure users can only access their own data
**And** Database indexes created for performance (idx_transactions_date, idx_transactions_category, etc.)
**And** Enums created for transaction_type ('income', 'expense') and insight_type
**And** Updated_at trigger configured for transactions table
**And** Supabase connection verified from Next.js application

**Prerequisites:** Story 1.1 (project initialized)

**Technical Notes:**
- Create Supabase project at supabase.com
- Run migration SQL from architecture.md (001_initial_schema.sql)
- Create `.env.local` with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Install `@supabase/supabase-js` and `@supabase/ssr`
- Create `src/lib/supabase/client.ts` (browser client) and `src/lib/supabase/server.ts` (server client)
- Test connection with simple query
- Schema includes: transactions (id, user_id, category_id, amount, type, date, notes), categories (id, user_id, name, color, type, is_predefined), insights (id, user_id, title, description, type, priority, is_dismissed, metadata)

---

### Story 1.3: Authentication Configuration and Middleware

As a developer,
I want Supabase Auth configured with email/password and social login providers,
So that users can securely authenticate and access their financial data.

**Acceptance Criteria:**

**Given** I need user authentication
**When** I configure Supabase Auth providers and Next.js middleware
**Then** Authentication is properly configured for the application

**And** Email/password authentication enabled in Supabase dashboard
**And** Google OAuth provider configured (client ID and secret)
**And** GitHub OAuth provider configured (client ID and secret)
**And** Email templates customized for Smart Budget Application branding
**And** Next.js middleware created to protect authenticated routes
**And** Auth state management set up (session handling, token refresh)
**And** Protected routes redirect unauthenticated users to login
**And** Public routes (/, /login, /signup) accessible without auth
**And** Authentication flows tested (signup, login, logout, token refresh)

**Prerequisites:** Story 1.2 (Supabase configured)

**Technical Notes:**
- Configure providers in Supabase dashboard under Authentication → Providers
- Create `src/middleware.ts` for auth state checking
- Set up protected route groups in app/(dashboard)/ vs app/(auth)/
- Configure redirect URLs for OAuth callbacks
- Implement auth helper functions in `src/lib/supabase/`
- Test session persistence across page refreshes
- Configure session timeout (30 days as per NFR)
- Email verification flow for new signups

---

### Story 1.4: Deployment Pipeline and Environment Setup

As a developer,
I want automated deployment to Vercel with proper environment management,
So that I can ship updates quickly and reliably.

**Acceptance Criteria:**

**Given** I need continuous deployment
**When** I connect GitHub repository to Vercel
**Then** Deployment pipeline is fully operational

**And** GitHub repository created and pushed with initial code
**And** Vercel project connected to GitHub repository
**And** Automatic deployments configured (main branch → production)
**And** Preview deployments enabled for all branches
**And** Environment variables configured in Vercel dashboard (Supabase keys)
**And** Production deployment succeeds with < 2 minute build time
**And** Application accessible via Vercel URL
**And** HTTPS enabled by default (Vercel automatic)
**And** Build errors properly reported in Vercel dashboard

**Prerequisites:** Story 1.1, 1.2, 1.3 (project initialized with Supabase and auth)

**Technical Notes:**
- Create GitHub repository, push code
- Connect to Vercel via GitHub integration
- Add environment variables in Vercel: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- Configure build settings: Framework Preset = Next.js, Build Command = `npm run build`
- Test production deployment
- Verify environment variables are correctly loaded
- Set up custom domain (optional)
- Configure analytics (Vercel Analytics optional)

---

## Epic 2: User Authentication & Onboarding

**Goal:** Implement complete user authentication flows and first-time user experience, enabling secure access to personal financial data.

**Business Value:** Users can create accounts, log in, and begin using the application. Foundation for all personalized features and multi-device sync.

**Covers:** FR48, FR49, FR50, FR51, FR52

### Story 2.1: User Registration with Email/Password

As a new user,
I want to create an account using my email and password,
So that I can securely access my financial data from any device.

**Acceptance Criteria:**

**Given** I am a new user on the signup page
**When** I fill out the registration form and submit
**Then** My account is created successfully

**And** Email field validates RFC 5322 email format
**And** Password requirements enforced: minimum 8 characters, 1 uppercase, 1 number, 1 special character
**And** Password strength meter shows visual feedback (weak/medium/strong)
**And** Password confirmation field must match password
**And** Form uses React Hook Form + Zod for validation
**And** Inline validation errors appear below fields in red
**And** Submit button disabled until form is valid
**And** Registration completes in < 2 seconds (optimistic UI)
**And** Verification email sent within 15 minutes
**And** Success message displayed: "Account created! Check your email to verify."
**And** User redirected to email verification waiting page
**And** Touch targets minimum 44x44px on mobile
**And** Form fully keyboard accessible with visible focus indicators

**Prerequisites:** Story 1.3 (auth configured)

**Technical Notes:**
- Create `/app/(auth)/signup/page.tsx`
- Use React Hook Form + Zod schema for validation
- Implement password strength calculation (zxcvbn library optional)
- Call `supabase.auth.signUp({ email, password })`
- Handle errors: email already exists, network failure, rate limiting
- Style with Chakra UI components (Input, Button, FormControl, FormErrorMessage)
- Add Trust Blue primary button styling
- Responsive design: single column on mobile, centered card on desktop
- ARIA labels for screen readers
- Error messages: "Email is already registered", "Password too weak", "Network error - please try again"

---

### Story 2.2: Social Login (Google and GitHub)

As a new user,
I want to sign up using my Google or GitHub account,
So that I can quickly access the application without creating a new password.

**Acceptance Criteria:**

**Given** I am on the signup or login page
**When** I click "Continue with Google" or "Continue with GitHub"
**Then** I am authenticated via OAuth and account is created/logged in

**And** Google login button displays Google logo and "Continue with Google" text
**And** GitHub login button displays GitHub logo and "Continue with GitHub" text
**And** Clicking social login triggers OAuth redirect to provider
**And** OAuth callback handled correctly (redirect to /auth/callback)
**And** User account created automatically if first login
**And** User logged in automatically if account exists
**And** After successful auth, redirect to dashboard
**And** Social provider profile picture imported (optional)
**And** Email from social provider used for account
**And** Error handling for denied permissions ("Authorization cancelled")
**And** Error handling for network failures
**And** Social buttons styled consistently with brand (Trust Blue theme)

**Prerequisites:** Story 1.3 (OAuth providers configured), Story 2.1 (signup page exists)

**Technical Notes:**
- Add social login buttons to both `/signup` and `/login` pages
- Use Chakra UI `<Button>` with custom icons
- Call `supabase.auth.signInWithOAuth({ provider: 'google' })` or `provider: 'github'`
- Create `/app/auth/callback/route.ts` to handle OAuth redirects
- Extract user metadata from OAuth response
- Store session in cookies via Supabase SSR helpers
- Test OAuth flow end-to-end
- Handle edge cases: email already registered via different method, permission denied
- Ensure responsive layout (stack buttons vertically on mobile)

---

### Story 2.3: Login with Email/Password

As a returning user,
I want to log in using my email and password,
So that I can access my financial data.

**Acceptance Criteria:**

**Given** I am a returning user on the login page
**When** I enter my credentials and submit
**Then** I am logged in successfully

**And** Email and password fields present
**And** Email field validates format (not empty, valid email)
**And** Password field masked with show/hide toggle
**And** "Remember me" checkbox optional (extends session to 30 days)
**And** Submit button disabled until both fields filled
**And** Login completes in < 1 second
**And** Successful login redirects to dashboard
**And** Session persisted across browser restarts if "remember me" checked
**And** Error message for incorrect credentials: "Invalid email or password"
**And** Error message for unverified email: "Please verify your email first"
**And** "Forgot password?" link visible and functional
**And** "Don't have an account? Sign up" link to signup page
**And** Form fully keyboard navigable (Tab, Enter to submit)
**And** Touch targets 44x44px minimum on mobile

**Prerequisites:** Story 2.1 (signup exists), Story 2.2 (social login implemented)

**Technical Notes:**
- Create `/app/(auth)/login/page.tsx`
- Use React Hook Form + Zod for validation
- Call `supabase.auth.signInWithPassword({ email, password })`
- Handle errors: invalid credentials, user not found, email not verified, network error
- Implement "Remember me" via session persistence settings
- Add show/hide password toggle (eye icon)
- Style with Chakra UI (matching signup page design)
- Responsive layout: centered card on desktop, full-width on mobile
- Password field type="password" with toggle to type="text"
- ARIA labels for accessibility

---

### Story 2.4: Password Reset Flow

As a user who forgot their password,
I want to reset it via email verification,
So that I can regain access to my account.

**Acceptance Criteria:**

**Given** I forgot my password
**When** I request a password reset and verify via email
**Then** I can set a new password and log in

**And** "Forgot password?" link on login page goes to `/forgot-password`
**And** Forgot password page has email input field
**And** Email validation ensures valid format before submission
**And** Clicking "Send reset link" triggers Supabase password reset email
**And** Success message: "Password reset link sent to your email"
**And** Reset email contains link to `/reset-password?token=xxx`
**And** Reset password page validates token is valid and not expired
**And** New password field with same requirements as signup (8+ chars, complexity)
**And** Password confirmation field must match
**And** Submit "Reset password" updates password in Supabase
**And** Success message: "Password updated successfully! Please log in."
**And** Redirect to login page after successful reset
**And** Token expires after 1 hour (Supabase default)
**And** Error handling: expired token, invalid token, network errors

**Prerequisites:** Story 2.3 (login page exists)

**Technical Notes:**
- Create `/app/(auth)/forgot-password/page.tsx`
- Create `/app/(auth)/reset-password/page.tsx`
- Call `supabase.auth.resetPasswordForEmail({ email })`
- Token handled automatically by Supabase via magic link
- Call `supabase.auth.updateUser({ password: newPassword })` on reset page
- Customize email template in Supabase dashboard
- Same password validation as signup (React Hook Form + Zod)
- Handle edge cases: user not found (still show success for security), multiple reset requests
- Toast notification on success using Chakra UI `useToast`

---

### Story 2.5: Session Management and Auto-Logout

As a logged-in user,
I want my session to be secure with automatic timeout after inactivity,
So that my financial data is protected on shared devices.

**Acceptance Criteria:**

**Given** I am logged in
**When** I am inactive for the configured period
**Then** My session expires and I am logged out automatically

**And** Session timeout set to 30 days for "remember me" users
**And** Session timeout set to 24 hours for non-"remember me" users
**And** Inactivity timer tracks user interactions (clicks, key presses, mouse movement)
**And** Warning modal appears 5 minutes before auto-logout: "You'll be logged out in 5 minutes due to inactivity"
**And** User can click "Stay logged in" to extend session
**And** Auto-logout redirects to login page with message: "You were logged out due to inactivity"
**And** Session refreshed automatically on page load if token still valid
**And** Logout button in header immediately ends session
**And** Clicking logout clears session cookies and redirects to login
**And** Multi-tab support: logging out in one tab logs out all tabs
**And** Session persists across page refreshes (token stored in httpOnly cookie)

**Prerequisites:** Story 2.3 (login implemented)

**Technical Notes:**
- Use Supabase session handling (automatic token refresh)
- Configure session expiry in Supabase dashboard settings
- Implement inactivity detection with setTimeout
- Use Chakra UI Modal for timeout warning
- Call `supabase.auth.signOut()` for logout
- Clear local state on logout
- Use broadcast channel API for multi-tab sync (or Supabase realtime)
- Test session expiry edge cases
- Store session in httpOnly cookies for security

---

### Story 2.6: First-Time User Onboarding

As a new user who just signed up,
I want a brief onboarding experience explaining key features,
So that I understand how to use Smart Budget effectively.

**Acceptance Criteria:**

**Given** I just created my account and verified my email
**When** I log in for the first time
**Then** I see a welcoming onboarding flow

**And** Welcome modal appears: "Welcome to Smart Budget! Let's get you started."
**And** Step 1: Explains transaction entry - "Track your spending in under 30 seconds"
**And** Step 2: Explains dashboard - "See where your money goes with visual charts"
**And** Step 3: Explains AI insights - "Get personalized coaching to optimize your budget"
**And** Each step has visual illustration or screenshot
**And** "Next" button advances through steps
**And** "Skip" button available to exit onboarding
**And** Final step: "Let's add your first transaction!" with CTA button
**And** Clicking CTA opens transaction entry modal
**And** Onboarding shows only once (flag stored in user preferences)
**And** User can re-trigger onboarding from Settings page
**And** Modal fully keyboard accessible (Esc to close, Tab to navigate)
**And** Mobile responsive (single column, full screen on small devices)

**Prerequisites:** Story 2.1 (signup), Story 2.3 (login), Story 1.2 (database for user preferences)

**Technical Notes:**
- Create onboarding modal component using Chakra UI Modal
- Store onboarding completion in user metadata or separate preferences table
- Check on dashboard load: if first login && !onboarding_completed, show modal
- Use Chakra UI stepper or custom carousel for multi-step flow
- Illustrations can be simple SVGs or screenshots from UX design
- Update user record: `UPDATE users SET onboarding_completed = true`
- Make onboarding retriggerable from Settings page (optional)
- Keep copy concise and action-oriented (3-4 sentences per step max)

---

## Epic 3: Transaction Management

**Goal:** Implement core transaction CRUD operations with optimized entry flow, enabling users to track all income and expenses efficiently.

**Business Value:** Users can log all financial transactions in under 30 seconds, the primary use case (3x/week frequency). Foundation for all analytics and insights.

**Covers:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10

### Story 3.1: Quick Transaction Entry Modal (Income and Expense)

As a user,
I want to add a transaction quickly via a floating action button,
So that I can log expenses and income in under 30 seconds.

**Acceptance Criteria:**

**Given** I want to log a transaction
**When** I click the FAB and fill out the quick-entry form
**Then** My transaction is saved in under 30 seconds

**And** Floating Action Button (FAB) fixed in bottom-right corner (60x60px, Trust Blue)
**And** FAB shows "+" icon, always visible on all pages
**And** Clicking FAB opens transaction entry modal
**And** Modal auto-focuses on amount input field
**And** Amount field accepts numeric input only (mobile numeric keyboard)
**And** Amount formatted to 2 decimal places automatically
**And** Transaction type toggle: "Expense" (default) vs "Income" (segmented control)
**And** Category dropdown shows recently-used categories first (last 5)
**And** Then shows all predefined categories alphabetically
**And** Category dropdown searchable/filterable
**And** Date picker defaults to today's date
**And** Quick date options: Today, Yesterday, 2 days ago
**And** Optional notes field (100 character limit, single line)
**And** "Save" button disabled until amount and category selected
**And** Optimistic UI: transaction appears immediately in list before server confirmation
**And** Success toast: "Transaction added successfully"
**And** Modal closes automatically on successful save
**And** All fields cleared for next entry
**And** Entire flow completable with keyboard only
**And** Touch targets 44x44px minimum on mobile

**Prerequisites:** Story 1.2 (database), Story 2.3 (user logged in), Story 4.1 (categories seeded)

**Technical Notes:**
- Create `<FloatingActionButton>` component (Chakra UI IconButton)
- Create `<TransactionEntryModal>` component with React Hook Form + Zod
- Use Chakra UI Modal, Input, Select, Button components
- API: `POST /api/transactions` with body `{ amount, type, category_id, date, notes }`
- Optimistic update pattern with SWR: `mutate([...transactions, newTransaction], false)`
- Category dropdown: fetch from `/api/categories` sorted by recent usage
- Date picker: Chakra UI or react-datepicker with quick-select buttons
- Numeric input: pattern="[0-9]*" inputMode="decimal" for mobile
- Auto-format amount: `parseFloat(value).toFixed(2)` on blur
- Validation: amount > 0, category required, date not in future
- Error handling: network failure (retry button), validation errors (inline messages)
- Mobile: full-screen modal, desktop: 600px centered modal

---

### Story 3.2: Transaction List View with Filtering and Search

As a user,
I want to view my complete transaction history with filtering and search,
So that I can find specific transactions quickly.

**Acceptance Criteria:**

**Given** I navigate to the Transactions page
**When** I view, filter, and search my transactions
**Then** I can find exactly what I need efficiently

**And** Transactions page at `/transactions` route
**And** All transactions displayed in chronological order (newest first)
**And** Each transaction shows: date, category (with color), description/notes, amount
**And** Income transactions show in green (+$100.00)
**And** Expense transactions show in red (-$50.00)
**And** Filter controls above list: Date range picker, Category dropdown, Type (All/Income/Expense)
**And** Search box filters by notes, category name, or amount
**And** Search debounced (300ms delay) to avoid excessive API calls
**And** Filters update results in < 500ms for datasets up to 10,000 transactions
**And** "Clear filters" button resets all filters
**And** Empty state when no transactions: "No transactions yet. Add your first one!"
**And** Empty state when no search results: "No transactions found. Try different filters."
**And** Pagination or virtual scrolling for >100 transactions
**And** Loading skeleton shown while fetching data
**And** Each transaction card clickable to expand with full details
**And** Mobile: stack filters vertically, desktop: horizontal filter bar

**Prerequisites:** Story 3.1 (transactions can be created), Story 4.1 (categories exist)

**Technical Notes:**
- Create `/app/(dashboard)/transactions/page.tsx`
- Fetch transactions via `GET /api/transactions?startDate=...&endDate=...&category=...&type=...&search=...`
- Use SWR for data fetching with caching
- Server-side filtering in Supabase query for performance
- Client-side search debouncing with lodash.debounce or custom hook
- Use Chakra UI Card, Stack, Text for transaction cards
- Date range picker: Chakra UI or react-date-range
- Virtual scrolling: react-window or tanstack-virtual for large lists
- Loading state: Chakra UI Skeleton components matching card layout
- Color-coding: green for income (Success color), red for expense (Error color)
- Mobile responsive: full-width cards, simplified layout

---

### Story 3.3: Edit and Delete Transactions

As a user,
I want to edit or delete existing transactions,
So that I can correct mistakes or remove duplicates.

**Acceptance Criteria:**

**Given** I have existing transactions
**When** I click edit or delete on a transaction
**Then** The transaction is updated or removed successfully

**And** Each transaction card has edit (pencil icon) and delete (trash icon) buttons
**And** Edit button opens same modal as quick-entry, pre-filled with transaction data
**And** Modal title changes to "Edit Transaction"
**And** All fields editable: amount, type, category, date, notes
**And** "Save" button updates transaction via PUT request
**And** Optimistic update: changes appear immediately
**And** Success toast: "Transaction updated successfully"
**And** Delete button triggers confirmation modal: "Delete this transaction? This cannot be undone."
**And** Confirmation modal has "Cancel" and "Delete" buttons
**And** Delete button styled as danger (red)
**And** Clicking "Delete" removes transaction via DELETE request
**And** Optimistic removal: transaction disappears immediately from list
**And** Success toast: "Transaction deleted successfully"
**And** Undo option in toast (5-second window) to restore deleted transaction
**And** Both operations complete in < 200ms (perceived time with optimistic UI)
**And** Error handling: network failure shows retry option, validation errors shown inline

**Prerequisites:** Story 3.1 (transaction entry), Story 3.2 (transaction list)

**Technical Notes:**
- Reuse `<TransactionEntryModal>` component with edit mode prop
- Add edit/delete IconButtons to transaction cards
- API: `PUT /api/transactions/:id` with updated data
- API: `DELETE /api/transactions/:id`
- Optimistic update pattern with SWR mutate
- Confirmation modal using Chakra UI AlertDialog
- Undo functionality: store deleted transaction in state for 5 seconds, POST if undo clicked
- Toast with undo: `toast({ title: 'Transaction deleted', action: <Button>Undo</Button> })`
- Mobile: swipe-to-delete gesture optional (use Chakra UI or framer-motion)
- Error rollback: if API fails, revert optimistic update and show error toast

---

### Story 3.4: Transaction Data Persistence and Sync

As a user,
I want my transactions to persist securely and sync across all my devices,
So that I never lose data and can access it anywhere.

**Acceptance Criteria:**

**Given** I add, edit, or delete transactions
**When** I refresh the page or switch devices
**Then** All changes are persisted and synced

**And** Transactions saved immediately to Supabase on creation/update/delete
**And** No data loss on browser refresh or unexpected shutdown
**And** Changes visible on all logged-in devices within 5 seconds
**And** Real-time sync via Supabase Realtime subscriptions
**And** Offline changes queued and synced when connection restored (Phase 2)
**And** Conflict resolution: last-write-wins for concurrent edits
**And** Transaction history retained indefinitely unless user deletes
**And** Database Row Level Security ensures user can only access own transactions
**And** Transaction timestamps stored in UTC, displayed in user's local timezone
**And** Data integrity maintained: foreign key constraints prevent orphaned records

**Prerequisites:** Story 3.1 (transactions created), Story 1.2 (database with RLS)

**Technical Notes:**
- All CRUD operations use Supabase client with RLS policies
- Subscribe to real-time changes: `supabase.channel('transactions').on('postgres_changes', ...)`
- SWR revalidation on focus and reconnect
- Store timestamps in PostgreSQL as `TIMESTAMP WITH TIME ZONE`
- Display dates using date-fns with user's timezone
- Test multi-device sync: open app in 2 browser windows, verify changes appear
- RLS policies already defined in Story 1.2: `auth.uid() = user_id`
- Handle connection errors gracefully (retry logic, offline indicator)
- Index on user_id + date for fast queries

---

## Epic 4: Category System

**Goal:** Implement comprehensive category management with predefined categories, custom categories, and visual organization via color-coding.

**Business Value:** Users can organize transactions meaningfully, enabling effective filtering and visual analysis in dashboard.

**Covers:** FR11, FR12, FR13, FR14, FR15, FR16, FR17

### Story 4.1: Seed Default Categories on User Signup

As a new user,
I want a set of common categories pre-configured,
So that I can start tracking transactions immediately without setup.

**Acceptance Criteria:**

**Given** I just created my account
**When** My account is initialized
**Then** I have default expense and income categories available

**And** 7 predefined expense categories created automatically:
  - Dining (#f56565 coral red)
  - Transport (#4299e1 blue)
  - Entertainment (#9f7aea purple)
  - Utilities (#48bb78 green)
  - Shopping (#ed8936 orange)
  - Healthcare (#38b2ac teal)
  - Rent (#e53e3e red)
**And** 4 predefined income categories created automatically:
  - Salary (#38a169 success green)
  - Freelance (#4299e1 blue)
  - Investment (#9f7aea purple)
  - Gift (#f56565 coral)
**And** All predefined categories marked with `is_predefined = true`
**And** Categories available immediately in transaction entry dropdown
**And** Categories created via database trigger or signup hook
**And** Each category has unique ID, name, color, type, and user association
**And** Seeding completes in < 1 second (part of signup flow)

**Prerequisites:** Story 1.2 (database schema), Story 2.1 (user signup)

**Technical Notes:**
- Create Supabase database function to seed categories
- Trigger function on user creation (Supabase Auth trigger)
- Alternatively: seed in signup API route after user creation
- SQL: `INSERT INTO categories (user_id, name, color, type, is_predefined) VALUES ...`
- Color codes match UX Design specification Trust Blue theme
- Test by creating new user and verifying categories exist
- Handle edge case: re-running seed doesn't create duplicates (check if exists)

---

### Story 4.2: Create Custom Categories

As a user,
I want to create my own custom categories with names and colors,
So that I can organize transactions according to my personal spending patterns.

**Acceptance Criteria:**

**Given** I need a category not in the predefined list
**When** I create a custom category
**Then** It's available for use in transactions

**And** "Manage Categories" page accessible from Settings or sidebar
**And** "Add Category" button opens category creation modal
**And** Modal has category name input field (max 100 characters)
**And** Category type selector: Expense or Income
**And** Color picker shows 12 predefined color options (from theme palette)
**And** Color preview shown next to name field
**And** "Save" button disabled until name and color selected
**And** Category name validated: not empty, unique per user per type
**And** Category created via `POST /api/categories`
**And** New category appears immediately in category list (optimistic UI)
**And** New category available in transaction entry dropdown immediately
**And** Success toast: "Category '[name]' created successfully"
**And** Modal closes automatically on save
**And** Form fully keyboard accessible
**And** Mobile responsive: full-screen modal on small devices

**Prerequisites:** Story 4.1 (default categories exist), Story 3.1 (transaction entry uses categories)

**Technical Notes:**
- Create `/app/(dashboard)/categories/page.tsx`
- Create `<CategoryModal>` component with React Hook Form + Zod
- Color picker: Chakra UI or custom component with predefined palette
- Palette colors from theme: Trust Blue, coral red, purple, teal, orange, green, etc.
- API: `POST /api/categories` with body `{ name, color, type }`
- Validation: check uniqueness in Supabase (unique constraint on user_id + name + type)
- Optimistic update using SWR mutate
- Error handling: duplicate name ("Category already exists"), network error
- Display categories in grid with color badge + name

---

### Story 4.3: Edit and Delete Custom Categories

As a user,
I want to edit or delete my custom categories,
So that I can reorganize my spending classification as needed.

**Acceptance Criteria:**

**Given** I have custom categories
**When** I edit or delete a category
**Then** Changes are reflected across all transactions

**And** Each custom category card has edit (pencil) and delete (trash) icons
**And** Predefined categories show "Default" badge and no delete icon
**And** Clicking edit opens category modal pre-filled with current values
**And** Name and color editable, type read-only (cannot change expense ↔ income)
**And** "Save" updates category via `PUT /api/categories/:id`
**And** Update reflected immediately across all transactions using that category
**And** Delete button triggers confirmation modal
**And** Confirmation shows transaction count: "Delete '[name]'? 47 transactions use this category."
**And** If transactions exist, warning: "Transactions will become uncategorized"
**And** Option to reassign transactions to different category before deletion
**And** Clicking "Delete" removes category via `DELETE /api/categories/:id`
**And** Transactions with deleted category show "Uncategorized" placeholder
**And** Cannot delete predefined categories (button disabled/hidden)
**And** Success toasts for edit and delete actions

**Prerequisites:** Story 4.2 (custom categories created), Story 3.1 (transactions use categories)

**Technical Notes:**
- Reuse `<CategoryModal>` in edit mode
- API: `PUT /api/categories/:id`, `DELETE /api/categories/:id`
- Query transaction count: `SELECT COUNT(*) FROM transactions WHERE category_id = :id`
- Deletion with reassignment: update all transactions to new category first, then delete
- Database constraint: `ON DELETE RESTRICT` prevents deletion if transactions exist (alternative approach)
- Handle orphaned transactions: show "Uncategorized" in UI, null category_id in database (or create "Uncategorized" category)
- Optimistic updates with rollback on error
- Predefined categories: `is_predefined = true` flag in database, disable edit/delete

---

### Story 4.4: Category Color-Coding and Visual Display

As a user,
I want categories displayed with color-coding throughout the app,
So that I can quickly identify transaction types visually.

**Acceptance Criteria:**

**Given** I view transactions, dashboard, or category list
**When** Categories are displayed
**Then** Each category shows its assigned color for quick visual recognition

**And** Transaction list: each transaction shows category color dot (12px circle) next to name
**And** Transaction entry modal: category dropdown shows color dot before each category name
**And** Dashboard charts: categories displayed with their assigned colors
**And** Category management page: categories displayed as colored badges
**And** Category color used consistently across entire application
**And** Color contrast meets WCAG AA standards (3:1 for UI components)
**And** Color-blind friendly: categories also distinguished by icon or pattern (optional)
**And** Category badges show color as left border or background with white text
**And** Mobile and desktop: color-coding equally visible on all screen sizes

**Prerequisites:** Story 4.1 (categories have colors), Story 3.2 (transaction list), Story 4.2 (custom categories)

**Technical Notes:**
- Create `<CategoryBadge>` component: `<Badge leftIcon={<Circle color={category.color} />}>{category.name}</Badge>`
- Use Chakra UI Badge, Tag, or custom styled component
- Color stored as hex in database (#f56565), applied via style prop
- Charts: pass category colors to Recharts via `fill` prop
- Ensure color palette has sufficient contrast (test with Color Oracle)
- Alternative visual indicators: icons for major categories (dining fork/knife, car for transport, etc.)
- Consider color-blind mode in Settings (Phase 2)

---

### Story 4.5: Recently-Used Categories Quick Access

As a user,
I want my recently-used categories shown first in the transaction entry dropdown,
So that I can select common categories faster.

**Acceptance Criteria:**

**Given** I open the transaction entry modal
**When** I view the category dropdown
**Then** My 5 most recently-used categories are shown at the top

**And** "Recent" section appears first in dropdown, separated by divider
**And** Shows last 5 categories used in transactions (most recent first)
**And** Each recent category shows color dot + name
**And** "All Categories" section below shows all categories alphabetically
**And** If fewer than 5 categories used, show all recent ones
**And** New users with no transactions see only "All Categories" section
**And** Recent categories updated immediately after saving a transaction
**And** Recent list stored per user in database or calculated from transaction history
**And** Dropdown remains searchable/filterable (typing filters both Recent and All)
**And** Selecting recent category same behavior as selecting from full list
**And** Mobile: recent categories large enough to tap easily (44x44px touch target)

**Prerequisites:** Story 3.1 (transaction entry modal), Story 4.1 (categories exist), Story 3.4 (transaction history)

**Technical Notes:**
- Query recent categories: `SELECT DISTINCT category_id FROM transactions WHERE user_id = :id ORDER BY created_at DESC LIMIT 5`
- Join with categories table to get names and colors
- Store in component state or fetch on modal open
- Update after transaction creation (invalidate SWR cache)
- Chakra UI Select with option groups: `<optgroup label="Recent">` and `<optgroup label="All Categories">`
- Alternative: custom dropdown component with sections
- Search/filter: filter across both Recent and All categories lists

---

## Epic 5: Financial Dashboard & Visualizations

**Goal:** Implement the visual intelligence dashboard with charts, metrics, and responsive design, enabling users to understand spending patterns at a glance.

**Business Value:** Users can see where money goes via visual charts within 45-60 seconds (weekly ritual), driving financial awareness and behavior change.

**Covers:** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR44, FR45, FR46

### Story 5.1: Dashboard Layout and Navigation

As a user,
I want a responsive dashboard with sidebar navigation,
So that I can access all features and see my financial overview immediately.

**Acceptance Criteria:**

**Given** I log in to the application
**When** I land on the dashboard
**Then** I see a comprehensive financial overview with easy navigation

**And** Dashboard is the default landing page after login (`/` or `/dashboard`)
**And** Sidebar navigation on left (250px width on desktop)
**And** Sidebar shows navigation items: Dashboard, Transactions, Categories, Insights, Settings
**And** Active nav item highlighted with Trust Blue color + left border (4px)
**And** Sidebar collapsible on tablet (icon-only mode)
**And** Mobile: sidebar hidden, hamburger menu icon in header opens drawer
**And** Header shows app logo, user avatar/name, logout button
**And** Main content area responsive (fills remaining space)
**And** Mobile (<768px): single column, bottom navigation bar optional
**And** Tablet (768-1023px): collapsible sidebar, single column content
**And** Desktop (≥1024px): full sidebar, multi-column dashboard grid
**And** All navigation keyboard accessible (Tab, Enter to activate)
**And** Screen reader announces current page ("Dashboard page")

**Prerequisites:** Story 1.1 (Next.js setup), Story 2.3 (user logged in)

**Technical Notes:**
- Create `/app/(dashboard)/layout.tsx` with sidebar
- Use Chakra UI Flex, Box, Drawer for responsive layout
- Sidebar component: `<Sidebar>` with navigation links
- Mobile: Chakra UI Drawer triggered by IconButton (hamburger)
- Active link detection using Next.js `usePathname()` hook
- Responsive breakpoints: Chakra UI `useBreakpointValue` hook
- Max-width 1200px for content area (centered on large screens)
- Sticky header on scroll (optional)

---

### Story 5.2: Financial Summary Cards (StatCards)

As a user,
I want to see key financial metrics at the top of my dashboard,
So that I can quickly assess my current financial status.

**Acceptance Criteria:**

**Given** I view the dashboard
**When** The page loads
**Then** I see three StatCards showing Total Balance, Monthly Income, and Monthly Expenses

**And** Three StatCards displayed horizontally on desktop, stacked vertically on mobile
**And** StatCard #1: Total Balance (Income - Expenses for current month)
  - Large number (2.5-3rem font), bold
  - Trend indicator: up/down arrow + percentage vs last month
  - Green if positive balance, red if negative
**And** StatCard #2: Monthly Income (sum of income transactions this month)
  - Large number with + prefix (e.g., +$5,000.00)
  - Green color (success theme)
  - Trend vs last month
**And** StatCard #3: Monthly Expenses (sum of expense transactions this month)
  - Large number with - prefix (e.g., -$3,500.00)
  - Red color (error theme)
  - Trend vs last month
**And** All amounts formatted with currency symbol ($) and 2 decimals
**And** Trend calculations: ((currentMonth - lastMonth) / lastMonth) * 100
**And** Empty state: "$0.00" if no transactions
**And** Cards load within 1 second (data fetched server-side or cached)
**And** Cards update immediately when transactions added/edited (real-time via SWR)

**Prerequisites:** Story 3.1 (transactions exist), Story 5.1 (dashboard layout)

**Technical Notes:**
- Create `<StatCard>` component (reusable)
- Use Chakra UI Stat, StatLabel, StatNumber, StatHelpText, StatArrow components
- Fetch aggregated data via API: `GET /api/dashboard/stats?month=2025-11`
- Server-side aggregation in Supabase:
  ```sql
  SELECT
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
  FROM transactions
  WHERE user_id = :id AND date >= :start_of_month AND date < :end_of_month
  ```
- Calculate trends by comparing current month to previous month
- Use SWR for caching and real-time updates
- Number formatting: `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
- Skeleton loading state while fetching data

---

### Story 5.3: Monthly Spending by Category (Pie/Donut Chart)

As a user,
I want to see my spending broken down by category in a visual chart,
So that I can identify where most of my money goes.

**Acceptance Criteria:**

**Given** I view the dashboard
**When** I look at the spending breakdown section
**Then** I see a pie or donut chart showing category distribution

**And** Chart displays current month's expenses grouped by category
**And** Each category slice colored with its assigned category color
**And** Chart shows percentage of total spending per category
**And** Hovering over slice shows tooltip: "[Category]: $X (Y%)"
**And** Chart rendered using Recharts library (as per architecture)
**And** Chart responsive: adapts to container width (250-400px height)
**And** Legend below chart showing all categories with colors
**And** Clicking legend item toggles category visibility in chart
**And** Empty state if no expenses: "No expenses yet this month"
**And** Chart updates in real-time when transactions added (<300ms)
**And** Mobile: chart scales to fit screen, legend below
**And** Accessible data table alternative (hidden by default, screen reader accessible)

**Prerequisites:** Story 3.1 (transactions), Story 4.1 (categories with colors), Story 5.2 (dashboard structure)

**Technical Notes:**
- Install Recharts: `npm install recharts`
- Use `<PieChart>` or `<ResponsiveContainer>` + `<PieChart>` from Recharts
- Fetch aggregated data: `GET /api/dashboard/spending-by-category?month=2025-11`
- Server-side aggregation:
  ```sql
  SELECT c.name, c.color, SUM(t.amount) as total
  FROM transactions t
  JOIN categories c ON t.category_id = c.id
  WHERE t.user_id = :id AND t.type = 'expense' AND t.date >= :start AND t.date < :end
  GROUP BY c.id
  ORDER BY total DESC
  ```
- Map category colors to chart `fill` prop
- Tooltip customization: Recharts CustomTooltip component
- Accessible table: render HTML table with same data, visually hidden but screen reader accessible
- SWR for data fetching and real-time updates

---

### Story 5.4: Spending Trends Over Time (Line Chart)

As a user,
I want to see my spending trends over the last 6 months,
So that I can identify patterns and changes in my spending behavior.

**Acceptance Criteria:**

**Given** I view the dashboard
**When** I look at the trends section
**Then** I see a line chart showing spending over the last 6 months

**And** X-axis shows months (e.g., "Jun", "Jul", "Aug", "Sep", "Oct", "Nov")
**And** Y-axis shows dollar amounts
**And** Two lines plotted: Income (green) and Expenses (red)
**And** Data points show exact amounts on hover
**And** Tooltip shows: "[Month]: Income $X, Expenses $Y"
**And** Chart renders responsively (300px height, full width)
**And** Grid lines for readability
**And** Legend indicates Income vs Expenses
**And** Empty state: "Add transactions to see trends"
**And** Chart updates when transactions added (<300ms)
**And** Mobile: chart scrolls horizontally if needed, or shows last 3 months by default
**And** Accessible data table alternative for screen readers

**Prerequisites:** Story 3.1 (transactions), Story 5.3 (chart infrastructure)

**Technical Notes:**
- Use Recharts `<LineChart>`, `<Line>`, `<XAxis>`, `<YAxis>`, `<Tooltip>`, `<Legend>`
- Fetch data: `GET /api/dashboard/trends?months=6`
- Server-side aggregation:
  ```sql
  SELECT
    DATE_TRUNC('month', date) as month,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
  FROM transactions
  WHERE user_id = :id AND date >= :six_months_ago
  GROUP BY month
  ORDER BY month
  ```
- Format month labels: date-fns `format(date, 'MMM')`
- Two `<Line>` components: one for income (stroke="green"), one for expenses (stroke="red")
- Tooltip: custom component showing both values
- Responsive: use Recharts ResponsiveContainer

---

### Story 5.5: Month-over-Month Comparison Highlights

As a user,
I want to see month-over-month comparisons highlighting spending changes,
So that I can quickly spot increases or decreases in spending.

**Acceptance Criteria:**

**Given** I view the dashboard
**When** I look at the comparison section
**Then** I see highlights showing significant spending changes

**And** Section titled "This Month vs Last Month"
**And** Shows categories with >20% increase in spending (red/warning)
**And** Shows categories with >20% decrease in spending (green/success)
**And** Format: "[Category]: ↑ 40% ($480 vs $340)"
**And** Up to 5 most significant changes shown
**And** Empty state: "No significant changes this month"
**And** Updates immediately when transactions added
**And** Click on category to see detailed breakdown (drills down to category filter)
**And** Mobile: list format, desktop: grid or list

**Prerequisites:** Story 3.1 (transactions), Story 4.1 (categories), Story 5.2 (dashboard)

**Technical Notes:**
- Fetch data: `GET /api/dashboard/month-over-month`
- Calculate changes server-side:
  ```sql
  WITH current_month AS (...),
       last_month AS (...)
  SELECT
    c.name,
    current.total as current_amount,
    last.total as last_amount,
    ((current.total - last.total) / last.total * 100) as percent_change
  FROM current_month current
  JOIN last_month last ON current.category_id = last.category_id
  WHERE ABS(percent_change) > 20
  ORDER BY ABS(percent_change) DESC
  LIMIT 5
  ```
- Display with colored indicators: up arrow (red) for increases, down arrow (green) for decreases
- Use Chakra UI List, ListItem, Badge
- Click handler: navigate to `/transactions?category=[id]`

---

### Story 5.6: Chart Interactivity and Drill-Down

As a user,
I want to interact with dashboard charts,
So that I can explore my data in more detail.

**Acceptance Criteria:**

**Given** I view dashboard charts
**When** I hover or click on chart elements
**Then** I see detailed information and can drill down

**And** Pie chart: clicking slice navigates to `/transactions?category=[id]&month=[month]`
**And** Line chart: clicking data point navigates to `/transactions?month=[month]`
**And** Hovering shows detailed tooltip with exact values
**And** Tooltips appear within 100ms of hover
**And** Cursor changes to pointer on clickable chart elements
**And** Drill-down loads filtered transaction list pre-filtered to category/month
**And** "Back to Dashboard" link on transaction page to return
**And** Mobile: tap instead of hover, tooltip appears on tap
**And** Keyboard accessible: Tab to focus chart, Enter to drill down
**And** Screen reader: announces chart data and drill-down options

**Prerequisites:** Story 5.3 (pie chart), Story 5.4 (line chart), Story 3.2 (transaction list with filters)

**Technical Notes:**
- Recharts onClick handlers: `<Pie onClick={(data) => router.push(...) }/>`
- Pass category_id or month as query params in URL
- Transaction page reads query params and auto-applies filters
- Custom tooltip component with Chakra UI styling
- Keyboard: use Recharts accessibility props
- ARIA labels for chart elements

---

### Story 5.7: Dashboard Performance and Loading States

As a user,
I want the dashboard to load quickly with smooth loading states,
So that I don't wait for data and the app feels responsive.

**Acceptance Criteria:**

**Given** I navigate to the dashboard
**When** The page is loading
**Then** I see skeleton loaders matching the final layout

**And** Dashboard loads within 2 seconds (as per NFR FR25)
**And** Skeleton loaders shown for StatCards (3 rectangles)
**And** Skeleton loaders shown for charts (chart-shaped placeholders)
**And** Skeletons match final component dimensions
**And** Data fetched server-side where possible (SSR for initial load)
**And** SWR caches data client-side for instant subsequent loads
**And** Real-time updates via Supabase Realtime subscriptions
**And** Chart updates complete within 300ms (as per NFR)
**And** Optimistic updates: new transactions appear immediately
**And** Error state if data fetch fails: "Unable to load dashboard. Retry"
**And** Retry button refetches data

**Prerequisites:** Story 5.2 (StatCards), Story 5.3-5.5 (charts)

**Technical Notes:**
- Use Chakra UI Skeleton component: `<Skeleton height="200px" />`
- Next.js SSR: fetch initial data in Server Component
- SWR for client-side caching: `useSWR('/api/dashboard/stats')`
- Supabase Realtime: subscribe to transactions table changes
- Revalidate SWR cache on transaction changes
- Error boundary component to catch and display errors
- Loading states: show skeleton until data arrives
- Test performance: Lighthouse audit, target >90 performance score

---

### Story 5.8: Responsive Dashboard for Mobile and Tablet

As a user,
I want the dashboard to work perfectly on my phone and tablet,
So that I can check my finances on the go.

**Acceptance Criteria:**

**Given** I view the dashboard on different devices
**When** The screen size changes
**Then** The layout adapts appropriately

**And** Mobile (<768px):
  - Single column layout
  - StatCards stacked vertically
  - Charts full width, stacked vertically
  - Bottom navigation or collapsible sidebar
  - Touch targets 44x44px minimum
**And** Tablet (768-1023px):
  - Two-column grid for StatCards
  - Charts side-by-side or stacked depending on space
  - Collapsible sidebar (icon-only)
**And** Desktop (≥1024px):
  - Full sidebar (250px)
  - Three-column StatCard grid
  - Charts side-by-side
  - Max-width 1200px container
**And** All breakpoints tested and functional
**And** Touch interactions work on mobile (swipe, tap, pinch-zoom disabled on charts)
**And** Fonts scale appropriately (H1: 2.5rem desktop, 2rem mobile)
**And** Charts render correctly at all sizes
**And** No horizontal scrolling on mobile

**Prerequisites:** Story 5.1-5.7 (all dashboard components)

**Technical Notes:**
- Use Chakra UI responsive utilities: `<Box display={{ base: 'block', md: 'flex' }}>`
- Test on multiple devices: iPhone SE (320px), iPad (768px), desktop (1440px)
- Chakra breakpoints: `base` (<768px), `md` (768px), `lg` (1024px)
- Recharts ResponsiveContainer for chart sizing
- Mobile navigation: bottom nav or drawer
- CSS Grid for layout: `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`

---

## Epic 6: AI Budget Insights

**Goal:** Implement rules-based AI insight generation with personalized spending recommendations in a coaching tone.

**Business Value:** Users receive proactive budget optimization advice (3+ insights/month), driving the 15% reduction in overspending success metric.

**Covers:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37

### Story 6.1: AI Insights Rules Engine Implementation

As a developer,
I want a rules-based insights generation engine,
So that the system can analyze spending patterns and generate personalized recommendations.

**Acceptance Criteria:**

**Given** Users have transaction history
**When** The insight generation job runs
**Then** Meaningful insights are created based on spending patterns

**And** 4 insight rule types implemented:
  1. **Spending Increase Detection** (Priority 4 - High)
     - Triggers when category spending >20% higher than previous month
     - Example: "Dining spending increased 40% ($480 vs $340 last month)"
  2. **Budget Limit Recommendations** (Priority 3 - Medium)
     - Based on 3-month average + 10% buffer
     - Example: "Based on your $340/month average, consider a $375 Dining budget"
  3. **Unusual Expense Flagging** (Priority 5 - Critical)
     - Detects transactions >2 standard deviations from category mean
     - Example: "Unusual Shopping expense: $500 is much higher than your typical $50"
  4. **Positive Reinforcement** (Priority 2 - Low)
     - Celebrates categories <90% of recommended budget
     - Example: "Great job on Transport! You're 30% under budget, saving $120 this month"
**And** All rules implemented in `lib/ai/insightRules.ts`
**And** Statistical functions: mean, standard deviation, month-over-month comparison
**And** Insights stored in `insights` table with type, priority, metadata
**And** Generation triggered: on new month, after 10+ new transactions, manual refresh
**And** Caching: insights cached for 1 hour to avoid redundant calculations
**And** Each insight includes: title, description, type, priority, metadata (amounts, category info)

**Prerequisites:** Story 1.2 (insights table), Story 3.1 (transactions exist)

**Technical Notes:**
- Create `lib/ai/insightRules.ts` with rule functions
- Create `lib/ai/spendingAnalysis.ts` for statistical calculations
- Create `lib/services/insightService.ts` to orchestrate rule execution
- Query transactions for analysis (current month, last 3 months, category-specific)
- Statistical formulas:
  ```typescript
  mean = sum / count
  stdDev = sqrt(sum((x - mean)^2) / count)
  monthOverMonth = ((current - previous) / previous) * 100
  ```
- Generate insights as array of objects: `{ title, description, type, priority, metadata }`
- Insert into database: `INSERT INTO insights (user_id, title, description, type, priority, metadata)`
- Cache key: `insights_${userId}_${month}` with 1-hour TTL
- API endpoint: `POST /api/insights/generate`

---

### Story 6.2: AI Insights Display on Dashboard

As a user,
I want to see personalized AI insights on my dashboard,
So that I receive proactive budget recommendations.

**Acceptance Criteria:**

**Given** The system has generated insights for me
**When** I view the dashboard
**Then** I see my top 3 AI insights displayed prominently

**And** Insights section titled "AI Budget Coach"
**And** Shows top 3 highest priority insights (priority 5 → 1)
**And** Each insight displayed as AIInsightCard component
**And** Card shows: icon/emoji, title, description, priority indicator, dismiss button
**And** Card colored by type:
  - Spending increase: Orange/warning border
  - Budget recommendation: Blue/info border
  - Unusual expense: Red/error border
  - Positive reinforcement: Green/success border
**And** Insight title in bold, description in regular weight
**And** "View all insights" link to `/insights` page
**And** Empty state: "Keep tracking! We'll have insights after a few weeks of data."
**And** Insights update when new ones generated
**And** Mobile: insights stack vertically, desktop: grid layout
**And** Coaching tone throughout (friendly, not judgmental)

**Prerequisites:** Story 6.1 (insights generated), Story 5.2 (dashboard structure)

**Technical Notes:**
- Create `<AIInsightCard>` component matching UX design spec
- Fetch insights: `GET /api/insights?limit=3&dismissed=false&orderBy=priority DESC`
- Use Chakra UI Alert or custom Card component
- Icon mapping: warning icon (orange), info icon (blue), error icon (red), check icon (green)
- Border color based on type
- Dismiss button (X icon) in top-right corner
- Link to `/insights` page: "See all X insights →"
- Skeleton loader while fetching

---

### Story 6.3: Full AI Insights Page with Filtering

As a user,
I want to view all my AI insights and filter by type,
So that I can review all recommendations and learn from patterns.

**Acceptance Criteria:**

**Given** I navigate to the Insights page
**When** I view and filter insights
**Then** I see all generated insights with filtering options

**And** Insights page at `/insights` route
**And** All insights displayed in chronological order (newest first)
**And** Filter dropdown: All Types, Spending Increases, Budget Recommendations, Unusual Expenses, Positive Reinforcement
**And** Toggle: Show dismissed insights (off by default)
**And** Each insight card shows: type badge, title, description, date generated, dismiss button
**And** Dismissed insights grayed out with "Dismissed" badge
**And** Click "Dismiss" to mark insight as not relevant (updates `is_dismissed = true`)
**And** Undismiss option on dismissed insights (toggle back)
**And** Empty state: "No insights yet. We'll generate insights after you track more transactions."
**And** Insights paginated (20 per page) or infinite scroll
**And** Search box to filter by keyword in title/description
**And** Mobile responsive: full-width cards, stacked layout

**Prerequisites:** Story 6.2 (insights on dashboard), Story 6.1 (insights generated)

**Technical Notes:**
- Create `/app/(dashboard)/insights/page.tsx`
- Fetch insights: `GET /api/insights?type=[type]&dismissed=[bool]&search=[query]`
- Filter state managed with React state or URL query params
- Dismiss action: `PUT /api/insights/:id/dismiss` sets `is_dismissed = true`
- Use Chakra UI Select for type filter, Switch for dismissed toggle
- Search with debouncing (300ms)
- Pagination or infinite scroll (react-infinite-scroll-component)
- Badge for insight type: `<Badge colorScheme="orange">Spending Increase</Badge>`

---

### Story 6.4: Insight Metadata and Supporting Data

As a user,
I want to see supporting data for AI insights,
So that I understand the basis for recommendations.

**Acceptance Criteria:**

**Given** I view an AI insight
**When** I click "See details" or expand the insight
**Then** I see supporting data explaining the insight

**And** Expandable section on insight card (accordion or modal)
**And** Shows metadata: category, amounts compared, time periods, calculations
**And** Example for spending increase:
  - "Dining category"
  - "This month: $480 (15 transactions)"
  - "Last month: $340 (12 transactions)"
  - "Increase: +$140 (+41%)"
**And** Link to view transactions for that category/period
**And** Micro-chart showing trend (optional: line chart of last 3 months)
**And** "Why am I seeing this?" explanation in plain language
**And** Mobile: full-screen modal, desktop: inline expansion
**And** Close/collapse button to hide details

**Prerequisites:** Story 6.3 (insights page), Story 6.1 (metadata stored)

**Technical Notes:**
- Store metadata in `insights.metadata` JSONB column
- Example metadata:
  ```json
  {
    "category_id": "uuid",
    "category_name": "Dining",
    "current_amount": 480,
    "previous_amount": 340,
    "percent_change": 41,
    "transaction_count_current": 15,
    "transaction_count_previous": 12
  }
  ```
- Expandable UI: Chakra UI Accordion or Disclosure
- Render metadata fields dynamically based on insight type
- Link: `/transactions?category=[id]&month=[month]` for drill-down
- Optional: mini line chart using Recharts (sparkline)

---

### Story 6.5: Insight Generation Scheduling and Manual Refresh

As a developer,
I want insights generated automatically on schedule and manually on demand,
So that users always have fresh recommendations.

**Acceptance Criteria:**

**Given** The system is running
**When** Conditions trigger insight generation
**Then** New insights are created and users are notified

**And** Automatic generation triggers:
  1. Start of new month (runs for all users)
  2. After user adds 10+ new transactions
  3. User manually clicks "Refresh insights" button
**And** Scheduled job runs daily at midnight UTC (checks if new month)
**And** Manual refresh button on insights page
**And** Refresh completes in <2 seconds (as per NFR FR20)
**And** Loading indicator while generating
**And** Success toast: "Insights updated! X new insights generated."
**And** If no new insights: "All caught up! No new insights at this time."
**And** Cache invalidation on manual refresh (bypasses 1-hour cache)
**And** Rate limiting: max 1 manual refresh per 5 minutes per user

**Prerequisites:** Story 6.1 (insight generation), Story 6.3 (insights page)

**Technical Notes:**
- Scheduled job: Next.js API route with cron trigger (Vercel Cron Jobs)
- Alternative: Supabase Edge Functions with cron
- Trigger endpoint: `POST /api/insights/generate` with optional `forceRegenerate=true`
- Check last generation timestamp to avoid duplicate runs
- Count new transactions since last generation
- Manual refresh button: calls API with `forceRegenerate=true`
- Loading state: Chakra UI Spinner
- Rate limiting: check timestamp of last manual refresh in database or Redis
- Notification (optional Phase 2): email or push notification for new insights

---

## Epic 7: Data Export & Settings

**Goal:** Implement data export (CSV, PDF) and user account settings, ensuring data portability and user control.

**Business Value:** Users can export financial data for external analysis or record-keeping, fulfilling data ownership promise.

**Covers:** FR38, FR39, FR40, FR41, FR42, FR43, FR47

### Story 7.1: Export Transactions to CSV

As a user,
I want to export my complete transaction history to CSV format,
So that I can analyze data in Excel or import to other tools.

**Acceptance Criteria:**

**Given** I have transactions in my account
**When** I click "Export to CSV" in Settings or Transactions page
**Then** A CSV file downloads with all my transaction data

**And** Export button labeled "Export Transactions (CSV)"
**And** CSV filename format: `transactions-YYYY-MM-DD.csv`
**And** CSV columns: Date, Type, Category, Amount, Notes, Created At
**And** All user transactions included (no pagination limit)
**And** Transactions sorted by date (newest first)
**And** CSV properly formatted with headers
**And** Special characters escaped (commas in notes, quotes)
**And** Currency amounts formatted: `$123.45` (no currency symbol in CSV for Excel compatibility)
**And** Date format: `YYYY-MM-DD` (ISO 8601)
**And** Export completes in <3 seconds for typical datasets (<1000 transactions)
**And** Large datasets (>5000 transactions) show progress indicator
**And** Export uses client-side library (papaparse) for privacy (no server processing)
**And** Success toast: "CSV exported successfully!"
**And** File download triggers browser save dialog

**Prerequisites:** Story 3.1 (transactions exist), Story 7.3 (settings page)

**Technical Notes:**
- Install papaparse: `npm install papaparse`
- Fetch all transactions: `GET /api/transactions?all=true`
- Client-side CSV generation using papaparse:
  ```typescript
  import Papa from 'papaparse';
  const csv = Papa.unparse(transactions);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-${date}.csv`;
  a.click();
  ```
- Column mapping: map transaction fields to CSV headers
- Handle nulls (empty string for optional notes)
- Test with special characters: commas, quotes, newlines

---

### Story 7.2: Export Financial Report to PDF

As a user,
I want to export a monthly financial report as PDF,
So that I can save or print professional-looking summaries.

**Acceptance Criteria:**

**Given** I have transaction data for a month
**When** I click "Export Report (PDF)" and select a month
**Then** A PDF report downloads with summary and charts

**And** Export button labeled "Export Monthly Report (PDF)"
**And** Month selector dropdown (last 12 months available)
**And** PDF filename format: `budget-report-YYYY-MM.pdf`
**And** PDF contents:
  - Header: Smart Budget Application logo + month/year
  - Summary section: Total income, total expenses, net balance
  - Spending by category: table with amounts and percentages
  - Top 5 transactions (highest expenses)
  - Optional: chart images (pie chart, trends)
**And** PDF styled professionally (consistent fonts, spacing, colors)
**And** PDF generation completes in <5 seconds
**And** Export uses client-side library (jsPDF) for privacy
**And** Success toast: "PDF report downloaded!"
**And** File download triggers browser save dialog
**And** Mobile: PDF formatted for A4 paper size, readable on all devices

**Prerequisites:** Story 3.1 (transactions), Story 5.3 (charts), Story 7.3 (settings page)

**Technical Notes:**
- Install jsPDF: `npm install jspdf`
- Optional: `jspdf-autotable` for table formatting
- Fetch month data: `GET /api/transactions?month=YYYY-MM`
- Fetch aggregated stats: `GET /api/dashboard/stats?month=YYYY-MM`
- Client-side PDF generation:
  ```typescript
  import jsPDF from 'jspdf';
  const doc = new jsPDF();
  doc.text('Monthly Budget Report', 10, 10);
  doc.text(`Income: $${income}`, 10, 20);
  // ... add more content
  doc.save(`budget-report-${month}.pdf`);
  ```
- Add tables using jspdf-autotable plugin
- Optional: embed chart images using html2canvas to capture chart as PNG, then add to PDF
- Styling: set fonts, colors, alignment
- Test PDF output on desktop and mobile viewers

---

### Story 7.3: Settings Page and Account Management

As a user,
I want a settings page to manage my account and preferences,
So that I can control my experience and data.

**Acceptance Criteria:**

**Given** I navigate to Settings
**When** I view the settings page
**Then** I see account information and configuration options

**And** Settings page at `/settings` route
**And** Sections:
  1. **Account Information**
     - Display name (editable)
     - Email (read-only, from auth provider)
     - Profile picture (from social login or uploadable)
     - Account created date
  2. **Data Export**
     - Export Transactions (CSV) button
     - Export Monthly Report (PDF) button with month selector
  3. **Privacy & Security**
     - Show data storage location: "Your data is securely stored in the cloud with bank-level encryption"
     - Link to privacy policy (if exists)
     - "Delete my account" button (confirmation required)
  4. **Preferences**
     - Currency format (default: USD)
     - Date format (default: MM/DD/YYYY)
     - Restart onboarding tutorial button
**And** All changes save immediately with optimistic UI
**And** Success toasts for each action
**And** Delete account: requires confirmation modal + password re-entry
**And** Delete account exports all data first, then deletes user record
**And** Mobile responsive: full-width sections, stacked layout

**Prerequisites:** Story 2.3 (user account), Story 7.1 (CSV export), Story 7.2 (PDF export)

**Technical Notes:**
- Create `/app/(dashboard)/settings/page.tsx`
- Use Chakra UI Form components (Input, Button, Switch, Select)
- Update user profile: `PUT /api/user/profile` with `{ displayName, preferences }`
- Store preferences in user metadata or separate preferences table
- Delete account: `DELETE /api/user/account` (requires authentication + confirmation)
- Export data before deletion: trigger CSV export automatically
- Privacy text: clear explanation of Supabase + RLS
- Re-trigger onboarding: reset `onboarding_completed` flag

---

### Story 7.4: Data Sync Status and Multi-Device Information

As a user,
I want to see that my data is syncing across devices,
So that I trust my data is backed up and accessible everywhere.

**Acceptance Criteria:**

**Given** I use the app on multiple devices
**When** I view Settings or Dashboard
**Then** I see sync status and device information

**And** Sync status indicator: "✓ All data synced" (green) or "Syncing..." (yellow)
**And** Last sync timestamp: "Last synced: 2 minutes ago"
**And** Settings page shows list of active devices/sessions (optional):
  - Device name (e.g., "Chrome on Windows", "Safari on iPhone")
  - Last active timestamp
  - Current device highlighted
  - Option to revoke session (logout from device)
**And** Real-time sync indicator: updates when transaction added on other device
**And** Offline indicator: "Offline - Changes will sync when connected" (red)
**And** All data automatically synced via Supabase Realtime (no manual sync needed)
**And** Mobile: sync status in header or settings

**Prerequisites:** Story 3.4 (real-time sync), Story 7.3 (settings page), Story 1.2 (Supabase Realtime)

**Technical Notes:**
- Sync status derived from Supabase connection state
- Use Supabase Realtime `online` event for connection status
- Last sync: timestamp of last database write or Realtime message
- Device list (optional): query Supabase Auth sessions
- Display using Chakra UI Badge, Text
- Revoke session: `supabase.auth.admin.deleteSession(sessionId)` (requires service role)
- Offline detection: `window.navigator.onLine` + Supabase connection state
- Real-time updates via subscription to connection state changes

---

### Story 7.5: Offline Data Caching for Viewing (Phase 1)

As a user,
I want to view my previously loaded transactions and dashboard when offline,
So that I can check my budget even without internet connection.

**Acceptance Criteria:**

**Given** I loaded the dashboard while online
**When** I go offline and refresh the page
**Then** I can still view cached data (read-only)

**And** SWR cache persists data across page refreshes
**And** Dashboard, transactions, categories available offline (if previously loaded)
**And** Charts render from cached data
**And** Offline banner appears: "You're offline. Viewing cached data from [timestamp]"
**And** Add/edit/delete actions disabled offline (buttons grayed out)
**And** Offline indicator in header (red badge or icon)
**And** When connection restored, banner shows: "Back online! Syncing latest data..."
**And** Data automatically refreshes on reconnection
**And** Service Worker caches static assets (HTML, CSS, JS) for offline app shell
**And** Mobile: works as PWA (Add to Home Screen)

**Prerequisites:** Story 5.2 (dashboard), Story 3.2 (transactions), Story 1.1 (Next.js PWA setup)

**Technical Notes:**
- Configure Next.js PWA (next-pwa plugin)
- Create `public/manifest.json` for PWA
- Service Worker caches: app shell (HTML, CSS, JS), fonts, icons
- SWR cache persistence: use `localStorage` or `sessionStorage` for cache
- Offline detection: `useOnlineStatus` custom hook
- Disable mutations offline: check `navigator.onLine` before API calls
- Show offline banner using Chakra UI Alert
- Reconnection: listen to `online` event, trigger SWR revalidation
- Note: This is Phase 1 (read-only offline). Phase 2 will add offline write queue.

---

## FR Coverage Matrix

This matrix ensures every functional requirement is covered by at least one story:

| FR | Description | Epic | Story |
|---|---|---|---|
| **FR1** | Create income transaction records | Epic 3 | Story 3.1 |
| **FR2** | Create expense transaction records | Epic 3 | Story 3.1 |
| **FR3** | View complete transaction history | Epic 3 | Story 3.2 |
| **FR4** | Filter transaction history | Epic 3 | Story 3.2 |
| **FR5** | Search transactions by keyword | Epic 3 | Story 3.2 |
| **FR6** | Edit existing transactions | Epic 3 | Story 3.3 |
| **FR7** | Delete transactions | Epic 3 | Story 3.3 |
| **FR8** | Persist transaction data with no loss | Epic 3 | Story 3.4 |
| **FR9** | Transaction entry defaults to current date | Epic 3 | Story 3.1 |
| **FR10** | Transaction entry under 30 seconds | Epic 3 | Story 3.1 |
| **FR11** | Pre-defined expense categories | Epic 4 | Story 4.1 |
| **FR12** | Pre-defined income categories | Epic 4 | Story 4.1 |
| **FR13** | Create custom categories | Epic 4 | Story 4.2 |
| **FR14** | Edit category names and properties | Epic 4 | Story 4.3 |
| **FR15** | Delete custom categories | Epic 4 | Story 4.3 |
| **FR16** | Categories with color-coding | Epic 4 | Story 4.4 |
| **FR17** | Recently-used categories shown first | Epic 4 | Story 4.5 |
| **FR18** | Dashboard showing financial summary | Epic 5 | Story 5.2 |
| **FR19** | Monthly spending by category visualization | Epic 5 | Story 5.3 |
| **FR20** | Income vs expenses comparison | Epic 5 | Story 5.2 |
| **FR21** | Spending trends over time (line chart) | Epic 5 | Story 5.4 |
| **FR22** | Category breakdown percentage | Epic 5 | Story 5.3 |
| **FR23** | Month-over-month comparison | Epic 5 | Story 5.5 |
| **FR24** | Charts update in real-time | Epic 5 | Story 5.7 |
| **FR25** | Dashboard loads within 2 seconds | Epic 5 | Story 5.7 |
| **FR26** | Charts responsive on mobile and desktop | Epic 5 | Story 5.8 |
| **FR27** | Interactive charts (hover, click drill-down) | Epic 5 | Story 5.6 |
| **FR28** | Accessible data table alternatives | Epic 5 | Story 5.3, 5.4 |
| **FR29** | Analyze spending patterns | Epic 6 | Story 6.1 |
| **FR30** | Generate personalized insights | Epic 6 | Story 6.1 |
| **FR31** | Recommend budget limits | Epic 6 | Story 6.1 |
| **FR32** | Flag unusual expenses | Epic 6 | Story 6.1 |
| **FR33** | Actionable optimization recommendations | Epic 6 | Story 6.1, 6.2 |
| **FR34** | Insights in plain language coaching tone | Epic 6 | Story 6.2 |
| **FR35** | View list of all AI insights | Epic 6 | Story 6.3 |
| **FR36** | Dismiss individual insights | Epic 6 | Story 6.3 |
| **FR37** | Generate 3+ insights per month | Epic 6 | Story 6.1, 6.5 |
| **FR38** | Store data securely in cloud with RLS | Epic 1, 7 | Story 1.2, 7.4 |
| **FR39** | Export transactions to CSV | Epic 7 | Story 7.1 |
| **FR40** | Export reports to PDF | Epic 7 | Story 7.2 |
| **FR41** | Indicate data storage location and protection | Epic 7 | Story 7.3 |
| **FR42** | Data persists and syncs across devices | Epic 3, 7 | Story 3.4, 7.4 |
| **FR43** | Automatic sync across logged-in devices | Epic 7 | Story 7.4 |
| **FR44** | Responsive design (mobile and desktop) | Epic 5 | Story 5.1, 5.8 |
| **FR45** | Clear navigation between sections | Epic 5 | Story 5.1 |
| **FR46** | Visual feedback for user actions | Epic 5 | Story 5.1 |
| **FR47** | Cache data for offline viewing | Epic 7 | Story 7.5 |
| **FR48** | Create accounts with email/social login | Epic 2 | Story 2.1, 2.2 |
| **FR49** | Secure login and logout | Epic 2 | Story 2.3 |
| **FR50** | Password reset via email | Epic 2 | Story 2.4 |
| **FR51** | Secure sessions with timeout | Epic 2 | Story 2.5 |
| **FR52** | Multi-device account access | Epic 2 | Story 2.5, 7.4 |

**Coverage Status: ✅ 100%** - All 52 functional requirements mapped to stories

---

## Summary

### Epic Breakdown Summary

**7 Epics | 42 Stories Total**

**Epic 1: Foundation & Infrastructure** (4 stories)
- Project setup, Supabase configuration, authentication setup, deployment pipeline
- Enables all subsequent development

**Epic 2: User Authentication & Onboarding** (6 stories)
- Complete auth flows (email/password, social login), password reset, session management, onboarding
- Covers FR48-FR52

**Epic 3: Transaction Management** (4 stories)
- Quick transaction entry (<30s), list view with filtering, edit/delete, real-time sync
- Covers FR1-FR10

**Epic 4: Category System** (5 stories)
- Default categories, custom categories, color-coding, recently-used quick access
- Covers FR11-FR17

**Epic 5: Financial Dashboard & Visualizations** (8 stories)
- Dashboard layout, StatCards, pie/donut chart, line chart, comparisons, interactivity, performance, responsive design
- Covers FR18-FR28, FR44-FR46

**Epic 6: AI Budget Insights** (5 stories)
- Rules engine, dashboard display, full insights page, metadata/details, generation scheduling
- Covers FR29-FR37

**Epic 7: Data Export & Settings** (5 stories)
- CSV export, PDF reports, settings page, sync status, offline caching
- Covers FR38-FR43, FR47

### Key Implementation Notes

**Sequencing:**
- Epic 1 MUST be completed first (foundation)
- Epic 2 required before any user-facing features (auth)
- Epics 3-6 can be developed in parallel after Epic 2
- Epic 7 depends on Epics 3-5 (needs data to export)

**Technology Stack (from Architecture):**
- Frontend: Next.js 15+ with App Router
- UI: Chakra UI 2.8+ with Trust Blue theme
- Database: Supabase PostgreSQL with RLS
- Auth: Supabase Auth (email/password + OAuth)
- Charts: Recharts 2.12+
- Forms: React Hook Form + Zod
- State: SWR + React Context
- Deployment: Vercel

**Performance Targets:**
- Dashboard load: <2s
- Transaction save: <200ms (optimistic UI)
- Chart updates: <300ms
- Transaction entry: <30s end-to-end

**Accessibility:**
- WCAG 2.1 Level A minimum (AA aspirations)
- Keyboard navigation for all interactions
- Screen reader support
- 44x44px touch targets on mobile
- Sufficient color contrast (4.5:1 text, 3:1 UI)

### Next Steps in BMad Method

This epic breakdown is the **initial version**. It will be updated as you progress:

1. **✅ UX Design Completed** - Already done! UX interactions and components defined.
   - Update opportunity: Add UX mockup references to story acceptance criteria

2. **✅ Architecture Completed** - Already done! Technology stack and database schema defined.
   - Update opportunity: Add architecture decision references to technical notes

3. **Next: Sprint Planning** - Run `/bmad:bmm:workflows:sprint-planning`
   - Creates sprint tracking file
   - Sequences stories into 5-6 one-week sprints
   - Tracks story status through implementation

4. **Phase 4: Implementation** - Use `/bmad:bmm:workflows:dev-story` for each story
   - Each story pulls context from: PRD (why) + epics.md (what/how) + UX (interactions) + Architecture (technical)

---

**✅ Epic Breakdown Complete!**

**Created:** [docs/epics.md](./epics.md) with 7 epics and 42 detailed stories

**FR Coverage:** 100% - All 52 functional requirements mapped to implementable stories

**Ready for:** Sprint Planning → Implementation

---

_Living Document: This file will be referenced and updated throughout the development lifecycle. Each story provides detailed acceptance criteria following BDD format (Given/When/Then) for autonomous implementation by development agents._

_For implementation: Use the `dev-story` workflow to execute individual stories with full context assembly from PRD, Architecture, UX Design, and this epic breakdown._

