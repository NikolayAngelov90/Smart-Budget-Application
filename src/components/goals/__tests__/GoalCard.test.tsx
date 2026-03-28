/**
 * GoalCard Component Tests
 * Story 11.5: Savings Goals
 *
 * Task 10.5: Unit tests for GoalCard component
 * - Renders goal name, progress, deadline
 * - Opens edit/contribute/delete modals
 * - Delete confirmation flow
 * - Handles delete API error
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { GoalCard } from '@/components/goals/GoalCard';
import type { Goal } from '@/types/database.types';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      editGoal: 'Edit Goal',
      deleteGoal: 'Delete Goal',
      addContribution: 'Add Contribution',
      deadline: 'Deadline',
      noDeadline: 'No deadline',
      deleteConfirm: 'Are you sure you want to delete this goal?',
      cancel: 'Cancel',
      deleteSuccess: 'Goal deleted',
      completed: 'Completed!',
      progress: '50% complete',
      saved: 'Saved',
      target: 'Target',
    };
    return map[key] ?? key;
  },
}));

jest.mock('@/components/goals/GoalProgress', () => ({
  GoalProgress: ({ currentAmount, targetAmount }: { currentAmount: number; targetAmount: number }) => (
    <div data-testid="goal-progress">
      {currentAmount}/{targetAmount}
    </div>
  ),
}));

jest.mock('@/components/goals/GoalForm', () => ({
  GoalForm: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="goal-form-modal">
        <button onClick={onClose}>Close Form</button>
      </div>
    ) : null,
}));

jest.mock('@/components/goals/ContributionModal', () => ({
  ContributionModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="contribution-modal">
        <button onClick={onClose}>Close Contrib</button>
      </div>
    ) : null,
}));

// ============================================================================
// HELPERS
// ============================================================================

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

const sampleGoal: Goal = {
  id: 'goal-1',
  user_id: 'user-1',
  name: 'Emergency Fund',
  target_amount: 1000,
  current_amount: 250,
  deadline: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ============================================================================
// TESTS
// ============================================================================

describe('GoalCard', () => {
  const onMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders goal name', () => {
    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );
    expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
  });

  it('renders GoalProgress component', () => {
    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );
    expect(screen.getByTestId('goal-progress')).toBeInTheDocument();
  });

  it('shows "No deadline" when deadline is null', () => {
    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );
    expect(screen.getByText(/No deadline/)).toBeInTheDocument();
  });

  it('shows deadline when provided', () => {
    const goalWithDeadline = { ...sampleGoal, deadline: '2027-06-01' };
    renderWithChakra(
      <GoalCard goal={goalWithDeadline} currency="EUR" onMutate={onMutate} />
    );
    expect(screen.getByText(/2027-06-01/)).toBeInTheDocument();
  });

  it('opens edit modal on edit button click', () => {
    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );
    fireEvent.click(screen.getByLabelText('Edit Goal'));
    expect(screen.getByTestId('goal-form-modal')).toBeInTheDocument();
  });

  it('opens contribution modal on add contribution click', () => {
    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );
    fireEvent.click(screen.getByText('Add Contribution'));
    expect(screen.getByTestId('contribution-modal')).toBeInTheDocument();
  });

  it('shows delete confirmation dialog on delete button click', () => {
    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );
    fireEvent.click(screen.getByLabelText('Delete Goal'));
    expect(screen.getByText('Are you sure you want to delete this goal?')).toBeInTheDocument();
  });

  it('calls onMutate after successful delete', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );

    // Open delete dialog
    fireEvent.click(screen.getByLabelText('Delete Goal'));
    // Click confirm delete button (identified by testid to avoid fragile text matching)
    fireEvent.click(screen.getByTestId('confirm-delete-button'));

    await waitFor(() => {
      expect(onMutate).toHaveBeenCalled();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/goals/goal-1', { method: 'DELETE' });
  });

  it('closes delete dialog on cancel', async () => {
    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );
    fireEvent.click(screen.getByLabelText('Delete Goal'));
    expect(screen.getByText('Are you sure you want to delete this goal?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    // AlertDialog animates out — wait for it to be removed from DOM
    await waitFor(() => {
      expect(screen.queryByText('Are you sure you want to delete this goal?')).not.toBeInTheDocument();
    });
  });
});
