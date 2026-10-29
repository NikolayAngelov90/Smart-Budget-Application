/**
 * TransactionEntryModal Mobile Tests
 * Story 10-8: Mobile-Optimized Touch UI
 * AC-10.8.11: Component test for inputMode="decimal" on amount field and type="date" on date input
 */

import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import TransactionEntryModal from '../TransactionEntryModal';

// Mock next-intl
const MOBILE_MESSAGES: Record<string, string> = {
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
/** A STABLE `t` — see TransactionEntryModal.composer.test.tsx for why. */
const mobileT = (key: string) => MOBILE_MESSAGES[key] || key;
jest.mock('next-intl', () => ({ useTranslations: () => mobileT }));

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
/** ONE STABLE object — a fresh `recent` array per call re-renders the modal. */
const EMPTY_CATEGORIES_RESPONSE = { data: [], recent: [] };

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  headers: { get: () => 'application/json' },
  json: () => Promise.resolve(EMPTY_CATEGORIES_RESPONSE),
});

const renderModal = () =>
  render(
    <ChakraProvider>
      <TransactionEntryModal isOpen={true} onClose={jest.fn()} onSuccess={jest.fn()} />
    </ChakraProvider>
  );

describe('TransactionEntryModal — mobile optimizations (AC-10.8.7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(EMPTY_CATEGORIES_RESPONSE),
    });
  });

  it('SETTLES: the categories fetch stops firing', async () => {
    // The same guard as the composer suite, for the same cause. See that file's
    // header: a fresh `t` per render churns `fetchCategories`'s identity, a
    // fresh response object per `json()` call re-renders on a new `recent`
    // identity, and TOGETHER they are a self-sustaining re-fetch loop. Neither
    // half alone does it — measured, both ways round.
    renderModal();
    await waitFor(() => screen.getByPlaceholderText('0.00'), { timeout: 3000 });

    const after = async (ms: number) => {
      await new Promise((r) => setTimeout(r, ms));
      return (global.fetch as jest.Mock).mock.calls.length;
    };

    const settled = await after(150);
    const later = await after(400);

    expect(later).toBe(settled);
    expect(settled).toBeGreaterThan(0);
  });

  it('amount input has inputMode="decimal"', async () => {
    renderModal();

    const amountInput = await waitFor(() => screen.getByPlaceholderText('0.00'), { timeout: 3000 });
    expect(amountInput).toHaveAttribute('inputMode', 'decimal');
  });

  it('amount input has autoComplete="off"', async () => {
    renderModal();

    const amountInput = await waitFor(() => screen.getByPlaceholderText('0.00'), { timeout: 3000 });
    expect(amountInput).toHaveAttribute('autoComplete', 'off');
  });

  it('amount input has autoCorrect="off"', async () => {
    renderModal();

    const amountInput = await waitFor(() => screen.getByPlaceholderText('0.00'), { timeout: 3000 });
    expect(amountInput).toHaveAttribute('autoCorrect', 'off');
  });
});
