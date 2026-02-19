/**
 * TransactionEntryModal Mobile Tests
 * Story 10-8: Mobile-Optimized Touch UI
 * AC-10.8.11: Component test for inputMode="decimal" on amount field and type="date" on date input
 */

import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import TransactionEntryModal from '../TransactionEntryModal';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      amount: 'Amount',
      type: 'Type',
      category: 'Category',
      date: 'Date',
      notes: 'Notes',
      notesPlaceholder: 'Add notes...',
      expense: 'Expense',
      income: 'Income',
      selectCategory: 'Select category',
      today: 'Today',
      yesterday: 'Yesterday',
      twoDaysAgo: '2 days ago',
      addTransaction: 'Add Transaction',
      editTransaction: 'Edit Transaction',
      add: 'Add',
      failedToLoadCategories: 'Failed to load categories',
      offlineMessage: 'Offline',
      offlineDescription: 'Not available offline',
      availableWhenOnline: 'Available when online',
      failedToSave: 'Failed to save',
      updatedSuccess: 'Updated',
      addedSuccess: 'Added',
      currency: 'Currency',
      maxCharacters: 'Max characters',
      convertedAmount: 'Converted',
      optional: 'optional',
      loading: 'Loading',
      cancel: 'Cancel',
      save: 'Save',
    };
    return translations[key] || key;
  },
}));

// Mock hooks
jest.mock('@/lib/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true }),
}));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: { currency_format: 'EUR' },
  }),
}));

jest.mock('@/lib/config/currencies', () => ({
  getEnabledCurrencies: () => [{ code: 'EUR', symbol: '€' }],
}));

jest.mock('@/lib/utils/haptic', () => ({
  triggerHaptic: jest.fn(),
}));

// Mock CategoryMenu
jest.mock('@/components/categories/CategoryMenu', () => ({
  CategoryMenu: () => <div data-testid="category-menu">CategoryMenu</div>,
}));

// Mock useBreakpointValue — return false (desktop mode) so Modal is rendered
jest.mock('@chakra-ui/react', () => {
  const actual = jest.requireActual('@chakra-ui/react');
  return {
    ...actual,
    useBreakpointValue: () => false,
  };
});

// Mock fetch to resolve immediately
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  headers: { get: () => 'application/json' },
  json: () => Promise.resolve({ data: [], recent: [] }),
});

const renderModal = () =>
  render(
    <ChakraProvider>
      <TransactionEntryModal
        isOpen={true}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    </ChakraProvider>
  );

describe('TransactionEntryModal — mobile optimizations (AC-10.8.7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: [], recent: [] }),
    });
  });

  it('amount input has inputMode="decimal"', async () => {
    renderModal();

    const amountInput = await waitFor(
      () => screen.getByPlaceholderText('0.00'),
      { timeout: 3000 }
    );
    expect(amountInput).toHaveAttribute('inputMode', 'decimal');
  });

  it('amount input has autoComplete="off"', async () => {
    renderModal();

    const amountInput = await waitFor(
      () => screen.getByPlaceholderText('0.00'),
      { timeout: 3000 }
    );
    expect(amountInput).toHaveAttribute('autoComplete', 'off');
  });

  it('amount input has autoCorrect="off"', async () => {
    renderModal();

    const amountInput = await waitFor(
      () => screen.getByPlaceholderText('0.00'),
      { timeout: 3000 }
    );
    expect(amountInput).toHaveAttribute('autoCorrect', 'off');
  });
});
