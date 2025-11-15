/**
 * Authentication Utilities - Barrel Export
 * Story 1.3: Authentication Configuration and Middleware
 *
 * This file exports all authentication utilities for convenient imports.
 * Use server utilities in Server Components/Actions, client utilities in Client Components.
 */

// Server-side utilities (use in Server Components, API routes, Server Actions)
export {
  getSession as getServerSession,
  getUser as getServerUser,
  getUserId,
  requireAuth,
} from './server';

// Client-side utilities (use in Client Components)
export {
  getSession as getClientSession,
  onAuthStateChange,
  signIn,
  signInWithOAuth,
  signOut,
  signUp,
} from './client';
