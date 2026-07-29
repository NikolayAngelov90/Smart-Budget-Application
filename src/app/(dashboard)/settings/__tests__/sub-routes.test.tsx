/**
 * Settings sub-routes — Story 16.8.
 *
 * Eight thin route files wrap a section in `SettingsSubPage`. They look too
 * trivial to test, but the risk in this refactor is exactly at that seam: a
 * route that imports the wrong module, forgets its title, or loses the way
 * back. Mounting each one proves the group is genuinely reachable.
 *
 * The sections themselves are stubbed — they own their own tests, and their
 * real dependencies (push APIs, exports, exchange rates) would test the mocks
 * rather than the routing.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
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

// Inlined rather than a shared `stub()` helper: jest.mock is hoisted above
// every const in the module, so a helper would not exist yet when it runs.
jest.mock('@/components/settings/sections/AccountSection', () => ({
  AccountSection: () => <div data-testid="section-account" />,
}));
jest.mock('@/components/settings/sections/PreferencesSection', () => ({
  PreferencesSection: () => <div data-testid="section-preferences" />,
}));
jest.mock('@/components/settings/sections/NotificationsSection', () => ({
  NotificationsSection: () => <div data-testid="section-notifications" />,
}));
jest.mock('@/components/settings/sections/PersonalizationSection', () => ({
  PersonalizationSection: () => <div data-testid="section-personalization" />,
}));
jest.mock('@/components/settings/sections/DataSection', () => ({
  DataSection: () => <div data-testid="section-data" />,
}));
jest.mock('@/components/settings/sections/SecuritySection', () => ({
  SecuritySection: () => <div data-testid="section-security" />,
}));
jest.mock('@/components/settings/sections/AboutSection', () => ({
  AboutSection: () => <div data-testid="section-about" />,
}));
jest.mock('@/components/settings/AppearanceSection', () => ({
  AppearanceSection: () => <div data-testid="section-appearance" />,
}));

import AccountPage from '@/app/(dashboard)/settings/account/page';
import AppearancePage from '@/app/(dashboard)/settings/appearance/page';
import PreferencesPage from '@/app/(dashboard)/settings/preferences/page';
import NotificationsPage from '@/app/(dashboard)/settings/notifications/page';
import PersonalizationPage from '@/app/(dashboard)/settings/personalization/page';
import DataPage from '@/app/(dashboard)/settings/data/page';
import SecurityPage from '@/app/(dashboard)/settings/security/page';
import AboutPage from '@/app/(dashboard)/settings/about/page';

const ROUTES: Array<{ name: string; Page: React.ComponentType; titleKey: string }> = [
  { name: 'account', Page: AccountPage, titleKey: 'accountInformation' },
  { name: 'appearance', Page: AppearancePage, titleKey: 'appearanceHeading' },
  { name: 'preferences', Page: PreferencesPage, titleKey: 'preferences' },
  { name: 'notifications', Page: NotificationsPage, titleKey: 'notificationsHeading' },
  { name: 'personalization', Page: PersonalizationPage, titleKey: 'personalizationHeading' },
  { name: 'data', Page: DataPage, titleKey: 'exportData' },
  { name: 'security', Page: SecurityPage, titleKey: 'privacyAndSecurity' },
  { name: 'about', Page: AboutPage, titleKey: 'aboutHeading' },
];

describe.each(ROUTES)('/settings/$name', ({ name, Page, titleKey }) => {
  beforeEach(() => {
    render(
      <ChakraProvider>
        <Page />
      </ChakraProvider>
    );
  });

  it('renders its section', () => {
    expect(screen.getByTestId(`section-${name}`)).toBeInTheDocument();
  });

  it('is titled with its own group heading', () => {
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(titleKey);
  });

  it('offers a way back to the settings index', () => {
    const back = screen.getByRole('link', { name: 'backToSettings' });
    expect(back).toHaveAttribute('href', '/settings');
    // Thumb-sized: this is the primary navigation out of a sub-page on mobile.
    expect(back).toHaveStyle({ minHeight: '44px' });
  });
});
