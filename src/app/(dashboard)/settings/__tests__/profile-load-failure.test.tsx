/**
 * Settings — profile load failure. Story 16.8 review.
 *
 * The pre-split page rendered an error + retry when `/api/user/profile` failed,
 * so no control ever rendered without a profile. Splitting into sub-pages moved
 * the spinner but dropped the error branch, and the failure mode was ugly: the
 * fetch clears its loading flag on the error path too, so the gate opened onto
 * a NULL profile. Sections then showed their hardcoded defaults as if they were
 * the user's saved settings, and every write silently no-opped, because both
 * save actions early-return when profile is null. No error, no toast, nothing
 * in the console.
 *
 * The whole suite mocked a successful profile, so none of that was visible.
 * These tests pin the failure path itself.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import PreferencesPage from '@/app/(dashboard)/settings/preferences/page';
import AccountPage from '@/app/(dashboard)/settings/account/page';

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

global.fetch = jest.fn();

const failProfileWith = (status: number) => {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/user/profile')) {
      return Promise.resolve({ ok: false, status, headers: jsonHeaders, json: async () => ({}) });
    }
    return Promise.resolve({ ok: true, status: 200, headers: jsonHeaders, json: async () => ({ data: [] }) });
  });
};

const profilePuts = () =>
  (global.fetch as jest.Mock).mock.calls.filter(
    ([url, init]) => typeof url === 'string' && url.includes('/api/user/profile') && init?.method === 'PUT'
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Settings sub-page when the profile cannot be loaded', () => {
  it('shows an error instead of a form full of defaults', async () => {
    failProfileWith(500);
    render(<PreferencesPage />, { wrapper: ChakraProvider });

    await waitFor(() => {
      expect(screen.getByText('Failed to load profile. Please refresh the page.')).toBeInTheDocument();
    });

    // The controls must NOT be there: rendering the currency select would show
    // the hardcoded EUR to a user whose saved currency is something else.
    expect(screen.queryByLabelText(/currency/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retries the fetch in place rather than only offering a page reload', async () => {
    const user = userEvent.setup();
    failProfileWith(500);
    render(<PreferencesPage />, { wrapper: ChakraProvider });

    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument());

    const before = (global.fetch as jest.Mock).mock.calls.length;
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('never presents a save control that would silently discard the write', async () => {
    failProfileWith(401);
    render(<AccountPage />, { wrapper: ChakraProvider });

    await waitFor(() => {
      expect(screen.getByText('Failed to load profile. Please refresh the page.')).toBeInTheDocument();
    });

    // The regression this guards: the Save button rendered, enabled, and did
    // nothing at all when clicked — no PUT, no toast, no console error.
    expect(screen.queryByRole('button', { name: /save profile/i })).not.toBeInTheDocument();
    expect(profilePuts()).toHaveLength(0);
  });

  it('treats a 200 with no data as a failure, not as an empty profile', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/user/profile')) {
        return Promise.resolve({ ok: true, status: 200, headers: jsonHeaders, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, status: 200, headers: jsonHeaders, json: async () => ({ data: [] }) });
    });

    render(<PreferencesPage />, { wrapper: ChakraProvider });

    await waitFor(() => {
      expect(screen.getByText('Failed to load profile. Please refresh the page.')).toBeInTheDocument();
    });
  });
});
