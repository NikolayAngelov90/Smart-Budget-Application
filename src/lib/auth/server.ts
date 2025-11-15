/**
 * Server-Side Authentication Utilities
 * Story 1.3: Authentication Configuration and Middleware
 *
 * These utilities are used in Server Components, Server Actions, and API Routes.
 * They provide convenient wrappers around Supabase Auth for common server-side auth operations.
 */

import { createClient } from '@/lib/supabase/server';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Get the current user session from server-side context
 *
 * @returns Promise resolving to Session object if authenticated, null otherwise
 *
 * @example
 * ```typescript
 * // In a Server Component
 * import { getSession } from '@/lib/auth/server';
 *
 * export default async function Page() {
 *   const session = await getSession();
 *   if (!session) {
 *     redirect('/login');
 *   }
 *   return <div>Welcome {session.user.email}</div>;
 * }
 * ```
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current authenticated user
 *
 * @returns Promise resolving to User object if authenticated, null otherwise
 *
 * @example
 * ```typescript
 * import { getUser } from '@/lib/auth/server';
 *
 * export default async function ProfilePage() {
 *   const user = await getUser();
 *   if (!user) {
 *     redirect('/login');
 *   }
 *   return <div>User ID: {user.id}</div>;
 * }
 * ```
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Require authentication - throws error if user is not authenticated
 * Use this in Server Actions or API routes that must be authenticated
 *
 * @returns Promise resolving to Session object
 * @throws Error if user is not authenticated
 *
 * @example
 * ```typescript
 * // In a Server Action
 * import { requireAuth } from '@/lib/auth/server';
 *
 * export async function createTransaction(formData: FormData) {
 *   const session = await requireAuth();
 *   // Now we know user is authenticated
 *   const userId = session.user.id;
 *   // ... perform database operations
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In an API route
 * import { requireAuth } from '@/lib/auth/server';
 *
 * export async function POST(request: Request) {
 *   try {
 *     const session = await requireAuth();
 *     // ... handle authenticated request
 *   } catch (error) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 * }
 * ```
 */
export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: Authentication required');
  }
  return session;
}

/**
 * Get the authenticated user's ID
 * Convenience wrapper for getting just the user ID
 *
 * @returns Promise resolving to user ID string if authenticated, null otherwise
 *
 * @example
 * ```typescript
 * import { getUserId } from '@/lib/auth/server';
 *
 * export async function GET() {
 *   const userId = await getUserId();
 *   if (!userId) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // ... fetch user-specific data
 * }
 * ```
 */
export async function getUserId(): Promise<string | null> {
  const user = await getUser();
  return user?.id ?? null;
}
