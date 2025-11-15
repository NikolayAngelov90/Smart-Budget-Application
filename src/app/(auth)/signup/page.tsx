/**
 * Signup Page (Placeholder)
 * Story 1.3: Authentication Configuration and Middleware
 *
 * This is a placeholder page for authentication infrastructure testing.
 * Full signup UI will be implemented in Epic 2 (Story 2.1: User Registration).
 *
 * Current Purpose:
 * - Provides signup route structure
 * - Allows manual testing of authentication middleware
 * - Serves as foundation for Epic 2 implementation
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sign Up - Smart Budget',
  description: 'Create your Smart Budget account',
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Placeholder - Signup UI will be implemented in Epic 2
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
              <li>Signup route is accessible to unauthenticated users</li>
              <li>Authenticated users are redirected to dashboard</li>
              <li>Route structure is ready for Epic 2 implementation</li>
            </ul>
            <p className="mt-4 text-sm text-gray-500">
              Full signup functionality including email/password registration,
              social login options, and email verification will be implemented
              in Epic 2 Stories 2.1 and 2.2.
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
              Story 2.6: First-time User Onboarding
            </p>
          </div>

          <div className="pt-4 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
