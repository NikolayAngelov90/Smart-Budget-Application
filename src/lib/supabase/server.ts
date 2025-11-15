/**
 * Supabase Server Client
 * Story 1.2: Supabase Project Setup and Database Schema
 *
 * This client is used for server-side operations (Server Components, API routes).
 * It handles cookies properly for Next.js server environments.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

/**
 * Creates a Supabase client for use in server components and API routes
 *
 * This client properly handles cookies in Next.js 15+ server environment,
 * ensuring authentication state is maintained across requests.
 *
 * @returns Promise resolving to Supabase client instance with type-safe database schema
 *
 * @example
 * ```typescript
 * // In a server component
 * import { createClient } from '@/lib/supabase/server';
 *
 * export default async function Page() {
 *   const supabase = await createClient();
 *   const { data } = await supabase.from('transactions').select('*');
 *   return <div>{JSON.stringify(data)}</div>;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In an API route
 * import { createClient } from '@/lib/supabase/server';
 *
 * export async function GET(request: Request) {
 *   const supabase = await createClient();
 *   const { data, error } = await supabase.from('categories').select('*');
 *   return Response.json({ data });
 * }
 * ```
 */
export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Handle cookie setting errors in server environment
            // This can happen in Server Components during render
          }
        },
      },
    }
  );
};
