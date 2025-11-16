/**
 * Next.js Middleware for Authentication and Route Protection
 * Story 1.3: Authentication Configuration and Middleware
 *
 * This middleware runs on Edge Runtime before each request.
 * It validates user sessions and protects routes that require authentication.
 *
 * Protected Routes:
 * - /dashboard/* - Main application dashboard and features
 * - /api/* - API endpoints (excluding auth callbacks)
 *
 * Public Routes:
 * - /login, /signup - Authentication pages
 * - /auth/* - OAuth callbacks and auth utilities
 * - / - Public landing/home page
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware function that runs before each request
 * Validates authentication state and enforces route access rules
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create Supabase client for middleware with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - required for server-side auth
  // This validates the JWT token and refreshes it if needed
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = request.nextUrl.clone();
  const isProtectedRoute =
    url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/api');
  const isAuthRoute = url.pathname === '/login' || url.pathname === '/signup';

  // Rule 1: Redirect unauthenticated users from protected routes to login
  if (!session && isProtectedRoute) {
    url.pathname = '/login';
    // Preserve the original URL to redirect back after login
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Rule 2: Redirect authenticated users from auth pages to home
  // TODO: Change to /dashboard when dashboard is implemented in Epic 5
  if (session && isAuthRoute) {
    url.pathname = '/';
    url.searchParams.delete('redirect'); // Clear any redirect params
    return NextResponse.redirect(url);
  }

  // Rule 3: Allow request to continue with refreshed session cookies
  return supabaseResponse;
}

/**
 * Matcher configuration to specify which routes this middleware applies to
 * This runs on all routes except static files and Next.js internals
 *
 * Protected routes: /dashboard/*, /api/*
 * Auth routes: /login, /signup (for redirect logic)
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
