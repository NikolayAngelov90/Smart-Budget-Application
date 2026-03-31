/**
 * GoalCard Component Tests
 * Story 11.5: Savings Goals
 * Story 11.6: Goal Milestone Celebrations (milestone badge tests)
 *
 * Task 10.5: Unit tests for GoalCard component
 * - Renders goal name, progress, deadline
 * - Opens edit/contribute/delete modals
 * - Delete confirmation flow
 * - Milestone badge display
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { GoalCard } from '@/components/goals/GoalCard';
import type { Goal } from '@/types/database.types';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
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
    };
    if (key === 'milestoneBadge') {
      return `${String(params?.percentage ?? '')}% milestone reached`;
    }
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

jest.mock('@/components/goals/MilestoneOverlay', () => ({
  // Always mounted (never null) so aria-live pre-exists in DOM; shows content only when open
  MilestoneOverlay: ({ isOpen, milestone }: { isOpen: boolean; milestone: number }) => (
    <div data-testid="milestone-overlay-container" data-open={String(isOpen)}>
      {isOpen && <span>{milestone}% overlay</span>}
    </div>
  ),
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
  milestones_celebrated: [],
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

  it('does not show milestone badge when milestones_celebrated is empty', () => {
    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );
    expect(screen.queryByTestId('milestone-badge')).not.toBeInTheDocument();
  });

  it('shows milestone badge with correct text when milestones_celebrated has one entry', () => {
    const goal = { ...sampleGoal, milestones_celebrated: [50] };
    renderWithChakra(
      <GoalCard goal={goal} currency="EUR" onMutate={onMutate} />
    );
    expect(screen.getByTestId('milestone-badge')).toBeInTheDocument();
    expect(screen.getByText('50% milestone reached')).toBeInTheDocument();
  });

  it('shows highest milestone when multiple milestones celebrated', () => {
    const goal = { ...sampleGoal, milestones_celebrated: [25, 50] };
    renderWithChakra(
      <GoalCard goal={goal} currency="EUR" onMutate={onMutate} />
    );
    expect(screen.getByText('50% milestone reached')).toBeInTheDocument();
    expect(screen.queryByText('25% milestone reached')).not.toBeInTheDocument();
  });

  // L4: always-mounted guard
  it('always mounts MilestoneOverlay (closed) so aria-live region pre-exists in DOM', () => {
    renderWithChakra(
      <GoalCard goal={sampleGoal} currency="EUR" onMutate={onMutate} />
    );
    const container = screen.getByTestId('milestone-overlay-container');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('data-open', 'false');
  });

  // M1: milestone trigger detection
  it('opens milestone overlay and calls celebrate API when goal crosses 50% threshold', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    // Start at 40% with 25% already celebrated — next uncelebrated threshold is 50%
    const goalBelow = { ...sampleGoal, current_amount: 400, target_amount: 1000, milestones_celebrated: [25] };
    const goalAbove = { ...sampleGoal, current_amount: 550, target_amount: 1000, milestones_celebrated: [25] };

    const { rerender } = renderWithChakra(
      <GoalCard goal={goalBelow} currency="EUR" onMutate={onMutate} />
    );

    rerender(
      <ChakraProvider>
        <GoalCard goal={goalAbove} currency="EUR" onMutate={onMutate} />
      </ChakraProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('50% overlay')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/goals/goal-1/celebrate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ threshold: 50 }),
      })
    );
  });

  it('fires only the first uncelebrated threshold when multiple are crossed at once', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    // 20% → 80%: crosses 25, 50, 75 — only 25 (first in loop) fires
    const goalBelow = { ...sampleGoal, current_amount: 200, target_amount: 1000, milestones_celebrated: [] };
    const goalAbove = { ...sampleGoal, current_amount: 800, target_amount: 1000, milestones_celebrated: [] };

    const { rerender } = renderWithChakra(
      <GoalCard goal={goalBelow} currency="EUR" onMutate={onMutate} />
    );

    rerender(
      <ChakraProvider>
        <GoalCard goal={goalAbove} currency="EUR" onMutate={onMutate} />
      </ChakraProvider>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/goals/goal-1/celebrate',
      expect.objectContaining({ body: JSON.stringify({ threshold: 25 }) })
    );
    expect(screen.getByText('25% overlay')).toBeInTheDocument();
  });
});
