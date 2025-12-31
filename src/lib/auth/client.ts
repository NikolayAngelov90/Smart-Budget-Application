/**
 * Client-Side Authentication Utilities
 * Story 1.3: Authentication Configuration and Middleware
 *
 * These utilities are used in Client Components for authentication actions.
 * They provide convenient wrappers around Supabase Auth for common client-side auth operations.
 */

'use client';

import { createClient } from '@/lib/supabase/client';
import type { AuthResponse, Provider } from '@supabase/supabase-js';
import { clearOfflineCache } from '@/lib/services/offlineService';

/**
 * Sign in with email and password
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise resolving to AuthResponse with session data
 *
 * @example
 * ```typescript
 * import { signIn } from '@/lib/auth/client';
 *
 * async function handleLogin(email: string, password: string) {
 *   const { data, error } = await signIn(email, password);
 *   if (error) {
 *     console.error('Login failed:', error.message);
 *     return;
 *   }
 *   // Redirect to dashboard
 *   router.push('/dashboard');
 * }
 * ```
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Sign up with email and password
 *
 * @param email - User's email address
 * @param password - User's password (min 6 characters)
 * @returns Promise resolving to AuthResponse with session data
 *
 * @example
 * ```typescript
 * import { signUp } from '@/lib/auth/client';
 *
 * async function handleSignup(email: string, password: string) {
 *   const { data, error } = await signUp(email, password);
 *   if (error) {
 *     console.error('Signup failed:', error.message);
 *     return;
 *   }
 *   // Show email verification message
 *   showMessage('Check your email to verify your account');
 * }
 * ```
 */
export async function signUp(
  email: string,
  password: string
): Promise<AuthResponse> {
  const supabase = createClient();
  return supabase.auth.signUp({ email, password });
}

/**
 * Sign in with OAuth provider (Google, GitHub, etc.)
 * Redirects to provider's authorization page
 *
 * @param provider - OAuth provider name ('google', 'github', etc.)
 * @param redirectTo - Optional URL to redirect to after authentication (default: /auth/callback)
 *
 * @example
 * ```typescript
 * import { signInWithOAuth } from '@/lib/auth/client';
 *
 * function LoginButton() {
 *   const handleGoogleLogin = () => {
 *     signInWithOAuth('google');
 *   };
 *
 *   return <button onClick={handleGoogleLogin}>Sign in with Google</button>;
 * }
 * ```
 */
export async function signInWithOAuth(
  provider: Provider,
  redirectTo?: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo ?? `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error(`OAuth sign-in failed for ${provider}:`, error.message);
    throw error;
  }
}

/**
 * Sign out the current user
 * Clears session, offline cache, and redirects to login page
 *
 * Story 8.5 AC-8.5.6: Clear SWR cache on logout to prevent data leakage on shared devices
 *
 * @example
 * ```typescript
 * import { signOut } from '@/lib/auth/client';
 *
 * function LogoutButton() {
 *   const handleLogout = async () => {
 *     await signOut();
 *     router.push('/login');
 *   };
 *
 *   return <button onClick={handleLogout}>Sign out</button>;
 * }
 * ```
 */
export async function signOut(): Promise<void> {
  // Story 8.5: Clear offline cache before signing out
  // Prevents data leakage on shared devices
  clearOfflineCache();

  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Sign out failed:', error.message);
    throw error;
  }
}

/**
 * Get the current session from client-side
 * Useful for checking auth state in Client Components
 *
 * @returns Promise resolving to session object or null
 *
 * @example
 * ```typescript
 * import { getSession } from '@/lib/auth/client';
 *
 * function useAuth() {
 *   const [session, setSession] = useState(null);
 *
 *   useEffect(() => {
 *     getSession().then((session) => setSession(session));
 *   }, []);
 *
 *   return session;
 * }
 * ```
 */
export async function getSession() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Listen to auth state changes
 * Sets up a listener for authentication events (sign in, sign out, token refresh)
 *
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function to clean up the listener
 *
 * @example
 * ```typescript
 * import { onAuthStateChange } from '@/lib/auth/client';
 *
 * function AuthProvider({ children }) {
 *   useEffect(() => {
 *     const unsubscribe = onAuthStateChange((event, session) => {
 *       if (event === 'SIGNED_IN') {
 *         console.log('User signed in:', session?.user.email);
 *       }
 *       if (event === 'SIGNED_OUT') {
 *         console.log('User signed out');
 *       }
 *     });
 *
 *     return () => unsubscribe();
 *   }, []);
 *
 *   return <>{children}</>;
 * }
 * ```
 */
export function onAuthStateChange(
  callback: (
    event: string,
    session: Awaited<ReturnType<typeof getSession>>
  ) => void
) {
  const supabase = createClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
