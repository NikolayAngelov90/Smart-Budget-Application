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
