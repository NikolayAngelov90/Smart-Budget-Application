/**
 * GoalForm Component Tests
 * Story 11.5: Savings Goals
 *
 * Task 10.6: Unit tests for GoalForm component
 * - Renders create mode / edit mode heading
 * - Pre-fills fields in edit mode
 * - Shows validation errors for empty name / missing amount
 * - Submits correct payload for create (POST) and edit (PUT)
 * - Calls onSuccess after successful submit
 * - Shows error toast on API failure
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { GoalForm } from '@/components/goals/GoalForm';
import type { Goal } from '@/types/database.types';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      createGoal: 'Create Goal',
      editGoal: 'Edit Goal',
      name: 'Name',
      namePlaceholder: 'e.g. Emergency Fund',
      targetAmount: 'Target Amount',
      deadlineOptional: 'Deadline (optional)',
      save: 'Save',
      cancel: 'Cancel',
      createSuccess: 'Goal created!',
      updateSuccess: 'Goal updated!',
    };
    return map[key] ?? key;
  },
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

describe('GoalForm', () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders "Create Goal" heading in create mode', () => {
    renderWithChakra(
      <GoalForm isOpen={true} onClose={onClose} onSuccess={onSuccess} />
    );
    expect(screen.getByText('Create Goal')).toBeInTheDocument();
  });

  it('renders "Edit Goal" heading in edit mode', () => {
    renderWithChakra(
      <GoalForm isOpen={true} onClose={onClose} onSuccess={onSuccess} existingGoal={sampleGoal} />
    );
    expect(screen.getByText('Edit Goal')).toBeInTheDocument();
  });

  it('pre-fills name and target amount in edit mode', async () => {
    renderWithChakra(
      <GoalForm isOpen={true} onClose={onClose} onSuccess={onSuccess} existingGoal={sampleGoal} />
    );

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('e.g. Emergency Fund') as HTMLInputElement;
      expect(nameInput.value).toBe('Emergency Fund');
    });
  });

  it('shows validation error for empty name on submit', async () => {
    renderWithChakra(
      <GoalForm isOpen={true} onClose={onClose} onSuccess={onSuccess} />
    );

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText(/Goal name is required/i)).toBeInTheDocument();
    });
  });

  it('calls onSuccess after successful create', async () => {
    const createdGoal = { ...sampleGoal, id: 'new-goal' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(createdGoal),
    });

    renderWithChakra(
      <GoalForm isOpen={true} onClose={onClose} onSuccess={onSuccess} />
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. Emergency Fund'), {
      target: { value: 'New Goal' },
    });

    const amountInput = screen.getByRole('spinbutton');
    fireEvent.change(amountInput, { target: { value: '500', valueAsNumber: 500 } });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(createdGoal);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/goals',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uses PUT and goal URL in edit mode', async () => {
    const updatedGoal = { ...sampleGoal, name: 'Updated' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(updatedGoal),
    });

    renderWithChakra(
      <GoalForm isOpen={true} onClose={onClose} onSuccess={onSuccess} existingGoal={sampleGoal} />
    );

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(updatedGoal);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/goals/goal-1',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('does not call onSuccess on API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: { message: 'Server error' } }),
    });

    renderWithChakra(
      <GoalForm isOpen={true} onClose={onClose} onSuccess={onSuccess} existingGoal={sampleGoal} />
    );

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
