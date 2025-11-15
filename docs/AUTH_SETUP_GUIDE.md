# Authentication Setup Guide (Story 1.3)

This guide walks you through the manual configuration steps required to complete Story 1.3: Authentication Configuration and Middleware.

**Prerequisites:**
- Supabase project created and running (Story 1.2 completed)
- `.env.local` file configured with Supabase credentials
- Google Cloud Console account (for Google OAuth)
- GitHub account (for GitHub OAuth)

---

## Task 1: Enable Email/Password Authentication

### Step 1.1: Navigate to Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your Smart Budget project
3. Navigate to **Authentication** → **Providers** in the left sidebar

### Step 1.2: Enable Email Provider
1. Find **Email** in the list of providers
2. Click to expand the Email provider section
3. Toggle **Enable Email provider** to ON
4. Click **Save**

### Step 1.3: Configure Email Templates (Optional)
1. Navigate to **Authentication** → **Email Templates**
2. Review the default templates:
   - **Confirm signup** - Sent when user signs up
   - **Magic Link** - Sent for passwordless login (if enabled)
   - **Reset password** - Sent when user requests password reset
3. Customize templates if desired (recommended to use defaults for now)

### Step 1.4: Configure Password Requirements
1. Navigate to **Authentication** → **Policies**
2. Review password requirements (default: minimum 6 characters)
3. Optional: Adjust minimum password length if desired
4. Click **Save** if changes were made

### Step 1.5: Test Email Signup Flow
1. Open Supabase dashboard → **Authentication** → **Users**
2. Click **Add User** → **Create new user**
3. Enter test email and password
4. Click **Create user**
5. Verify user appears in the users table
6. Delete test user (click ⋮ menu → Delete user)

**✅ Task 1 Complete:** Email/password authentication is enabled and functional

---

## Task 2: Configure Google OAuth Provider

### Step 2.1: Create OAuth 2.0 Client in Google Cloud Console
1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project or select existing project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. If prompted, configure OAuth consent screen:
   - User Type: **External**
   - App name: **Smart Budget**
   - User support email: your email
   - Developer contact: your email
   - Click **Save and Continue**
   - Scopes: Skip for now (click **Save and Continue**)
   - Test users: Add your email (click **Add Users**)
   - Click **Save and Continue**

### Step 2.2: Create OAuth Client ID
1. Back in Credentials, click **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Name: **Smart Budget Web App**
4. **Authorized JavaScript origins:**
   - `http://localhost:3001`
   - Your production URL (if deploying)
5. **Authorized redirect URIs:**
   - Get your Supabase project URL from dashboard (e.g., `https://xxxxx.supabase.co`)
   - Add: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
   - Add: `http://localhost:3001/auth/callback` (for testing)
