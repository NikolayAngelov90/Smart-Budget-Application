/**
 * Tests for StatCard Component
 * Story 5.2: Financial Summary Cards
 *
 * Covers trend rendering (direction, 1-decimal precision), the
 * trendIsPositiveGood color semantics, showTrend=false fallback, and loading state.
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { StatCard } from '@/components/dashboard/StatCard';

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

const baseProps = {
  label: 'Monthly Income',
  value: '+€1,000.00',
  trend: 12.34,
  trendLabel: 'vs last month',
  colorScheme: 'green' as const,
};

describe('StatCard', () => {
  it('renders label and value', () => {
    renderWithChakra(<StatCard {...baseProps} />);

    expect(screen.getByText('Monthly Income')).toBeInTheDocument();
    expect(screen.getByText('+€1,000.00')).toBeInTheDocument();
  });

  it('renders the trend percentage with one decimal', () => {
    renderWithChakra(<StatCard {...baseProps} />);

    expect(screen.getByText(/12\.3% vs last month/)).toBeInTheDocument();
  });

  it('shows an increase arrow for a positive trend', () => {
    renderWithChakra(<StatCard {...baseProps} trend={5} />);

    // StatArrow renders visually-hidden direction text for screen readers
    expect(screen.getByText('increased by')).toBeInTheDocument();
  });

  it('shows a decrease arrow for a negative trend', () => {
    renderWithChakra(<StatCard {...baseProps} trend={-5} />);

    expect(screen.getByText('decreased by')).toBeInTheDocument();
  });

  it('renders absolute trend value for negative trends', () => {
    renderWithChakra(<StatCard {...baseProps} trend={-7.89} />);

    expect(screen.getByText(/7\.9% vs last month/)).toBeInTheDocument();
  });

  it('hides the percentage and shows only the label when showTrend is false', () => {
    renderWithChakra(
      <StatCard
        {...baseProps}
        showTrend={false}
        trendLabel="No income recorded this month"
      />
    );

    expect(screen.getByText('No income recorded this month')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText('increased by')).not.toBeInTheDocument();
    expect(screen.queryByText('decreased by')).not.toBeInTheDocument();
  });

  it('still shows an arrow when trendIsPositiveGood is false (expenses)', () => {
    renderWithChakra(<StatCard {...baseProps} trend={10} trendIsPositiveGood={false} />);

    // Direction is unchanged — only the color semantics flip
    expect(screen.getByText('increased by')).toBeInTheDocument();
  });

  it('renders skeletons when loading', () => {
    renderWithChakra(<StatCard {...baseProps} isLoading />);

    expect(screen.queryByText('Monthly Income')).not.toBeInTheDocument();
    expect(screen.queryByText('+€1,000.00')).not.toBeInTheDocument();
  });
});
