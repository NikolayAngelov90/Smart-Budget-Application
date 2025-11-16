# Epic 2: User Authentication & Onboarding - Technical Context

**Author:** Niki
**Date:** 2025-11-16
**Epic:** [User Authentication & Onboarding](./epics.md#epic-2-user-authentication--onboarding)
**Architecture:** [Technical Architecture](./architecture.md)

---

## 1. Overview

This document provides the technical context and implementation plan for **Epic 2: User Authentication & Onboarding**. This epic establishes the complete user identity lifecycle, from registration and login to session management and the first-time user experience.

The implementation will be based on the project's foundational architecture, which utilizes Next.js with the App Router, Supabase for authentication and database services, and Chakra UI for the user interface.

## 2. Core Technology & File Dependencies

The implementation of this epic will primarily interact with the following technologies and existing files:

- **Authentication Provider:** **Supabase Auth** is the central authority for all authentication operations.
  - **Dependencies:** `@supabase/supabase-js` (v2.81.1), `@supabase/ssr` (v0.7.0)
- **Frontend Framework:** **Next.js 15** (App Router)
- **UI Library:** **Chakra UI 2.8**
- **Form Management:** **React Hook Form** with **Zod** for validation (as per `architecture.md`).
- **TypeScript:** v5.3 with `strict: true`.

### Key Files & Modules for This Epic:

| File/Module | Purpose | Relevance to Epic 2 |
| :--- | :--- | :--- |
| `src/middleware.ts` | **Route Protection:** Intercepts requests to validate sessions and enforce auth rules. | Core of the security model. It redirects unauthenticated users from `/dashboard` and authenticated users from `/login` or `/signup`. |
| `src/lib/supabase/client.ts` | **Browser Supabase Client:** Used in Client Components for auth actions like login, signup, and logout. | Will be used in all auth-related UI components. |
| `src/lib/supabase/server.ts` | **Server Supabase Client:** Used in Server Components and API Routes to access user sessions. | Essential for server-side session checks and handling the OAuth callback. |
| `src/app/auth/callback/route.ts` | **OAuth Callback Handler:** Exchanges the OAuth code for a user session. | Critical for completing the Google and GitHub social login flows (Story 2.2). |
| `supabase/migrations/001_initial_schema.sql` | **Database Schema:** Defines the `users` table (via `auth.users`) and RLS policies. | All user data is secured by RLS policies that rely on `auth.uid()`. |
| `docs/AUTH_SETUP_GUIDE.md` | **Configuration Guide:** Provides manual steps for setting up OAuth providers in Supabase. | A prerequisite for implementing social login (Story 2.2). |
| `.env.local` | **Environment Variables:** Contains the Supabase URL and anon key. | The connection to the Supabase backend depends entirely on these variables being correctly configured. |

## 3. Data Model

This epic primarily interacts with the `auth.users` table, which is managed by Supabase Auth. Additionally, a mechanism to track the completion of the onboarding flow (Story 2.6) is required.

- **`auth.users`**: This table stores the core user identity, including `id` (UUID), `email`, `encrypted_password`, and metadata from social providers. All other user-specific tables (`transactions`, `categories`, etc.) have a foreign key relationship to `auth.users.id`.
- **Onboarding Status**: The `epics.md` file suggests storing an `onboarding_completed` flag. This can be implemented in one of two ways:
    1.  **`raw_user_meta_data` in `auth.users`**: A JSONB column where we can store `{ "onboarding_completed": true }`. This is the simplest approach.
    2.  **A separate `profiles` table**: A `profiles` table with a one-to-one relationship with `auth.users` could hold this flag and other user preferences. For the scope of this epic, using the metadata field is sufficient.

**Decision:** We will use the `raw_user_meta_data` field on the `auth.users` object to store the onboarding status.

## 4. Implementation Plan by Story

### Story 2.1: User Registration with Email/Password

- **File:** `src/app/(auth)/signup/page.tsx`
- **Logic:**
    1.  Build a client component form using Chakra UI components (`<Input>`, `<Button>`, etc.).
    2.  Use `react-hook-form` and a `zod` schema to manage form state and validation (password strength, email format).
    3.  On submit, call the `supabase.auth.signUp()` method from the browser client (`@/lib/supabase/client.ts`).
    4.  Handle success by showing a message prompting the user to check their email.
    5.  Handle errors, such as "User already registered", and display them using `<FormErrorMessage>`.

### Story 2.2: Social Login (Google and GitHub)

- **Files:** `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/auth/callback/route.ts`
- **Logic:**
    1.  Add "Continue with Google" and "Continue with GitHub" buttons to the login and signup pages.
    2.  The `onClick` handler for these buttons will call `supabase.auth.signInWithOAuth({ provider: 'google' | 'github' })`.
    3.  This will redirect the user to the respective provider for authorization.
    4.  After authorization, the provider redirects back to the pre-configured callback URL: `/auth/callback`.
    5.  The `route.ts` file at this path will handle the server-side exchange of the authorization code for a session, using the server client (`@/lib/supabase/server.ts`). Supabase's SSR helpers manage this flow automatically.
    6.  Upon successful session creation, the route will redirect the user to the dashboard (`/`).

### Story 2.3: Login with Email/Password

- **File:** `src/app/(auth)/login/page.tsx`
- **Logic:**
    1.  Similar to the signup form, build a client component form with `react-hook-form` and `zod`.
    2.  On submit, call `supabase.auth.signInWithPassword()` with the user's credentials.
    3.  The `middleware.ts` will automatically handle redirecting the user to the dashboard upon successful login.
    4.  Display an error message for invalid credentials.

### Story 2.4: Password Reset Flow

- **Files:** `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx`
- **Logic:**
    1.  **Forgot Password Page**: A simple form with an email input. On submit, it calls `supabase.auth.resetPasswordForEmail()`, which sends a magic link to the user.
    2.  **Reset Password Page**: This page will be accessed via the magic link. The Supabase client will automatically handle the token from the URL. The form will take a new password, and on submit, it will call `supabase.auth.updateUser()` to set the new password.

### Story 2.5: Session Management and Auto-Logout

- **Primary Handler:** `src/middleware.ts` and the `@supabase/ssr` library.
- **Logic:**
    1.  The Supabase SSR library automatically refreshes the JWT token (access token) as long as the refresh token is valid.
    2.  Session expiry is configured in the Supabase dashboard (defaults to 1 hour for access token, 30 days for refresh token).
    3.  The `middleware.ts` ensures that every request to a protected route has a valid session.
    4.  **Inactivity Logout (UI Task)**: An inactivity listener can be implemented in the root layout (`src/app/(dashboard)/layout.tsx`) using a custom hook that tracks user events (mousemove, keydown) and shows a warning modal before calling `supabase.auth.signOut()`.

### Story 2.6: First-Time User Onboarding

- **File:** `src/app/(dashboard)/layout.tsx` or a component within it.
- **Logic:**
    1.  After a user logs in, fetch the user's data, including `raw_user_meta_data`.
    2.  Check for the `onboarding_completed` flag.
    3.  If the flag is not present or is `false`, display a multi-step onboarding modal (using Chakra UI's `<Modal>`).
    4.  When the user completes or skips the onboarding, call a server action or API route to update the user's metadata: `supabase.auth.updateUser({ data: { onboarding_completed: true } })`.

## 5. Security Considerations

- **Row Level Security (RLS):** RLS is the cornerstone of the application's data security. It is already configured in the initial migration and ensures that all data queries are automatically scoped to the authenticated user (`auth.uid()`).
- **`httpOnly` Cookies:** The `@supabase/ssr` package is configured to use `httpOnly` cookies for storing session tokens, which prevents access from client-side JavaScript and mitigates XSS attacks.
- **Environment Variables:** Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are exposed to the client. This is secure by design, as RLS policies on the database prevent unauthorized data access. The `SUPABASE_SERVICE_ROLE_KEY` must **never** be exposed to the client.
- **Input Validation:** All user input will be validated using `zod` schemas on the client side before being sent to Supabase, preventing malformed data.

## 6. Testing Strategy

- **Unit/Integration Tests:**
    - Test form validation logic for signup and login forms.
    - Mock Supabase client calls to test different authentication responses (success, error, user exists).
    - Test the logic of the inactivity hook for auto-logout.
- **End-to-End (E2E) Tests:**
    - A full user journey: signup -> email confirmation -> login -> logout.
    - Test social login flow with Google and GitHub.
    - Test route protection: verify that unauthenticated users are redirected from `/dashboard`.
    - Test password reset flow.
    - Verify that the onboarding modal appears for new users and not for existing users.
