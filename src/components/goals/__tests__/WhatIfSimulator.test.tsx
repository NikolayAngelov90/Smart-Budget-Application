/**
 * WhatIfSimulator Component Tests — Story 14.4
 *
 * Live client-side recompute on slider/checkbox changes, reset, empty state,
 * and the AC #5 guarantee: the simulator performs ZERO writes.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { WhatIfSimulator } from '@/components/goals/WhatIfSimulator';
import { useWhatIf } from '@/lib/hooks/useWhatIf';
import type { WhatIfContextResponse } from '@/types/database.types';

jest.mock('@/lib/hooks/useWhatIf', () => ({
  useWhatIf: jest.fn(),
  WHAT_IF_KEY: '/api/what-if',
}));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: { currency_format: 'EUR' },
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: 'What If Simulator',
      subtitle: 'Try out spending changes.',
      emptyState: 'Once you have spending history, simulate changes here.',
      loadFailed: 'Unable to load the simulator.',
      subscriptionsHeading: 'Cancel a subscription',
      monthlySavings: 'Projected monthly savings',
      annualSavings: 'Projected annual savings',
      reset: 'Reset',
      exploratoryDisclaimer: 'Exploratory only.',
    };
    if (key === 'avgPerMonth') return `~${params?.amount}/mo`;
    if (key === 'reducedTo') return `-${params?.pct}% -> ${params?.amount}/mo`;
    if (key === 'sliderAriaLabel') return `Reduce ${params?.name} spending by percentage`;
    if (key === 'cancelSubscription') return `Cancel ${params?.name} (${params?.amount}/mo)`;
    if (key === 'goalEarlierMonths')
      return `You'd reach your ${params?.goal} goal about ${params?.months} months earlier`;
    if (key === 'goalEarlierDays')
      return `You'd reach your ${params?.goal} goal about ${params?.days} days earlier`;
    return map[key] ?? key;
  },
}));

const mockUseWhatIf = useWhatIf as jest.MockedFunction<typeof useWhatIf>;

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

const CONTEXT: WhatIfContextResponse = {
  hasData: true,
  categories: [
    { category_id: 'cat-1', name: 'Dining', color: '#aaa', avg_monthly: 400 },
  ],
  subscriptions: [{ id: 's-1', name: 'Netflix', monthly_amount: 10 }],
  goal: { name: 'Vacation', target_amount: 1300, current_amount: 1000, deadline: '2199-08-01' },
};

const hookResult = (overrides: Partial<ReturnType<typeof useWhatIf>>) =>
  ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
    ...overrides,
  }) as ReturnType<typeof useWhatIf>;

const ORIGINAL_FETCH = global.fetch;

describe('WhatIfSimulator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  afterAll(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('renders sliders, subscriptions and zeroed results', () => {
    mockUseWhatIf.mockReturnValue(hookResult({ data: CONTEXT }));
    renderWithChakra(<WhatIfSimulator />);

    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Reduce Dining spending by percentage')
    ).toBeInTheDocument();
    expect(screen.getByText(/Cancel Netflix/)).toBeInTheDocument();
    expect(screen.getByText('Projected monthly savings')).toBeInTheDocument();
    expect(screen.getAllByText('€0.00')).toHaveLength(2); // monthly + annual
  });

  it('recomputes live when a slider moves (keyboard)', () => {
    mockUseWhatIf.mockReturnValue(hookResult({ data: CONTEXT }));
    renderWithChakra(<WhatIfSimulator />);

    const slider = screen.getByLabelText('Reduce Dining spending by percentage');
    fireEvent.keyDown(slider, { key: 'ArrowRight' }); // +5% of 400 = 20/mo

    expect(screen.getByText('€20.00')).toBeInTheDocument(); // monthly
    expect(screen.getByText('€240.00')).toBeInTheDocument(); // annual
    expect(screen.getByText(/-5% ->/)).toBeInTheDocument();
  });

  it('adds cancelled subscriptions to the savings and shows the goal line', () => {
    mockUseWhatIf.mockReturnValue(hookResult({ data: CONTEXT }));
    renderWithChakra(<WhatIfSimulator />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByText('€10.00')).toBeInTheDocument(); // monthly
    expect(screen.getByText('€120.00')).toBeInTheDocument(); // annual
    expect(screen.getByText(/You'd reach your Vacation goal/)).toBeInTheDocument();
  });

  it('reset restores all adjustments to zero', () => {
    mockUseWhatIf.mockReturnValue(hookResult({ data: CONTEXT }));
    renderWithChakra(<WhatIfSimulator />);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('€10.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getAllByText('€0.00')).toHaveLength(2);
  });

  it('performs zero writes — no fetch calls at all from interactions (AC #5)', () => {
    mockUseWhatIf.mockReturnValue(hookResult({ data: CONTEXT }));
    renderWithChakra(<WhatIfSimulator />);

    const slider = screen.getByLabelText('Reduce Dining spending by percentage');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows the empty state when there is no spending history', () => {
    mockUseWhatIf.mockReturnValue(
      hookResult({ data: { hasData: false, categories: [], subscriptions: [], goal: null } })
    );
    renderWithChakra(<WhatIfSimulator />);

    expect(
      screen.getByText('Once you have spending history, simulate changes here.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('shows the error state only when nothing is cached', () => {
    mockUseWhatIf.mockReturnValue(hookResult({ error: new Error('boom') }));
    renderWithChakra(<WhatIfSimulator />);
    expect(screen.getByText('Unable to load the simulator.')).toBeInTheDocument();

    // Stale data renders through a transient error (14-3 lesson)
    mockUseWhatIf.mockReturnValue(hookResult({ data: CONTEXT, error: new Error('boom') }));
    renderWithChakra(<WhatIfSimulator />);
    expect(screen.getByText('Dining')).toBeInTheDocument();
  });
});
