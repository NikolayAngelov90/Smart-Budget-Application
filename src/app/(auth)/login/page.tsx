/**
 * Login Page (Placeholder)
 * Story 1.3: Authentication Configuration and Middleware
 *
 * This is a placeholder page for authentication infrastructure testing.
 * Full login UI will be implemented in Epic 2 (Story 2.3: Login with Email/Password).
 *
 * Current Purpose:
 * - Serves as redirect target for unauthenticated users
 * - Allows manual testing of authentication middleware
 * - Provides basic structure for Epic 2 implementation
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - Smart Budget',
  description: 'Sign in to your Smart Budget account',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to Smart Budget
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Placeholder - Login UI will be implemented in Epic 2
          </p>
        </div>

        <div className="mt-8 space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              <strong>Story 1.3:</strong> Authentication Configuration and
              Middleware
            </p>
            <p className="text-sm text-gray-600">
              This placeholder demonstrates that:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
              <li>Middleware redirects unauthenticated users here</li>
              <li>Route protection is working correctly</li>
              <li>OAuth callbacks can redirect back here on error</li>
            </ul>
            <p className="mt-4 text-sm text-gray-500">
              Full login functionality including email/password and social login
              buttons will be implemented in Epic 2 Stories 2.2 and 2.3.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500">
              <strong>Next Steps (Epic 2):</strong>
              <br />
              Story 2.1: User Registration with Email/Password
              <br />
              Story 2.2: Social Login (Google and GitHub)
              <br />
              Story 2.3: Login with Email/Password
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
