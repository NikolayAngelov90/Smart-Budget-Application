/**
 * Tests for OnboardingModal Component
 * Story 11.1: Streamlined Onboarding Flow
 *
 * Test Coverage:
 * AC-1: Single-step personalization with display name and currency
 * AC-3: Skip functionality
 * AC-5: Quick completion flow
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { OnboardingModal } from '@/components/common/OnboardingModal';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      onboarding: {
        welcome: 'Welcome!',
        personalizeDescription: 'Personalize your experience',
        displayNameLabel: 'Display Name',
        displayNamePlaceholder: 'Enter your name',
        currencyLabel: 'Preferred Currency',
        getStarted: 'Get Started',
        saving: 'Saving...',
      },
      common: {
        skip: 'Skip',
      },
    };
    return translations[namespace]?.[key] || key;
  },
}));

// Mock currencies config
jest.mock('@/lib/config/currencies', () => ({
  SUPPORTED_CURRENCIES: [
    { code: 'EUR', symbol: '€', name: 'Euro', enabled: true },
    { code: 'USD', symbol: '$', name: 'US Dollar', enabled: true },
  ],
  getEnabledCurrencies: () => [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
  ],
  DEFAULT_CURRENCY: 'EUR',
}));

const renderWithChakra = (component: React.ReactElement) => {
  return render(<ChakraProvider>{component}</ChakraProvider>);
};

describe('OnboardingModal', () => {
  const defaultProps = {
    isOpen: true,
    onComplete: jest.fn(),
    onSkip: jest.fn(),
    defaultDisplayName: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AC-1: Single-step personalization', () => {
    it('renders display name input and currency selector', () => {
      renderWithChakra(<OnboardingModal {...defaultProps} />);

      expect(screen.getByText('Welcome!')).toBeInTheDocument();
      expect(screen.getByText('Personalize your experience')).toBeInTheDocument();
      expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Preferred Currency')).toBeInTheDocument();
    });

    it('pre-fills display name from OAuth metadata', () => {
      renderWithChakra(
        <OnboardingModal {...defaultProps} defaultDisplayName="John Doe" />
      );

      const input = screen.getByLabelText('Display Name') as HTMLInputElement;
      expect(input.value).toBe('John Doe');
    });

    it('defaults currency to EUR', () => {
      renderWithChakra(<OnboardingModal {...defaultProps} />);

      const select = screen.getByLabelText('Preferred Currency') as HTMLSelectElement;
      expect(select.value).toBe('EUR');
    });

    it('shows available currencies in dropdown', () => {
      renderWithChakra(<OnboardingModal {...defaultProps} />);

      expect(screen.getByText('€ Euro (EUR)')).toBeInTheDocument();
      expect(screen.getByText('$ US Dollar (USD)')).toBeInTheDocument();
    });
  });

  describe('AC-3: Skip functionality', () => {
    it('renders skip button', () => {
      renderWithChakra(<OnboardingModal {...defaultProps} />);

      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('calls onSkip when skip button is clicked', () => {
      renderWithChakra(<OnboardingModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Skip'));

      expect(defaultProps.onSkip).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-5: Completion flow', () => {
    it('calls onComplete with form data when Get Started is clicked', async () => {
      renderWithChakra(<OnboardingModal {...defaultProps} />);

      const nameInput = screen.getByLabelText('Display Name');
      await userEvent.type(nameInput, 'Jane Smith');

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalledWith({
          displayName: 'Jane Smith',
          currencyFormat: 'EUR',
        });
      });
    });

    it('calls onComplete with empty displayName when none provided', async () => {
      renderWithChakra(<OnboardingModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalledWith({
          displayName: undefined,
          currencyFormat: 'EUR',
        });
      });
    });

    it('calls onComplete with selected currency', async () => {
      renderWithChakra(<OnboardingModal {...defaultProps} />);

      const select = screen.getByLabelText('Preferred Currency');
      fireEvent.change(select, { target: { value: 'USD' } });

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalledWith({
          displayName: undefined,
          currencyFormat: 'USD',
        });
      });
    });
  });

  describe('Rendering states', () => {
    it('does not render when isOpen is false', () => {
      renderWithChakra(<OnboardingModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Welcome!')).not.toBeInTheDocument();
    });

    it('has accessible labels on buttons', () => {
      renderWithChakra(<OnboardingModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
    });
  });
});
