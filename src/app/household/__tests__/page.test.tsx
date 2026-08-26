/**
 * Household INDEX page — Story 13.8, reshaped by Story 17.1.
 *
 * The page was one long scroll; it is now an index with four sub-pages. The
 * assertions that used to live here have MOVED rather than been deleted:
 *
 *  - shared-goals rendering  -> sub-routes.test.tsx (/household/goals)
 *  - realtime revalidation   -> HouseholdRealtimeProvider.test.tsx, because the
 *    subscription moved to src/app/household/layout.tsx so it survives
 *    navigation between the index and its sub-pages
 *
 * What stays here is what the index itself still owns: the read-only aggregates
 * and the navigation into each group.
 */

import { render } from '@/lib/test-utils';
import { screen } from '@testing-library/react';
import { useHousehold } from '@/lib/hooks/useHousehold';
import { useHouseholdCategoryTotals } from '@/lib/hooks/useHouseholdCategoryTotals';
import { useContributions } from '@/lib/hooks/useContributions';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import HouseholdDashboardPage from '../page';

jest.mock('@/lib/hooks/useHousehold', () => ({ useHousehold: jest.fn() }));
jest.mock('@/lib/hooks/useHouseholdCategoryTotals', () => ({ useHouseholdCategoryTotals: jest.fn() }));
jest.mock('@/lib/hooks/useContributions', () => ({ useContributions: jest.fn() }));
jest.mock('@/lib/hooks/useUserPreferences', () => ({ useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }) }));
jest.mock('@/lib/hooks/useRealtimeSubscription', () => ({ useRealtimeSubscription: jest.fn() }));
jest.mock('@/lib/hooks/useHouseholdGoals', () => ({ useHouseholdGoals: () => ({ goals: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
jest.mock('@/lib/hooks/useHouseholdInsights', () => ({ useHouseholdInsights: () => ({ insights: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
// The index and its cards pull in these — keep them deterministic.
jest.mock('@/lib/hooks/useInvitations', () => ({ useInvitations: () => ({ invitations: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
jest.mock('@/lib/hooks/useAllowance', () => ({ useAllowance: () => ({ status: null, isLoading: false, error: undefined, mutate: jest.fn() }) }));
jest.mock('@/lib/hooks/useHouseholdMembers', () => ({ useHouseholdMembers: () => ({ members: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
jest.mock('@/lib/hooks/useMyInvitations', () => ({ useMyInvitations: () => ({ invitations: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
const mockScopedMutate = jest.fn();
jest.mock('swr', () => ({
  ...jest.requireActual('swr'),
  // The page revalidates through useSWRConfig(), not the global `mutate` —
  // the global one binds to SWR's default cache, not this app's provider, so
  // asserting on it passed while nothing was actually revalidated (15-1).
  useSWRConfig: () => ({ mutate: mockScopedMutate }),
}));

const mockHousehold = useHousehold as jest.MockedFunction<typeof useHousehold>;
const mockTotals = useHouseholdCategoryTotals as jest.MockedFunction<typeof useHouseholdCategoryTotals>;
const mockContrib = useContributions as jest.MockedFunction<typeof useContributions>;
const mockRealtime = useRealtimeSubscription as jest.MockedFunction<typeof useRealtimeSubscription>;

function asMember() {
  mockHousehold.mockReturnValue({ household: { id: 'h', name: 'Home', role: 'admin' } as never, isLoading: false, error: undefined, mutate: jest.fn() });
}

beforeEach(() => jest.clearAllMocks());

it('renders the three sections with combined spending + category_only tag for a member', () => {
  asMember();
  mockTotals.mockReturnValue({
    totals: [
      { category_id: 'c1', category_name: 'Groceries', visibility_level: 'shared', total: 100 },
      { category_id: 'c2', category_name: 'Hidden', visibility_level: 'category_only', total: 50 },
    ],
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
  });
  mockContrib.mockReturnValue({
    summary: { total: 150, splits: [{ user_id: 'u1', email: 'a@x.test', percentage: 60, contributed: 100, fairShare: 90, progress: 1.1, isSelf: true }] },
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
  });

  render(<HouseholdDashboardPage />);

  expect(screen.getByText('Combined spending')).toBeInTheDocument();
  expect(screen.getByText('Groceries')).toBeInTheDocument();
  expect(screen.getByText('Hidden')).toBeInTheDocument();
  expect(screen.getByText('total only')).toBeInTheDocument();

  // The four groups are reachable from the index.
  expect(screen.getByRole('link', { name: /Members & invitations/i })).toHaveAttribute(
    'href',
    '/household/members'
  );
  expect(screen.getByRole('link', { name: /Sharing & transparency/i })).toHaveAttribute(
    'href',
    '/household/sharing'
  );
  expect(screen.getByRole('link', { name: /Allowance & contributions/i })).toHaveAttribute(
    'href',
    '/household/money'
  );
  expect(screen.getByRole('link', { name: /Shared goals/i })).toHaveAttribute(
    'href',
    '/household/goals'
  );
});

it('does NOT render the shared-goals card itself — it lives at /household/goals', () => {
  // Rendering the card here as well put "Shared goals" on the page twice, once
  // as a card and once as a row linking to a duplicate of it.
  asMember();
  mockTotals.mockReturnValue({ totals: [], isLoading: false, error: undefined, mutate: jest.fn() });
  mockContrib.mockReturnValue({ summary: null, isLoading: false, error: undefined, mutate: jest.fn() });

  render(<HouseholdDashboardPage />);

  expect(screen.queryByText('No shared goals yet.')).not.toBeInTheDocument();
  expect(screen.getAllByText(/Shared goals/i)).toHaveLength(1);
});

it('shows the no-household empty state and no dashboard cards', () => {
  mockHousehold.mockReturnValue({ household: null, isLoading: false, error: undefined, mutate: jest.fn() });
  mockTotals.mockReturnValue({ totals: [], isLoading: false, error: undefined, mutate: jest.fn() });
  mockContrib.mockReturnValue({ summary: null, isLoading: false, error: undefined, mutate: jest.fn() });

  render(<HouseholdDashboardPage />);

  expect(screen.getByText(/not in a household yet/i)).toBeInTheDocument();
  expect(screen.queryByText('Combined spending')).not.toBeInTheDocument();
  // …and no rows into groups that could not do anything yet.
  expect(screen.queryByRole('link', { name: /Members & invitations/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Allowance & contributions/i })).not.toBeInTheDocument();
});

it('shows a skeleton while membership loads — NOT the create form', () => {
  // Regression from the 17.1 split: the index derived `inHousehold` as
  // `!isLoading && household`, which collapses "still loading" into "has no
  // household". A member on a cold load was told "You're not in a household
  // yet" before their household arrived. The old HouseholdSection had its own
  // skeleton branch, and carving it up lost that.
  mockHousehold.mockReturnValue({
    household: null,
    isLoading: true,
    error: undefined,
    mutate: jest.fn(),
  });
  mockTotals.mockReturnValue({ totals: [], isLoading: true, error: undefined, mutate: jest.fn() });
  mockContrib.mockReturnValue({ summary: null, isLoading: true, error: undefined, mutate: jest.fn() });

  render(<HouseholdDashboardPage />);

  expect(screen.queryByText(/not in a household yet/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Members & invitations/i })).not.toBeInTheDocument();
});
