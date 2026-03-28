/**
 * GoalProgress Component Tests
 * Story 11.5: Savings Goals (Code Review L3 fix)
 *
 * Tests the progress bar, "Completed!" badge, currency formatting,
 * and percentage calculation logic.
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { GoalProgress } from '@/components/goals/GoalProgress';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      completed: 'Completed!',
      progress: `${params?.percentage ?? 0}% complete`,
    };
    return map[key] ?? key;
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

// ============================================================================
// TESTS
// ============================================================================

describe('GoalProgress', () => {
  it('renders current and target amounts', () => {
    renderWithChakra(
      <GoalProgress currentAmount={250} targetAmount={1000} currency="EUR" />
    );
    expect(screen.getByText(/250/)).toBeInTheDocument();
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
  });

  it('shows percentage text when not completed', () => {
    renderWithChakra(
      <GoalProgress currentAmount={250} targetAmount={1000} currency="EUR" />
    );
    expect(screen.getByText('25% complete')).toBeInTheDocument();
  });

  it('shows "Completed!" badge when current_amount equals target_amount', () => {
    renderWithChakra(
      <GoalProgress currentAmount={1000} targetAmount={1000} currency="EUR" />
    );
    expect(screen.getByText('Completed!')).toBeInTheDocument();
    expect(screen.queryByText(/% complete/)).not.toBeInTheDocument();
  });

  it('shows "Completed!" badge when current_amount exceeds target_amount', () => {
    renderWithChakra(
      <GoalProgress currentAmount={1200} targetAmount={1000} currency="EUR" />
    );
    expect(screen.getByText('Completed!')).toBeInTheDocument();
  });

  it('shows 0% when current amount is zero', () => {
    renderWithChakra(
      <GoalProgress currentAmount={0} targetAmount={1000} currency="EUR" />
    );
    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });

  it('formats amounts with empty currency fallback', () => {
    renderWithChakra(
      <GoalProgress currentAmount={250} targetAmount={1000} currency="" />
    );
    expect(screen.getByText(/250\.00/)).toBeInTheDocument();
    expect(screen.getByText(/1000\.00/)).toBeInTheDocument();
  });

  it('caps percentage at 100 when over-funded', () => {
    renderWithChakra(
      <GoalProgress currentAmount={1500} targetAmount={1000} currency="EUR" />
    );
    // Over 100% → shows Completed!, not "150% complete"
    expect(screen.getByText('Completed!')).toBeInTheDocument();
    expect(screen.queryByText(/150%/)).not.toBeInTheDocument();
  });
});
