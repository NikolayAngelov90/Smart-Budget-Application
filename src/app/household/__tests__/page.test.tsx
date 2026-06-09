/**
 * Household Dashboard page — Story 13.8
 */

import { render } from '@/lib/test-utils';
import { screen } from '@testing-library/react';
import { useHousehold } from '@/lib/hooks/useHousehold';
import { useHouseholdCategoryTotals } from '@/lib/hooks/useHouseholdCategoryTotals';
import { useContributions } from '@/lib/hooks/useContributions';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { mutate } from 'swr';
import HouseholdDashboardPage from '../page';

jest.mock('@/lib/hooks/useHousehold', () => ({ useHousehold: jest.fn() }));
jest.mock('@/lib/hooks/useHouseholdCategoryTotals', () => ({ useHouseholdCategoryTotals: jest.fn() }));
jest.mock('@/lib/hooks/useContributions', () => ({ useContributions: jest.fn() }));
jest.mock('@/lib/hooks/useUserPreferences', () => ({ useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }) }));
jest.mock('@/lib/hooks/useRealtimeSubscription', () => ({ useRealtimeSubscription: jest.fn() }));
jest.mock('@/lib/hooks/useHouseholdGoals', () => ({ useHouseholdGoals: () => ({ goals: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
jest.mock('@/lib/hooks/useHouseholdInsights', () => ({ useHouseholdInsights: () => ({ insights: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
// HouseholdSection (now rendered on the page) pulls in these — keep them deterministic.
jest.mock('@/lib/hooks/useInvitations', () => ({ useInvitations: () => ({ invitations: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
jest.mock('@/lib/hooks/useAllowance', () => ({ useAllowance: () => ({ status: null, isLoading: false, error: undefined, mutate: jest.fn() }) }));
jest.mock('@/lib/hooks/useHouseholdMembers', () => ({ useHouseholdMembers: () => ({ members: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
jest.mock('@/lib/hooks/useMyInvitations', () => ({ useMyInvitations: () => ({ invitations: [], isLoading: false, error: undefined, mutate: jest.fn() }) }));
jest.mock('swr', () => ({ ...jest.requireActual('swr'), mutate: jest.fn() }));

const mockHousehold = useHousehold as jest.MockedFunction<typeof useHousehold>;
const mockTotals = useHouseholdCategoryTotals as jest.MockedFunction<typeof useHouseholdCategoryTotals>;
const mockContrib = useContributions as jest.MockedFunction<typeof useContributions>;
const mockRealtime = useRealtimeSubscription as jest.MockedFunction<typeof useRealtimeSubscription>;
const mockMutate = mutate as jest.MockedFunction<typeof mutate>;

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
  expect(screen.getByText('Shared goals')).toBeInTheDocument();
  expect(screen.getByText('No shared goals yet.')).toBeInTheDocument();
  expect(screen.getByText('Groceries')).toBeInTheDocument();
  expect(screen.getByText('Hidden')).toBeInTheDocument();
  expect(screen.getByText('total only')).toBeInTheDocument();
});

it('shows the no-household empty state and no dashboard cards', () => {
  mockHousehold.mockReturnValue({ household: null, isLoading: false, error: undefined, mutate: jest.fn() });
  mockTotals.mockReturnValue({ totals: [], isLoading: false, error: undefined, mutate: jest.fn() });
  mockContrib.mockReturnValue({ summary: null, isLoading: false, error: undefined, mutate: jest.fn() });

  render(<HouseholdDashboardPage />);

  expect(screen.getByText(/not in a household yet/i)).toBeInTheDocument();
  expect(screen.queryByText('Combined spending')).not.toBeInTheDocument();
});

it('revalidates both dashboard endpoints on a realtime event (AC#5)', async () => {
  asMember();
  mockTotals.mockReturnValue({ totals: [], isLoading: false, error: undefined, mutate: jest.fn() });
  mockContrib.mockReturnValue({ summary: { total: 0, splits: [] }, isLoading: false, error: undefined, mutate: jest.fn() });

  render(<HouseholdDashboardPage />);

  // The page registered a realtime listener; fire it.
  const cb = mockRealtime.mock.calls[0]![0];
  cb({ eventType: 'INSERT', new: {}, old: null, timestamp: '' });

  await new Promise((r) => setTimeout(r, 200)); // trailing-guard debounce (150ms)

  expect(mockMutate).toHaveBeenCalledWith('/api/households/category-totals');
  expect(mockMutate).toHaveBeenCalledWith('/api/households/contributions');
});
