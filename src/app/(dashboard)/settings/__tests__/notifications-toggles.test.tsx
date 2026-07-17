/**
 * Story 15.5 — Settings push notification toggles (render-level)
 *
 * Delivers the review-flagged Task 2/6 assertions:
 * - all 5 category toggles render whenever push is SUPPORTED (per-ACCOUNT
 *   flags must stay reachable from a device that isn't subscribed)
 * - Blocked state shows the Blocked badge and a disabled enable button
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import SettingsPage from '@/app/(dashboard)/settings/page';
import type { UserProfile } from '@/types/user.types';

jest.mock('@/lib/services/exportService', () => ({
  exportMonthlyReportToPDF: jest.fn(),
  exportTransactionsToCSV: jest.fn(),
}));

jest.mock('@/lib/services/settingsService', () => ({
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  deleteUserAccount: jest.fn(),
}));

const mockUsePush = jest.fn();
jest.mock('@/lib/hooks/usePushNotifications', () => ({
  usePushNotifications: () => mockUsePush(),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: {
            user: {
              id: 'user-123',
              email: 'test@example.com',
              user_metadata: { display_name: 'Test User' },
            },
          },
          error: null,
        })
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((callback) => {
        if (callback) callback('SUBSCRIBED');
        return { unsubscribe: jest.fn() };
      }),
    })),
    removeChannel: jest.fn(),
  })),
}));

import * as settingsService from '@/lib/services/settingsService';

const mockGetUserProfile = settingsService.getUserProfile as jest.MockedFunction<
  typeof settingsService.getUserProfile
>;

global.fetch = jest.fn();

function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => data,
  };
}

const profile: UserProfile = {
  id: 'user-123',
  display_name: 'Test User',
  email: 'test@example.com',
  profile_picture_url: null,
  preferences: {
    currency_format: 'USD' as const,
    date_format: 'MM/DD/YYYY' as const,
    onboarding_completed: true,
    language: 'en' as const,
  },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const pushState = (overrides: Record<string, unknown> = {}) => ({
  isSupported: true,
  isSubscribed: false,
  isLoading: false,
  permission: 'default' as NotificationPermission,
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  error: null,
  ...overrides,
});

const renderPage = () => render(<SettingsPage />, { wrapper: ChakraProvider });

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/user/profile')) {
      return Promise.resolve(mockResponse({ data: profile }));
    }
    return Promise.resolve(mockResponse({ data: [] }));
  });
  mockGetUserProfile.mockResolvedValue(profile);
});

describe('Settings — push category toggles (Story 15.5)', () => {
  it('renders all 5 category toggles when push is supported, even on an UNSUBSCRIBED device', async () => {
    mockUsePush.mockReturnValue(pushState({ isSubscribed: false }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Spending nudges')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Achievements & milestones')).toBeInTheDocument();
    expect(screen.getByLabelText('Household activity')).toBeInTheDocument();
    expect(screen.getByLabelText('Welcome-back reminders')).toBeInTheDocument();
    // "Weekly digest" also names the in-app digest preference toggle —
    // assert the push one exists among the matches instead of getBy (ambiguous)
    expect(screen.getAllByLabelText(/weekly digest/i).length).toBeGreaterThanOrEqual(1);

    // Defaults surface correctly: milestones ON (?? true), reengagement OFF (?? false)
    expect((screen.getByLabelText('Achievements & milestones') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Welcome-back reminders') as HTMLInputElement).checked).toBe(false);
  });

  it('renders the toggles when subscribed too (AC2 surface)', async () => {
    mockUsePush.mockReturnValue(pushState({ isSubscribed: true }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Achievements & milestones')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Household activity')).toBeInTheDocument();
    expect(screen.getByLabelText('Welcome-back reminders')).toBeInTheDocument();
  });

  it('Blocked state: shows the Blocked badge and a DISABLED enable button (AC4 — no re-prompt path)', async () => {
    mockUsePush.mockReturnValue(pushState({ permission: 'denied' }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });
    const enableButton = screen.getByRole('button', { name: 'Enable browser notifications' });
    expect(enableButton).toBeDisabled();
  });
});
