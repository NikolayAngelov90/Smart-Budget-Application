/**
 * TransactionEntryModal — composer redesign (Story 16.2)
 * Covers the one-tap category quick-pick chips and the "More details" disclosure.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import TransactionEntryModal from '../TransactionEntryModal';

/**
 * A STABLE `t`, and this is the root cause of the flake this suite had.
 *
 * `useTranslations: () => (key) => ...` builds a NEW function on every render.
 * `TransactionEntryModal` has `fetchCategories = useCallback(..., [transactionType, toast, t])`
 * and `useEffect(() => { if (isOpen) fetchCategories(); }, [isOpen, fetchCategories])`,
 * so a churning `t` re-creates the callback and re-runs the effect on EVERY
 * render. Combined with a fetch mock whose `json()` returned a fresh
 * `{ data, recent }` each call — so `recentCategories` got a new array identity,
 * forcing another render — that is a SELF-SUSTAINING RE-FETCH LOOP. Measured:
 * fetch calls went 7 -> 9 -> 18 -> 35 over a second; with one stable response
 * object they sat at 4 -> 4 -> 4 -> 4.
 *
 * The chips re-render continuously under that loop, so a query could land in a
 * mid-update window: intermittent, insensitive to the seed, and unaffected by
 * what the test awaited. That is why it failed ~1 run in 5 in the full suite
 * while passing 10 of 10 alone.
 *
 * PRODUCTION DOES NOT LOOP, verified rather than assumed: use-intl wraps the
 * translator in `useMemo` keyed on the Intl context
 * (node_modules/use-intl/dist/esm/development/react.js), so the real `t` is
 * referentially stable. The loop was created by the mock.
 *
 * NEITHER HALF ALONE LOOPS, measured both ways round rather than assumed:
 *   fresh `t` only ............... 3/3 green
 *   fresh response only .......... 3/3 green
 *   BOTH (the state it shipped in) RED, `expected 9, received 21`
 *
 * So the cause is the CONJUNCTION, which is why the class is small: 49 of the
 * 50 files that mock next-intl return a fresh `t` like this and are harmless,
 * because they lack the other half. Only this file and
 * TransactionEntryModal.mobile.test.tsx had both — and the mobile suite was
 * confirmed by this same guard (`expected 8, received 21`) before being fixed,
 * so the second instance was MEASURED, not inferred from looking similar.
 */
const MESSAGES: Record<string, string> = {
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
const t = (key: string) => MESSAGES[key] || key;
jest.mock('next-intl', () => ({ useTranslations: () => t }));

jest.mock('@/lib/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
jest.mock('@/lib/config/currencies', () => ({
  getEnabledCurrencies: () => [{ code: 'EUR', symbol: '€' }],
}));
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

/**
 * ONE STABLE object, reused for every categories fetch. A fresh
 * `{ data, recent }` per call gives `recent` a new array identity each time,
 * which re-renders the modal and — with the churning `t` above — kept the
 * re-fetch loop alive. The amount suite already did this and said why in its
 * header; that comment did not travel to this file, which is why the loop was
 * still here.
 */
const CATEGORIES_RESPONSE = { data: CATEGORIES, recent: [CATEGORIES[0]] };

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(CATEGORIES_RESPONSE),
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

    // BOTH CHIPS IN ONE WAIT, and the reason is a measured failure rather than
    // caution. This test used to await Groceries alone and then query Transport
    // SYNCHRONOUSLY on the next line. Awaiting the first does not guarantee the
    // second: Groceries is the only entry in `recent`, Transport arrives from
    // the `categories` list, and `quickCategories` composes the two. The
    // assertion therefore asserted something the preceding await did not cover —
    // the rule in docs/testing-guidelines.md, "what did I await, and is what I
    // am asserting guaranteed by it?".
    //
    // WHAT WAS OBSERVED, because the mechanism and the symptom are separate
    // claims and only one of them is established:
    //   * the file passes 10 of 10 runs ALONE, in declaration order;
    //   * the FULL SUITE at a FIXED seed fails here about 1 run in 11, and the
    //     captured error is at the old line 82 naming /Transport/i;
    //   * so the same seed produces both outcomes — it is not an ordering
    //     dependency, and pinning a seed would not have made it deterministic.
    // The exact render sequence that leaves Groceries present and Transport
    // absent is NOT established: the two setState calls in fetchCategories run
    // `setCategories` first, which is the wrong order to produce it, so the
    // obvious candidate is refuted and the real one is unidentified. The fix is
    // correct regardless, which is why it is not waiting on that answer.
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Groceries/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Transport/i })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const chip = screen.getByRole('button', { name: /Groceries/i });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'true'));
  });

  it('SETTLES: the categories fetch stops firing once the chips are up', async () => {
    // THE GUARD FOR THE LOOP, and it is DETERMINISTIC — which is the point.
    // The symptom it replaces was a ~20% intermittent failure of the full suite,
    // and chasing that statistically was hopeless: the rate varied more between
    // measurement sessions than between the two code versions (4 of 20, then 7
    // of 20 under load, then 0 of 15, then 1 of 15). A rate you cannot reproduce
    // cannot tell you whether a fix worked.
    //
    // This asserts the CAUSE instead. Under the loop the call count climbed
    // without bound (7 -> 9 -> 18 -> 35 over a second); settled, it does not
    // move. Reintroducing either half of the cause — a fresh `t` per render or a
    // fresh response object — reddens this immediately, with no sampling.
    renderModal();
    await waitFor(() => screen.getByRole('button', { name: /Groceries/i }), { timeout: 3000 });

    const after = async (ms: number) => {
      await new Promise((r) => setTimeout(r, ms));
      return (global.fetch as jest.Mock).mock.calls.length;
    };

    const settled = await after(150);
    const later = await after(400);

    expect(later).toBe(settled);
    // Non-vacuity: if the component never fetched at all, `0 === 0` would pass
    // while asserting nothing about settling.
    expect(settled).toBeGreaterThan(0);
  });

  it('hides secondary fields behind "More details" and toggles the disclosure', async () => {
    renderModal();
    const toggle = await waitFor(() => screen.getByRole('button', { name: /More details/i }), {
      timeout: 3000,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Fewer details/i })).toHaveAttribute(
        'aria-expanded',
        'true'
      )
    );
  });
});
