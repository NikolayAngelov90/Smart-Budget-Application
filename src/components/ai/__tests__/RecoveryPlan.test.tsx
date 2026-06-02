/**
 * RecoveryPlan Component Tests — Story 12.4 / FR4
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { RecoveryPlan } from '@/components/ai/RecoveryPlan';
import type { RecoveryPlanProgress } from '@/types/database.types';

jest.mock('@/lib/hooks/useRecoveryPlan', () => ({
  useRecoveryPlan: jest.fn(),
}));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: '30-Day Recovery Plan',
      subtitle: `Day ${params?.day ?? 0} of 30 — ${params?.daysRemaining ?? 0} days left`,
      ctaTitle: 'Spending ran high',
      ctaBody: 'Create a realistic plan',
      createButton: 'Create my recovery plan',
      monthlyTarget: 'Target',
      spentSoFar: 'Spent',
      onTrack: 'On track',
      overTarget: 'Over target',
      dismiss: "I'm done with this plan",
      compact: 'For educational purposes only — not licensed financial advice.',
    };
    return map[key] ?? key;
  },
}));

import { useRecoveryPlan } from '@/lib/hooks/useRecoveryPlan';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

const mockUseRecoveryPlan = useRecoveryPlan as jest.MockedFunction<typeof useRecoveryPlan>;
const mockUseUserPreferences = useUserPreferences as jest.MockedFunction<typeof useUserPreferences>;

const renderWithChakra = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);

const PREFS = { preferences: { currency_format: 'USD' } } as ReturnType<typeof useUserPreferences>;

function hookResult(overrides: Partial<ReturnType<typeof useRecoveryPlan>>) {
  return {
    plan: null,
    canGenerate: false,
    isLoading: false,
    error: undefined,
    mutate: jest.fn() as unknown as ReturnType<typeof useRecoveryPlan>['mutate'],
    generate: jest.fn(),
    dismiss: jest.fn(),
    ...overrides,
  };
}

function makeActivePlan(): RecoveryPlanProgress {
  return {
    plan: {
      id: 'plan-1',
      user_id: 'u1',
      start_date: '2026-06-05',
      end_date: '2026-07-05',
      status: 'active',
      targets: [],
      created_at: '2026-06-05T00:00:00Z',
      updated_at: '2026-06-05T00:00:00Z',
    },
    days_elapsed: 10,
    days_remaining: 20,
    categories: [
      {
        category_id: 'cat-d',
        category_name: 'Dining',
        category_color: '#abc',
        historical_avg: 300,
        historical_min: 200,
        monthly_target: 200,
        weekly_target: 47,
        daily_target: 7,
        current_spend: 150,
        on_track: false,
        pct_of_target: 75,
      },
    ],
  };
}

describe('RecoveryPlan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserPreferences.mockReturnValue(PREFS);
  });

  it('renders nothing when no plan and cannot generate', () => {
    mockUseRecoveryPlan.mockReturnValue(hookResult({ plan: null, canGenerate: false, isLoading: false }));
    renderWithChakra(<RecoveryPlan />);
    expect(screen.queryByRole('heading', { name: /recovery plan/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Create my recovery plan/i)).not.toBeInTheDocument();
  });

  it('renders skeleton while loading', () => {
    mockUseRecoveryPlan.mockReturnValue(hookResult({ isLoading: true }));
    renderWithChakra(<RecoveryPlan />);
    expect(screen.getByTestId('recovery-plan-skeleton')).toBeInTheDocument();
  });

  it('shows the coaching CTA when a plan can be generated', () => {
    mockUseRecoveryPlan.mockReturnValue(hookResult({ canGenerate: true }));
    renderWithChakra(<RecoveryPlan />);
    expect(screen.getByText(/Create my recovery plan/i)).toBeInTheDocument();
    // FR39 disclaimer present on the AI surface
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('renders the active plan with category progress and over-target badge', () => {
    mockUseRecoveryPlan.mockReturnValue(hookResult({ plan: makeActivePlan() }));
    renderWithChakra(<RecoveryPlan />);
    expect(screen.getByText('30-Day Recovery Plan')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText('Over target')).toBeInTheDocument();
    expect(screen.getByText(/Day 10 of 30/i)).toBeInTheDocument();
  });

  it('renders the FinancialDisclaimer on the active plan (FR39)', () => {
    mockUseRecoveryPlan.mockReturnValue(hookResult({ plan: makeActivePlan() }));
    renderWithChakra(<RecoveryPlan />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});
