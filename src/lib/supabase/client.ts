/**
 * Supabase Browser Client
 * Story 1.2: Supabase Project Setup and Database Schema
 *
 * This client is used for client-side operations (browser/React components).
 * It automatically handles authentication state and cookies.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

/**
 * Creates a Supabase client for use in browser/client components
 *
 * @returns Supabase client instance with type-safe database schema
 *
 * @example
 * ```typescript
 * // In a client component
 * const supabase = createClient();
 * const { data, error } = await supabase.from('categories').select('*');
 * ```
 */
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
};
