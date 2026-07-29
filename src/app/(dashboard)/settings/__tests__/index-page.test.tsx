/**
 * Settings index — Story 16.8.
 *
 * Guards the information architecture itself, which is the point of the story:
 * the groups, their ORDER, where each one links, and the two things that were
 * explicitly asked for — no Categories/Goals links, and deletion kept apart.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import SettingsPage from '@/app/(dashboard)/settings/page';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/settings/sections/DangerZoneSection', () => ({
  DangerZoneSection: () => <div>danger-zone</div>,
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

const renderIndex = () =>
  render(
    <ChakraProvider>
      <SettingsPage />
    </ChakraProvider>
  );

describe('Settings index', () => {
  it('lists the groups in the intended order', () => {
    renderIndex();

    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((h): h is string => !!h && h.startsWith('/settings/'));

    // Own account first, then how the app looks, behaves, what it sends,
    // then data, security, legal.
    expect(hrefs).toEqual([
      '/settings/account',
      '/settings/appearance',
      '/settings/preferences',
      '/settings/notifications',
      '/settings/personalization',
      '/settings/data',
      '/settings/security',
      '/settings/about',
    ]);
  });

  it('does NOT link to Categories or Goals (the More sheet and sidebar own those)', () => {
    renderIndex();

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('/categories');
    expect(hrefs).not.toContain('/goals');
  });

  it('gives every row a label and a summary', () => {
    renderIndex();

    const accountRow = screen.getByRole('link', { name: /accountInformation/ });
    expect(within(accountRow).getByText('accountInformation')).toBeInTheDocument();
    expect(within(accountRow).getByText('accountSummary')).toBeInTheDocument();
  });

  it('keeps account deletion apart from the group list', () => {
    renderIndex();

    // Rendered outside the index card, at the end — not a navigable group row.
    expect(screen.getByText('danger-zone')).toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('/settings/danger');
  });
});
