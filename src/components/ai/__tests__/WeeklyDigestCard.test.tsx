/**
 * WeeklyDigestCard Component Tests
 * Story 11.7: Weekly Financial Digest
 *
 * - Renders nothing when digest === null (progressive disclosure)
 * - Renders skeleton when loading
 * - Renders card with spending total, change indicator, top categories, highlight
 * - Red/up-arrow when spending_change_pct > 0
 * - Green/down-arrow when spending_change_pct < 0
 * - Zero change: neutral (no arrow icons)
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { WeeklyDigestCard } from '@/components/ai/WeeklyDigestCard';
import type { WeeklyDigest } from '@/types/database.types';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('@/lib/hooks/useWeeklyDigest', () => ({
  useWeeklyDigest: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: 'Weekly Digest',
      totalSpending: 'Total Spending',
      topCategories: 'Top Categories',
      highlight: "This Week's Highlight",
      loading: 'Loading weekly digest...',
    };
    if (key === 'weekOf') return `Week of ${String(params?.start ?? '')} – ${String(params?.end ?? '')}`;
    if (key === 'vsLastWeek') return `${String(params?.pct ?? '')} vs last week`;
    return map[key] ?? key;
  },
}));

import { useWeeklyDigest } from '@/lib/hooks/useWeeklyDigest';
const mockUseWeeklyDigest = useWeeklyDigest as jest.MockedFunction<typeof useWeeklyDigest>;

// ============================================================================
// HELPERS
// ============================================================================

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

const baseDigest: WeeklyDigest = {
  id: 'd-1',
  user_id: 'user-1',
  week_start: '2026-03-23',
  week_end: '2026-03-29',
  total_spending: 250,
  previous_week_spending: 200,
  spending_change_pct: 25,
  top_categories: [
    { category_id: 'c1', name: 'Groceries', color: '#48BB78', total: 120 },
    { category_id: 'c2', name: 'Transport', color: '#4299E1', total: 80 },
    { category_id: 'c3', name: 'Dining', color: '#F6AD55', total: 50 },
  ],
  actionable_highlight: 'Your spending increased by 25% — check your Groceries category.',
  currency: 'EUR',
  generated_at: '2026-03-30T08:00:00Z',
};

// ============================================================================
// TESTS
// ============================================================================

describe('WeeklyDigestCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when digest is null and not loading (progressive disclosure)', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: null, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.queryByTestId('weekly-digest-card')).not.toBeInTheDocument();
  });

  it('renders skeleton while loading', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: null, isLoading: true, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.getByTestId('weekly-digest-card')).toBeInTheDocument();
  });

  it('renders the digest card with testid when digest exists', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: baseDigest, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.getByTestId('weekly-digest-card')).toBeInTheDocument();
  });

  it('renders title and week range', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: baseDigest, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.getByText('Weekly Digest')).toBeInTheDocument();
    expect(screen.getByText(/Week of/)).toBeInTheDocument();
  });

  it('shows total spending label', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: baseDigest, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.getByText('Total Spending')).toBeInTheDocument();
  });

  it('shows top category names', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: baseDigest, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Transport')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
  });

  it('shows actionable highlight', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: baseDigest, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.getByText(baseDigest.actionable_highlight)).toBeInTheDocument();
  });

  it('shows up-arrow icon and positive text when spending_change_pct > 0 (AC6)', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: { ...baseDigest, spending_change_pct: 25 }, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    // Verify up-arrow icon is rendered (AC6: "up-arrow")
    expect(screen.getByTestId('change-increase-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('change-decrease-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('weekly-digest-card')).toHaveTextContent('+25.0%');
  });

  it('shows down-arrow icon and negative text when spending_change_pct < 0 (AC6)', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: { ...baseDigest, spending_change_pct: -15 }, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    // Verify down-arrow icon is rendered (AC6: "down-arrow")
    expect(screen.getByTestId('change-decrease-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('change-increase-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('weekly-digest-card')).toHaveTextContent('-15.0%');
  });

  it('shows neither arrow icon when spending_change_pct is 0', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: { ...baseDigest, spending_change_pct: 0 }, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.queryByTestId('change-increase-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('change-decrease-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('weekly-digest-card')).toHaveTextContent('0.0%');
  });

  it('renders nothing when fetch errors and there is no cached digest (M5)', () => {
    mockUseWeeklyDigest.mockReturnValue({ digest: null, isLoading: false, error: new Error('Network error') });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.queryByTestId('weekly-digest-card')).not.toBeInTheDocument();
  });

  it('renders stale digest even when a revalidation error occurs (M5)', () => {
    // SWR preserves previous value — digest is not null even though error is set
    mockUseWeeklyDigest.mockReturnValue({ digest: baseDigest, isLoading: false, error: new Error('Revalidation failed') });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.getByTestId('weekly-digest-card')).toBeInTheDocument();
  });

  it('renders nothing when top_categories is empty (no Top Categories section)', () => {
    const digestNoCategories = { ...baseDigest, top_categories: [], actionable_highlight: '' };
    mockUseWeeklyDigest.mockReturnValue({ digest: digestNoCategories, isLoading: false, error: undefined });
    renderWithChakra(<WeeklyDigestCard />);
    expect(screen.queryByText('Top Categories')).not.toBeInTheDocument();
  });
});
