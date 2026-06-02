/**
 * FinancialDisclaimer Component Tests
 * Story 12.7 (plan 12.1): Financial Advice Disclaimers — FR39
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { FinancialDisclaimer } from '@/components/ai/FinancialDisclaimer';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      compact: 'For educational purposes only — not licensed financial advice.',
      full: 'Smart Budget\'s AI-generated insights ... not licensed financial advice ... Consult a qualified financial professional before making important financial decisions.',
      settingsHeading: 'About AI Insights',
    };
    return map[key] ?? key;
  },
}));

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

describe('FinancialDisclaimer', () => {
  describe('compact variant (default)', () => {
    it('renders the compact disclaimer text', () => {
      renderWithChakra(<FinancialDisclaimer />);
      expect(
        screen.getByText(/not licensed financial advice/i)
      ).toBeInTheDocument();
    });

    it('mentions educational purposes', () => {
      renderWithChakra(<FinancialDisclaimer variant="compact" />);
      expect(screen.getByText(/educational purposes only/i)).toBeInTheDocument();
    });

    it('exposes the disclaimer as a note role for accessibility', () => {
      renderWithChakra(<FinancialDisclaimer />);
      expect(screen.getByRole('note')).toBeInTheDocument();
    });
  });

  describe('full variant', () => {
    it('renders the full disclaimer text', () => {
      renderWithChakra(<FinancialDisclaimer variant="full" />);
      expect(
        screen.getByText(/Consult a qualified financial professional/i)
      ).toBeInTheDocument();
    });

    it('renders inside an accessible note region', () => {
      renderWithChakra(<FinancialDisclaimer variant="full" />);
      expect(screen.getByRole('note')).toBeInTheDocument();
    });
  });
});
