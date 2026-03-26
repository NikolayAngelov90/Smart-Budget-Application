/**
 * Tests for SubscriptionItem Component
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * Task 7.6: Unit tests for SubscriptionItem component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider, Accordion } from '@chakra-ui/react';
import { SubscriptionItem } from '@/components/subscriptions/SubscriptionItem';
import type { DetectedSubscription } from '@/types/database.types';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      statusActive: 'Active',
      statusUnused: 'Potentially Unused',
      statusKept: 'Kept',
      statusDismissed: 'Dismissed',
      frequencyWeekly: 'Weekly',
      frequencyMonthly: 'Monthly',
      frequencyQuarterly: 'Quarterly',
      frequencyAnnual: 'Annual',
      lastCharge: 'Last charge',
      dismiss: 'Dismiss',
      keep: 'Keep',
    };
    return translations[key] || key;
  },
}));

const renderWithChakra = (component: React.ReactElement) => {
  return render(
    <ChakraProvider>
      <Accordion allowMultiple>{component}</Accordion>
    </ChakraProvider>
  );
};

const createSubscription = (overrides: Partial<DetectedSubscription> = {}): DetectedSubscription => ({
  id: 'sub-1',
  user_id: 'user-1',
  merchant_pattern: 'netflix',
  estimated_amount: 9.99,
  currency: 'EUR',
  frequency: 'monthly',
  last_seen_at: '2026-03-15T00:00:00Z',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-15T00:00:00Z',
  ...overrides,
});

describe('SubscriptionItem', () => {
  const defaultProps = {
    onUpdateStatus: jest.fn(),
    isUpdating: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders merchant name and amount', () => {
    const sub = createSubscription();
    renderWithChakra(
      <SubscriptionItem subscription={sub} {...defaultProps} />
    );

    expect(screen.getByText('netflix')).toBeInTheDocument();
    // Amount is formatted with Intl.NumberFormat
    expect(screen.getByText(/9\.99/)).toBeInTheDocument();
  });

  it('renders frequency label', () => {
    const sub = createSubscription({ frequency: 'monthly' });
    renderWithChakra(
      <SubscriptionItem subscription={sub} {...defaultProps} />
    );

    expect(screen.getByText(/Monthly/)).toBeInTheDocument();
  });

  it('renders active status badge', () => {
    const sub = createSubscription({ status: 'active' });
    renderWithChakra(
      <SubscriptionItem subscription={sub} {...defaultProps} />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders unused status badge', () => {
    const sub = createSubscription({ status: 'unused' });
    renderWithChakra(
      <SubscriptionItem subscription={sub} {...defaultProps} />
    );

    expect(screen.getByText('Potentially Unused')).toBeInTheDocument();
  });

  it('renders kept status badge', () => {
    const sub = createSubscription({ status: 'kept' });
    renderWithChakra(
      <SubscriptionItem subscription={sub} {...defaultProps} />
    );

    expect(screen.getByText('Kept')).toBeInTheDocument();
  });

  it('shows dismiss and keep buttons for active subscriptions', () => {
    const sub = createSubscription({ status: 'active' });
    renderWithChakra(
      <SubscriptionItem subscription={sub} {...defaultProps} />
    );

    expect(screen.getByText('Dismiss')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it('shows dismiss and keep buttons for unused subscriptions', () => {
    const sub = createSubscription({ status: 'unused' });
    renderWithChakra(
      <SubscriptionItem subscription={sub} {...defaultProps} />
    );

    expect(screen.getByText('Dismiss')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it('hides action buttons for kept subscriptions', () => {
    const sub = createSubscription({ status: 'kept' });
    renderWithChakra(
      <SubscriptionItem subscription={sub} {...defaultProps} />
    );

    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
    expect(screen.queryByText('Keep')).not.toBeInTheDocument();
  });

  it('calls onUpdateStatus with dismissed when dismiss is clicked', () => {
    const sub = createSubscription({ status: 'active' });
    const onUpdateStatus = jest.fn();
    renderWithChakra(
      <SubscriptionItem subscription={sub} onUpdateStatus={onUpdateStatus} isUpdating={false} />
    );

    fireEvent.click(screen.getByText('Dismiss'));
    expect(onUpdateStatus).toHaveBeenCalledWith('sub-1', 'dismissed');
  });

  it('calls onUpdateStatus with kept when keep is clicked', () => {
    const sub = createSubscription({ status: 'active' });
    const onUpdateStatus = jest.fn();
    renderWithChakra(
      <SubscriptionItem subscription={sub} onUpdateStatus={onUpdateStatus} isUpdating={false} />
    );

    fireEvent.click(screen.getByText('Keep'));
    expect(onUpdateStatus).toHaveBeenCalledWith('sub-1', 'kept');
  });

  it('disables buttons when isUpdating is true', () => {
    const sub = createSubscription({ status: 'active' });
    renderWithChakra(
      <SubscriptionItem subscription={sub} onUpdateStatus={jest.fn()} isUpdating={true} />
    );

    expect(screen.getByText('Dismiss').closest('button')).toBeDisabled();
    expect(screen.getByText('Keep').closest('button')).toBeDisabled();
  });

  it('has accessible aria-label on accordion button', () => {
    const sub = createSubscription();
    renderWithChakra(
      <SubscriptionItem subscription={sub} {...defaultProps} />
    );

    const button = screen.getByRole('button', { name: /netflix.*9\.99.*Monthly/i });
    expect(button).toBeInTheDocument();
  });
});
