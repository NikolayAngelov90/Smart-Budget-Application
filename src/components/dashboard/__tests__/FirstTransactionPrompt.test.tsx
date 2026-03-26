/**
 * Tests for FirstTransactionPrompt Component
 * Story 11.1: Streamlined Onboarding Flow
 *
 * Test Coverage:
 * AC-2: Prominent prompt when 0 transactions
 * AC-4: CTA opens TransactionEntryModal
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { FirstTransactionPrompt } from '@/components/dashboard/FirstTransactionPrompt';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      firstTransactionTitle: 'Add Your First Transaction',
      firstTransactionDescription: 'Start tracking your finances by adding your first income or expense.',
      firstTransactionCta: 'Add Transaction',
    };
    return translations[key] || key;
  },
}));

// Mock @chakra-ui/icons
jest.mock('@chakra-ui/icons', () => ({
  AddIcon: () => <span data-testid="add-icon" />,
}));

const renderWithChakra = (component: React.ReactElement) => {
  return render(<ChakraProvider>{component}</ChakraProvider>);
};

describe('FirstTransactionPrompt', () => {
  const defaultProps = {
    onAddTransaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AC-2: Visible when 0 transactions', () => {
    it('renders title and description', () => {
      renderWithChakra(<FirstTransactionPrompt {...defaultProps} />);

      expect(screen.getByText('Add Your First Transaction')).toBeInTheDocument();
      expect(
        screen.getByText('Start tracking your finances by adding your first income or expense.')
      ).toBeInTheDocument();
    });

    it('renders the CTA button', () => {
      renderWithChakra(<FirstTransactionPrompt {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Add Transaction' })).toBeInTheDocument();
    });

    it('renders the add icon', () => {
      renderWithChakra(<FirstTransactionPrompt {...defaultProps} />);

      expect(screen.getAllByTestId('add-icon').length).toBeGreaterThan(0);
    });
  });

  describe('AC-4: CTA triggers transaction entry', () => {
    it('calls onAddTransaction when CTA button is clicked', () => {
      renderWithChakra(<FirstTransactionPrompt {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      expect(defaultProps.onAddTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithChakra(<FirstTransactionPrompt {...defaultProps} />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Add Your First Transaction');
    });

    it('has accessible button label', () => {
      renderWithChakra(<FirstTransactionPrompt {...defaultProps} />);

      const button = screen.getByRole('button', { name: 'Add Transaction' });
      expect(button).toBeInTheDocument();
    });
  });
});
