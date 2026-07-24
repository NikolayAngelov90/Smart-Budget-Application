/**
 * TransactionEntryModal — composer redesign (Story 16.2)
 * Covers the one-tap category quick-pick chips and the "More details" disclosure.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import TransactionEntryModal from '../TransactionEntryModal';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      amount: 'Amount',
      type: 'Type',
      category: 'Category',
      expense: 'Expense',
      income: 'Income',
      selectCategory: 'Select category',
      addTransaction: 'Add Transaction',
      add: 'Add',
      moreDetails: 'More details',
      fewerDetails: 'Fewer details',
      date: 'Date',
      notes: 'Notes',
      today: 'Today',
      yesterday: 'Yesterday',
      twoDaysAgo: '2 days ago',
      optional: 'optional',
      loading: 'Loading',
      cancel: 'Cancel',
      maxCharacters: 'Max characters',
    };
    return map[key] || key;
  },
}));

jest.mock('@/lib/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
jest.mock('@/lib/config/currencies', () => ({ getEnabledCurrencies: () => [{ code: 'EUR', symbol: '€' }] }));
jest.mock('@/lib/utils/haptic', () => ({ triggerHaptic: jest.fn() }));
// Mock the full CategoryMenu (its own suite covers it) so we test only the chips.
jest.mock('@/components/categories/CategoryMenu', () => ({
  CategoryMenu: () => <div data-testid="category-menu" />,
}));
// Desktop Modal path
jest.mock('@chakra-ui/react', () => {
  const actual = jest.requireActual('@chakra-ui/react');
  return { ...actual, useBreakpointValue: () => false };
});

const CATEGORIES = [
  { id: 'c1', name: 'Groceries', color: '#C4593A', type: 'expense', usage_count: 9 },
  { id: 'c2', name: 'Transport', color: '#0B5E4A', type: 'expense', usage_count: 3 },
];

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve({ data: CATEGORIES, recent: [CATEGORIES[0]] }),
  }) as jest.Mock;
});

const renderModal = () =>
  render(
    <ChakraProvider>
      <TransactionEntryModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />
    </ChakraProvider>
  );

describe('TransactionEntryModal composer (Story 16.2)', () => {
  it('renders one-tap category chips (recent first) and marks the tapped one active', async () => {
    renderModal();
    const chip = await waitFor(() => screen.getByRole('button', { name: /Groceries/i }), { timeout: 3000 });
    expect(screen.getByRole('button', { name: /Transport/i })).toBeInTheDocument();
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'true'));
  });

  it('hides secondary fields behind "More details" and toggles the disclosure', async () => {
    renderModal();
    const toggle = await waitFor(() => screen.getByRole('button', { name: /More details/i }), { timeout: 3000 });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole('button', { name: /Fewer details/i })).toHaveAttribute('aria-expanded', 'true'));
  });
});
