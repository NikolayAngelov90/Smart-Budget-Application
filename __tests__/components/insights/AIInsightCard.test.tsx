/**
 * Unit tests for AIInsightCard Component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { AIInsightCard } from '@/components/insights/AIInsightCard';
import type { Insight } from '@/types/database.types';

// Mock Chakra UI
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
}));

// Helper to create mock insight
function createMockInsight(
  type: 'spending_increase' | 'budget_recommendation' | 'unusual_expense' | 'positive_reinforcement',
  priority: number = 3
): Insight {
  return {
    id: `insight-${type}`,
    user_id: 'user-1',
    type,
    title: `Test ${type} title`,
    description: 'Test description for insight',
    priority,
    is_dismissed: false,
    metadata: {},
    created_at: new Date().toISOString(),
  };
}

describe('AIInsightCard', () => {
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render insight with correct title and description', () => {
    const insight = createMockInsight('budget_recommendation');
    render(<AIInsightCard insight={insight} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Test budget_recommendation title')).toBeInTheDocument();
    expect(screen.getByText('Test description for insight')).toBeInTheDocument();
  });

  it('should render priority badge with correct label', () => {
    const insight = createMockInsight('spending_increase', 5);
    render(<AIInsightCard insight={insight} onDismiss={mockOnDismiss} />);

    expect(screen.getByText(/Priority 5 - Critical/i)).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', () => {
    const insight = createMockInsight('unusual_expense');
    render(<AIInsightCard insight={insight} onDismiss={mockOnDismiss} />);

    const dismissButton = screen.getByLabelText('Dismiss insight');
    fireEvent.click(dismissButton);

    expect(mockOnDismiss).toHaveBeenCalledWith(insight.id);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('should render different insight types with appropriate styling', () => {
    const types: Array<'spending_increase' | 'budget_recommendation' | 'unusual_expense' | 'positive_reinforcement'> = [
      'spending_increase',
      'budget_recommendation',
      'unusual_expense',
      'positive_reinforcement',
    ];

    types.forEach((type) => {
      const { container } = render(
        <AIInsightCard insight={createMockInsight(type)} onDismiss={mockOnDismiss} />
      );

      // Verify the card renders without crashing
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('should render all priority levels correctly', () => {
    const priorities = [
      { value: 5, label: 'Critical' },
      { value: 4, label: 'High' },
      { value: 3, label: 'Medium' },
      { value: 2, label: 'Low' },
      { value: 1, label: 'Info' },
    ];

    priorities.forEach(({ value, label }) => {
      const { rerender } = render(
        <AIInsightCard
          insight={createMockInsight('budget_recommendation', value)}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText(new RegExp(`Priority ${value} - ${label}`, 'i'))).toBeInTheDocument();

      rerender(<div />);
    });
  });

  it('should have accessible dismiss button', () => {
    const insight = createMockInsight('positive_reinforcement');
    render(<AIInsightCard insight={insight} onDismiss={mockOnDismiss} />);

    const dismissButton = screen.getByLabelText('Dismiss insight');
    expect(dismissButton).toBeInTheDocument();
    expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss insight');
  });
});
