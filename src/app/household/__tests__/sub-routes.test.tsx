/**
 * Household sub-routes — Story 17.1.
 *
 * Four thin route files wrap a group in `HouseholdSubPage`. They look too
 * trivial to test, but the risk in this refactor is exactly at that seam: a
 * route that imports the wrong module, forgets its title, or loses the way back.
 * Mounting each one proves the group is genuinely reachable — the same reasoning
 * as `settings/__tests__/sub-routes.test.tsx`, which this mirrors.
 *
 * It also covers the thing settings does not have: a MEMBERSHIP GATE. Someone
 * without a household must not be shown the chrome of a page that cannot do
 * anything, so every sub-page sends them back to the index.
 *
 * The sections themselves are stubbed — they own their own tests, and their real
 * dependencies (invitations, allowances, contribution splits) would test the
 * mocks rather than the routing.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { useHousehold } from '@/lib/hooks/useHousehold';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/hooks/useHousehold', () => ({ useHousehold: jest.fn() }));

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace }) }));

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

// Inlined rather than a shared `stub()` helper: jest.mock is hoisted above every
// const in the module, so a helper would not exist yet when it runs.
jest.mock('@/components/household/HouseholdInvites', () => ({
  HouseholdInvites: () => <div data-testid="section-invites" />,
}));
jest.mock('@/components/household/HouseholdMembers', () => ({
  HouseholdMembers: () => <div data-testid="section-members" />,
}));
jest.mock('@/components/household/TransparencyPresetCard', () => ({
  TransparencyPresetCard: () => <div data-testid="section-preset" />,
}));
jest.mock('@/components/household/AllowanceCard', () => ({
  AllowanceCard: () => <div data-testid="section-allowance" />,
}));
jest.mock('@/components/household/ContributionSplitCard', () => ({
  ContributionSplitCard: () => <div data-testid="section-split" />,
}));
jest.mock('@/components/household/SharedGoalsCard', () => ({
  SharedGoalsCard: () => <div data-testid="section-goals" />,
}));

import MembersPage from '../members/page';
import SharingPage from '../sharing/page';
import MoneyPage from '../money/page';
import GoalsPage from '../goals/page';

const mockHousehold = useHousehold as jest.MockedFunction<typeof useHousehold>;

const asMember = (role: 'admin' | 'member' = 'admin') =>
  mockHousehold.mockReturnValue({
    household: { id: 'h', name: 'Home', role } as never,
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
  });

const renderIt = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);

beforeEach(() => jest.clearAllMocks());

describe('each sub-route renders its own group', () => {
  it('/household/members — invitations and the roster', () => {
    asMember();
    renderIt(<MembersPage />);
    expect(screen.getByTestId('section-invites')).toBeInTheDocument();
    expect(screen.getByTestId('section-members')).toBeInTheDocument();
    expect(screen.queryByTestId('section-allowance')).not.toBeInTheDocument();
  });

  it('/household/sharing — the transparency preset', () => {
    asMember();
    renderIt(<SharingPage />);
    expect(screen.getByTestId('section-preset')).toBeInTheDocument();
    expect(screen.queryByTestId('section-members')).not.toBeInTheDocument();
  });

  it('/household/money — allowance and contribution split', () => {
    asMember();
    renderIt(<MoneyPage />);
    expect(screen.getByTestId('section-allowance')).toBeInTheDocument();
    expect(screen.getByTestId('section-split')).toBeInTheDocument();
    expect(screen.queryByTestId('section-goals')).not.toBeInTheDocument();
  });

  it('/household/goals — the shared goals card', () => {
    asMember();
    renderIt(<GoalsPage />);
    expect(screen.getByTestId('section-goals')).toBeInTheDocument();
    expect(screen.queryByTestId('section-preset')).not.toBeInTheDocument();
  });
});

describe('every sub-route offers a way back', () => {
  it.each([
    ['members', <MembersPage key="m" />],
    ['sharing', <SharingPage key="s" />],
    ['money', <MoneyPage key="o" />],
    ['goals', <GoalsPage key="g" />],
  ])('/household/%s links back to the index', (_name, ui) => {
    asMember();
    renderIt(ui);
    const back = screen.getByRole('link', { name: 'backToHousehold' });
    expect(back).toHaveAttribute('href', '/household');
  });
});

describe('membership gate', () => {
  it.each([
    ['members', <MembersPage key="m" />],
    ['sharing', <SharingPage key="s" />],
    ['money', <MoneyPage key="o" />],
    ['goals', <GoalsPage key="g" />],
  ])('/household/%s sends a non-member back to the index', (_name, ui) => {
    mockHousehold.mockReturnValue({
      household: null,
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    });

    renderIt(ui);

    expect(mockReplace).toHaveBeenCalledWith('/household');
    // …and shows no group content on the way out.
    expect(screen.queryByTestId('section-members')).not.toBeInTheDocument();
    expect(screen.queryByTestId('section-allowance')).not.toBeInTheDocument();
  });

  it('does not redirect while membership is still loading', () => {
    mockHousehold.mockReturnValue({
      household: null,
      isLoading: true,
      error: undefined,
      mutate: jest.fn(),
    });

    renderIt(<MembersPage />);

    // Redirecting on `isLoading` would bounce every member off their own
    // sub-page on a cold load, before the household had arrived.
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('admin-only surfaces', () => {
  it('hides invitations from a non-admin member', () => {
    asMember('member');
    renderIt(<MembersPage />);
    expect(screen.queryByTestId('section-invites')).not.toBeInTheDocument();
    expect(screen.getByTestId('section-members')).toBeInTheDocument();
  });
});
