/**
 * Settings — preference save/rollback. Story 16.8 review.
 *
 * Preference controls used to read `useState` values kept in sync with the
 * profile by an effect. That mirror had two failure modes, both invisible to
 * the suite:
 *
 *   1. It lagged the profile by one render — the render on which the loading
 *      gate first opens. Anything reading a preference on that frame saw the
 *      hardcoded default instead of the user's saved value.
 *   2. It was never rolled back. `updatePreference` reverts `profile` when the
 *      PUT fails, but the mirrored copy kept the value that failed to save, so
 *      the control went on displaying a setting the server had rejected.
 *
 * The values are derived from the profile now. These tests pin both.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import PreferencesPage from '@/app/(dashboard)/settings/preferences/page';
import type { UserProfile } from '@/types/user.types';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockLink = ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const jsonHeaders = {
  get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
};

const profile: UserProfile = {
  id: 'user-123',
  display_name: 'Test User',
  email: 'test@example.com',
  profile_picture_url: null,
  preferences: {
    currency_format: 'GBP' as const,
    date_format: 'YYYY-MM-DD' as const,
    onboarding_completed: true,
    language: 'en' as const,
  },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

global.fetch = jest.fn();

const mockFetch = ({ putOk }: { putOk: boolean }) => {
  (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === 'string' && url.includes('/api/user/profile')) {
      if (init?.method === 'PUT') {
        return Promise.resolve({
          ok: putOk,
          status: putOk ? 200 : 500,
          headers: jsonHeaders,
          json: async () => (putOk ? { data: profile } : {}),
        });
      }
      return Promise.resolve({ ok: true, status: 200, headers: jsonHeaders, json: async () => ({ data: profile }) });
    }
    return Promise.resolve({ ok: true, status: 200, headers: jsonHeaders, json: async () => ({ data: null }) });
  });
};

const currencySelect = () => screen.getByDisplayValue(/GBP|USD/) as HTMLSelectElement;

beforeEach(() => jest.clearAllMocks());

describe('Preferences save', () => {
  it("shows the user's saved values, never the hardcoded defaults", async () => {
    mockFetch({ putOk: true });
    render(<PreferencesPage />, { wrapper: ChakraProvider });

    // GBP / YYYY-MM-DD are the profile's; EUR / MM/DD/YYYY are the fallbacks.
    await waitFor(() => expect(screen.getByDisplayValue(/GBP/)).toBeInTheDocument());
    expect(screen.getByDisplayValue('YYYY-MM-DD (ISO)')).toBeInTheDocument();
  });

  it('rolls the control back to the stored value when the save fails', async () => {
    const user = userEvent.setup();
    mockFetch({ putOk: false });
    render(<PreferencesPage />, { wrapper: ChakraProvider });

    await waitFor(() => expect(screen.getByDisplayValue(/GBP/)).toBeInTheDocument());

    await user.selectOptions(currencySelect(), 'USD');

    // The PUT 500s, so the stored currency is still GBP — and the select has to
    // say so. Leaving it on USD tells the user a change was saved that wasn't.
    await waitFor(() => {
      expect(currencySelect().value).toBe('GBP');
    });
  });
});
