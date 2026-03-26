/**
 * Tests for SubscriptionGraveyard Component
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * Task 7.5: Unit tests for SubscriptionGraveyard component
 * Task 7.7: Progressive disclosure gating test
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SubscriptionGraveyard } from '@/components/subscriptions/SubscriptionGraveyard';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: 'Subscription Graveyard',
      subtitle: 'Recurring charges detected from your transaction history',
      emptyState: 'No recurring charges detected yet',
      loading: 'Loading subscriptions...',
      actionDismissed: 'Subscription dismissed',
      actionKept: 'Subscription marked as kept',
      actionError: 'Failed to update subscription',
      statusActive: 'Active',
      statusUnused: 'Potentially Unused',
      frequencyMonthly: 'Monthly',
      lastCharge: 'Last charge',
      dismiss: 'Dismiss',
      keep: 'Keep',
    };
    return translations[key] || key;
  },
}));

// Mock the useSubscriptions hook
const mockMutate = jest.fn();
jest.mock('@/lib/hooks/useSubscriptions', () => ({
  useSubscriptions: jest.fn(),
}));

import { useSubscriptions } from '@/lib/hooks/useSubscriptions';
const mockUseSubscriptions = useSubscriptions as jest.MockedFunction<typeof useSubscriptions>;

// Mock fetch for status update calls
global.fetch = jest.fn();

const renderWithChakra = (component: React.ReactElement) => {
  return render(<ChakraProvider>{component}</ChakraProvider>);
};

describe('SubscriptionGraveyard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
  });

  describe('Progressive disclosure (AC #6, Task 7.7)', () => {
    it('renders nothing when user has no history and not loading', () => {
      mockUseSubscriptions.mockReturnValue({
        subscriptions: [],
        hasHistory: false,
        isLoading: false,
        error: undefined,
        mutate: mockMutate,
      });

      renderWithChakra(<SubscriptionGraveyard />);
      expect(screen.queryByText('Subscription Graveyard')).not.toBeInTheDocument();
    });

    it('shows loading skeleton while data is loading', () => {
      mockUseSubscriptions.mockReturnValue({
        subscriptions: [],
        hasHistory: false,
        isLoading: true,
        error: undefined,
        mutate: mockMutate,
      });

      renderWithChakra(<SubscriptionGraveyard />);
      // Skeleton elements should be present
      const skeletons = document.querySelectorAll('[class*="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty state (AC #3)', () => {
    it('shows empty state message when has history but no subscriptions', () => {
      mockUseSubscriptions.mockReturnValue({
        subscriptions: [],
        hasHistory: true,
        isLoading: false,
        error: undefined,
        mutate: mockMutate,
      });

      renderWithChakra(<SubscriptionGraveyard />);
      expect(screen.getByText('No recurring charges detected yet')).toBeInTheDocument();
    });
  });

  describe('Subscription list (AC #3)', () => {
    it('renders title and subtitle', () => {
      mockUseSubscriptions.mockReturnValue({
        subscriptions: [
          {
            id: 'sub-1',
            user_id: 'user-1',
            merchant_pattern: 'netflix',
            estimated_amount: 9.99,
            currency: 'EUR',
            frequency: 'monthly',
            last_seen_at: '2026-03-15T00:00:00Z',
            status: 'active',
            created_at: '',
            updated_at: '',
          },
        ],
        hasHistory: true,
        isLoading: false,
        error: undefined,
        mutate: mockMutate,
      });

      renderWithChakra(<SubscriptionGraveyard />);
      expect(screen.getByText('Subscription Graveyard')).toBeInTheDocument();
      expect(screen.getByText('Recurring charges detected from your transaction history')).toBeInTheDocument();
    });

    it('renders subscription items', () => {
      mockUseSubscriptions.mockReturnValue({
        subscriptions: [
          {
            id: 'sub-1',
            user_id: 'user-1',
            merchant_pattern: 'netflix',
            estimated_amount: 9.99,
            currency: 'EUR',
            frequency: 'monthly',
            last_seen_at: '2026-03-15T00:00:00Z',
            status: 'active',
            created_at: '',
            updated_at: '',
          },
          {
            id: 'sub-2',
            user_id: 'user-1',
            merchant_pattern: 'spotify',
            estimated_amount: 4.99,
            currency: 'EUR',
            frequency: 'monthly',
            last_seen_at: '2026-03-10T00:00:00Z',
            status: 'unused',
            created_at: '',
            updated_at: '',
          },
        ],
        hasHistory: true,
        isLoading: false,
        error: undefined,
        mutate: mockMutate,
      });

      renderWithChakra(<SubscriptionGraveyard />);
      expect(screen.getByText('netflix')).toBeInTheDocument();
      expect(screen.getByText('spotify')).toBeInTheDocument();
    });
  });

  describe('User actions (AC #4)', () => {
    it('calls fetch with dismiss status when dismiss button clicked', async () => {
      mockUseSubscriptions.mockReturnValue({
        subscriptions: [
          {
            id: 'sub-1',
            user_id: 'user-1',
            merchant_pattern: 'netflix',
            estimated_amount: 9.99,
            currency: 'EUR',
            frequency: 'monthly',
            last_seen_at: '2026-03-15T00:00:00Z',
            status: 'active',
            created_at: '',
            updated_at: '',
          },
        ],
        hasHistory: true,
        isLoading: false,
        error: undefined,
        mutate: mockMutate,
      });

      renderWithChakra(<SubscriptionGraveyard />);
      fireEvent.click(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/subscriptions/sub-1',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ status: 'dismissed' }),
          })
        );
      });
    });

    it('calls fetch with kept status when keep button clicked', async () => {
      mockUseSubscriptions.mockReturnValue({
        subscriptions: [
          {
            id: 'sub-1',
            user_id: 'user-1',
            merchant_pattern: 'netflix',
            estimated_amount: 9.99,
            currency: 'EUR',
            frequency: 'monthly',
            last_seen_at: '2026-03-15T00:00:00Z',
            status: 'active',
            created_at: '',
            updated_at: '',
          },
        ],
        hasHistory: true,
        isLoading: false,
        error: undefined,
        mutate: mockMutate,
      });

      renderWithChakra(<SubscriptionGraveyard />);
      fireEvent.click(screen.getByText('Keep'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/subscriptions/sub-1',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ status: 'kept' }),
          })
        );
      });
    });

    it('calls mutate after successful status update', async () => {
      mockUseSubscriptions.mockReturnValue({
        subscriptions: [
          {
            id: 'sub-1',
            user_id: 'user-1',
            merchant_pattern: 'netflix',
            estimated_amount: 9.99,
            currency: 'EUR',
            frequency: 'monthly',
            last_seen_at: '2026-03-15T00:00:00Z',
            status: 'active',
            created_at: '',
            updated_at: '',
          },
        ],
        hasHistory: true,
        isLoading: false,
        error: undefined,
        mutate: mockMutate,
      });

      renderWithChakra(<SubscriptionGraveyard />);
      fireEvent.click(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });
    });
  });

  describe('Error handling', () => {
    it('renders nothing when there is an error', () => {
      mockUseSubscriptions.mockReturnValue({
        subscriptions: [],
        hasHistory: true,
        isLoading: false,
        error: new Error('Failed to fetch'),
        mutate: mockMutate,
      });

      renderWithChakra(<SubscriptionGraveyard />);
      expect(screen.queryByText('Subscription Graveyard')).not.toBeInTheDocument();
    });
  });
});