6. Click **Create**
7. **IMPORTANT:** Copy the **Client ID** and **Client Secret** (you'll need these next)

### Step 2.3: Configure Google Provider in Supabase
1. Open Supabase dashboard → **Authentication** → **Providers**
2. Find **Google** in the list
3. Toggle **Enable Google provider** to ON
4. Paste **Client ID** from Google Cloud Console
5. Paste **Client Secret** from Google Cloud Console
6. Click **Save**

### Step 2.4: Test Google OAuth Flow
1. Start your Next.js dev server: `npm run dev`
2. Navigate to `http://localhost:3001/login`
3. Open browser console for debugging
4. Test will be completed in Task 8 when we add OAuth buttons

**✅ Task 2 Complete:** Google OAuth is configured

---

## Task 3: Configure GitHub OAuth Provider

### Step 3.1: Create OAuth App in GitHub
1. Go to [https://github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App** (or **OAuth Apps** → **New OAuth App**)
3. Fill in the form:
   - **Application name:** Smart Budget
   - **Homepage URL:** `http://localhost:3001` (or your production URL)
   - **Application description:** Smart Budget - Personal Finance Tracker (optional)
   - **Authorization callback URL:**
     - Get your Supabase project URL from dashboard
     - Format: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     - Example: `https://abcdefgh.supabase.co/auth/v1/callback`
4. Click **Register application**
5. **IMPORTANT:** Copy the **Client ID** (shown immediately)
6. Click **Generate a new client secret**
7. **IMPORTANT:** Copy the **Client Secret** (only shown once)

### Step 3.2: Configure GitHub Provider in Supabase
1. Open Supabase dashboard → **Authentication** → **Providers**
2. Find **GitHub** in the list
3. Toggle **Enable GitHub provider** to ON
4. Paste **Client ID** from GitHub OAuth App
5. Paste **Client Secret** from GitHub OAuth App
6. Click **Save**

### Step 3.3: Test GitHub OAuth Flow
1. Ensure dev server is running: `npm run dev`
2. Navigate to `http://localhost:3001/login`
3. Test will be completed in Task 8 when we add OAuth buttons

**✅ Task 3 Complete:** GitHub OAuth is configured

---

## Task 6: Configure Session Management Settings

### Step 6.1: Configure JWT Settings
1. Open Supabase dashboard → **Authentication** → **Settings**
2. Scroll to **JWT Settings** section
3. Verify/Configure:
   - **JWT expiry:** `3600` seconds (1 hour)
   - This controls how long an access token is valid
4. Click **Save** if changes were made

### Step 6.2: Configure Session Timeout Settings
1. In the same **Settings** page, find **Session Settings**
2. Configure refresh token expiry:
   - **Default:** `2592000` seconds (30 days) - for "remember me" flow
   - **Shorter session:** `86400` seconds (24 hours) - for standard login
3. Note: The app will use 30-day sessions by default
4. Click **Save** if changes were made

### Step 6.3: Verify Session Storage
1. Sessions are stored in httpOnly cookies by default ✅
2. This is handled automatically by Supabase SSR library
3. No additional configuration needed

**✅ Task 6 Complete:** Session management is configured

---

## Task 8: Manual Testing Checklist

Once Epic 2 login/signup UI is implemented, complete these tests:

### Email/Password Testing
- [ ] Sign up with new email → Verify email sent (check Supabase inbox or email)
- [ ] Confirm email → Verify user can log in
- [ ] Log in with valid credentials → Verify redirect to /dashboard
- [ ] Log in with invalid credentials → Verify error message shown
- [ ] Log out → Verify redirect to /login and session cleared

### OAuth Testing
- [ ] Click "Sign in with Google" → Verify redirect to Google
- [ ] Authorize with Google → Verify redirect to /dashboard
- [ ] Verify user created in Supabase users table
- [ ] Click "Sign in with GitHub" → Verify redirect to GitHub
- [ ] Authorize with GitHub → Verify redirect to /dashboard
- [ ] Verify user created in Supabase users table

### Middleware & Route Protection Testing
- [ ] While logged out, visit `/dashboard` → Verify redirect to /login
- [ ] Log in → Verify redirect to /dashboard
- [ ] While logged in, visit `/login` → Verify redirect to /dashboard
- [ ] While logged in, refresh page → Verify still logged in (session persists)

### Session Persistence Testing
- [ ] Log in → Close browser → Reopen → Verify still logged in (30-day session)
- [ ] Log in → Wait 1 hour → Refresh → Verify token refreshed automatically
- [ ] Log in → Clear cookies → Refresh → Verify redirect to login

### Session Timeout Testing (Optional - takes time)
- [ ] Log in → Wait 30 days → Verify redirect to login (session expired)
- [ ] Modify JWT expiry to 60 seconds for quick test
- [ ] Log in → Wait 60 seconds → Verify token refresh works
- [ ] Restore JWT expiry to 3600 seconds

---

## Verification Steps

### After completing Tasks 1-3, 6:
1. ✅ Email provider enabled in Supabase
2. ✅ Google OAuth client created and configured
3. ✅ GitHub OAuth app created and configured
4. ✅ JWT expiry set to 3600 seconds
5. ✅ Refresh token expiry set to 2592000 seconds (30 days)

### After code implementation (Tasks 4, 5, 7):
1. ✅ Middleware file exists: `src/middleware.ts`
2. ✅ OAuth callback route exists: `src/app/auth/callback/route.ts`
3. ✅ Login page exists: `src/app/(auth)/login/page.tsx`
4. ✅ Signup page exists: `src/app/(auth)/signup/page.tsx`
5. ✅ Auth utilities exist: `src/lib/auth/client.ts`, `src/lib/auth/server.ts`

### After quality checks (Task 9):
1. ✅ `npm run type-check` passes
2. ✅ `npm run lint` passes
3. ✅ `npm run build` succeeds

---

## Troubleshooting

### Google OAuth redirect URI mismatch
- **Error:** "redirect_uri_mismatch"
- **Fix:** Ensure authorized redirect URI in Google Cloud Console exactly matches: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`

### GitHub OAuth redirect URI mismatch
- **Error:** "The redirect_uri MUST match the registered callback URL"
- **Fix:** Ensure callback URL in GitHub OAuth App exactly matches: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`

### Email not sending
- **Issue:** Test signup doesn't receive email
- **Fix:** Check Supabase → **Authentication** → **Settings** → **SMTP Settings**. For development, Supabase provides default email service. For production, configure custom SMTP.

### Session not persisting
- **Issue:** Logged in but session lost on refresh
- **Fix:**
  - Verify middleware is running (check browser Network tab for middleware execution)
  - Check browser cookies - should see `sb-*-auth-token` cookie
  - Verify `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Next Steps

After completing this manual setup:

1. Run quality checks: `npm run type-check && npm run lint && npm run build`
2. Mark Story 1.3 tasks as complete in story file
3. Proceed to Epic 2 for full authentication UI implementation:
   - Story 2.1: User Registration with Email/Password
   - Story 2.2: Social Login (Google and GitHub)
   - Story 2.3: Login with Email/Password
   - Story 2.4: Password Reset Flow

---

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side-rendering)
- [Google OAuth 2.0 Setup](https://support.google.com/cloud/answer/6158849)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
