/**
 * WishlistSection Component Tests — Story 14.3
 *
 * Covers empty/error/loading states, impact line rendering, add flow,
 * and purchased/removed status actions.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { WishlistSection } from '@/components/goals/WishlistSection';
import useSWR from 'swr';
import { useWishlist } from '@/lib/hooks/useWishlist';
import type { WishlistItemWithImpact } from '@/types/database.types';

jest.mock('@/lib/hooks/useWishlist', () => ({
  useWishlist: jest.fn(),
  WISHLIST_KEY: '/api/wishlist',
}));

// The component's own useSWR call fetches the category options for the form
jest.mock('swr', () =>
  jest.fn(() => ({
    data: { data: [{ id: 'cat-1', name: 'Electronics', isOwn: true }] },
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  }))
);

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: { currency_format: 'EUR' },
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: 'Wishlist',
      subtitle: 'See what a purchase would do.',
      itemName: 'Item',
      itemNamePlaceholder: 'e.g., New headphones',
      price: 'Price',
      categoryOptional: 'Category (optional)',
      noCategory: 'No category',
      categoriesUnavailable:
        "Categories couldn't be loaded — you can still add the item without one.",
      addItem: 'Add to wishlist',
      invalidName: 'Enter a name (1–100 characters)',
      invalidPrice: 'Enter a valid positive price (max 2 decimals)',
      addFailed: 'Failed to add wishlist item',
      updateFailed: 'Failed to update wishlist item',
      loadFailed: 'Unable to load your wishlist.',
      emptyState: 'Your wishlist is empty.',
      markPurchased: 'Purchased',
      markRemoved: 'Remove',
      restore: 'Restore',
      purchased: 'Purchased',
      removed: 'Removed',
      hideHistory: 'Hide history',
    };
    if (key === 'addedSuccess') return `${params?.name} added`;
    if (key === 'alignsWith') return `Aligns with ${params?.value}`;
    if (key === 'leavesBudget')
      return `Leaves ${params?.amount} of your ${params?.limit} ${params?.category} budget`;
    if (key === 'exceedsBudget') return `Exceeds your ${params?.category} budget by ${params?.amount}`;
    if (key === 'monthBalanceAfter') return `Month balance after purchase: ${params?.amount}`;
    if (key === 'goalDelay') return `${params?.goal} would be delayed by about ${params?.days} days`;
    if (key === 'showHistory') return `Show history (${params?.count})`;
    return map[key] ?? key;
  },
}));

const mockUseWishlist = useWishlist as jest.MockedFunction<typeof useWishlist>;

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

function makeItem(overrides: Partial<WishlistItemWithImpact> = {}): WishlistItemWithImpact {
  return {
    id: 'w-1',
    user_id: 'u-1',
    category_id: 'cat-1',
    name: 'Headphones',
    price: 100,
    status: 'active',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    category_name: 'Electronics',
    impact: {
      month_balance_after: 400,
      category_budget: {
        category_name: 'Electronics',
        limit_amount: 300,
        remaining_after: 80,
        exceeds_budget: false,
      },
      goal_delay: { goal_name: 'Vacation', delay_days: 10, exceeds_cap: false },
      aligned_value: 'Fun',
    },
    ...overrides,
  };
}

// SWR-like mutate stub: executes async function updaters (the optimistic path
// runs the PATCH inside the updater), passing the current cache data through.
const makeMutate = (currentData: () => unknown) =>
  jest.fn(async (updater?: unknown) => {
    if (typeof updater === 'function') {
      return (updater as (d: unknown) => Promise<unknown>)(currentData());
    }
    return undefined;
  });

const hookResult = (overrides: Partial<ReturnType<typeof useWishlist>>) => {
  const result = {
    data: undefined,
    error: undefined,
    isLoading: false,
    ...overrides,
  } as ReturnType<typeof useWishlist>;
  if (!overrides.mutate) {
    result.mutate = makeMutate(() => result.data) as unknown as ReturnType<
      typeof useWishlist
    >['mutate'];
  }
  return result;
};

const ORIGINAL_FETCH = global.fetch;

describe('WishlistSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    }) as jest.Mock;
  });

  afterAll(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('renders the heading, subtitle and add form', () => {
    mockUseWishlist.mockReturnValue(hookResult({ data: { items: [] } }));
    renderWithChakra(<WishlistSection />);

    expect(screen.getByText('Wishlist')).toBeInTheDocument();
    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to wishlist' })).toBeInTheDocument();
  });

  it('shows the empty state when there are no items', () => {
    mockUseWishlist.mockReturnValue(hookResult({ data: { items: [] } }));
    renderWithChakra(<WishlistSection />);

    expect(screen.getByText('Your wishlist is empty.')).toBeInTheDocument();
  });

  it('shows an error alert when loading fails', () => {
    mockUseWishlist.mockReturnValue(hookResult({ error: new Error('boom') }));
    renderWithChakra(<WishlistSection />);

    expect(screen.getByText('Unable to load your wishlist.')).toBeInTheDocument();
  });

  it('renders an item with all impact lines', () => {
    mockUseWishlist.mockReturnValue(hookResult({ data: { items: [makeItem()] } }));
    renderWithChakra(<WishlistSection />);

    expect(screen.getByText('Headphones')).toBeInTheDocument();
    expect(screen.getByText(/Leaves .* of your .* Electronics budget/)).toBeInTheDocument();
    expect(screen.getByText(/Month balance after purchase/)).toBeInTheDocument();
    expect(screen.getByText(/Vacation would be delayed by about 10 days/)).toBeInTheDocument();
    expect(screen.getByText('Aligns with Fun')).toBeInTheDocument();
  });

  it('renders the over-budget warning variant', () => {
    mockUseWishlist.mockReturnValue(
      hookResult({
        data: {
          items: [
            makeItem({
              impact: {
                month_balance_after: -50,
                category_budget: {
                  category_name: 'Electronics',
                  limit_amount: 300,
                  remaining_after: -70,
                  exceeds_budget: true,
                },
                goal_delay: null,
                aligned_value: null,
              },
            }),
          ],
        },
      })
    );
    renderWithChakra(<WishlistSection />);

    expect(screen.getByText(/Exceeds your Electronics budget by/)).toBeInTheDocument();
  });

  it('omits budget/goal/value lines when impacts are null', () => {
    mockUseWishlist.mockReturnValue(
      hookResult({
        data: {
          items: [
            makeItem({
              category_id: null,
              category_name: null,
              impact: {
                month_balance_after: 400,
                category_budget: null,
                goal_delay: null,
                aligned_value: null,
              },
            }),
          ],
        },
      })
    );
    renderWithChakra(<WishlistSection />);

    expect(screen.getByText(/Month balance after purchase/)).toBeInTheDocument();
    expect(screen.queryByText(/budget/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delayed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aligns with/)).not.toBeInTheDocument();
  });

  it('adds an item via POST and revalidates', async () => {
    const mutate = jest.fn();
    mockUseWishlist.mockReturnValue(hookResult({ data: { items: [] }, mutate }));
    renderWithChakra(<WishlistSection />);

    fireEvent.change(screen.getByPlaceholderText('e.g., New headphones'), {
      target: { value: 'Espresso machine' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '249,99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/wishlist',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Espresso machine',
            price: 249.99, // comma-decimal normalized
            category_id: null,
          }),
        })
      );
    });
    expect(mutate).toHaveBeenCalled();
  });

  it('rejects an invalid price without calling the API', async () => {
    mockUseWishlist.mockReturnValue(hookResult({ data: { items: [] } }));
    renderWithChakra(<WishlistSection />);

    fireEvent.change(screen.getByPlaceholderText('e.g., New headphones'), {
      target: { value: 'Junk' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '10abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));

    expect(await screen.findByText('Enter a valid positive price (max 2 decimals)')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('marks an item purchased via PATCH (optimistic mutate)', async () => {
    const result = hookResult({ data: { items: [makeItem()] } });
    mockUseWishlist.mockReturnValue(result);
    renderWithChakra(<WishlistSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Purchased' }));

    // The PATCH runs inside the optimistic mutate updater
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/wishlist/w-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'purchased' }),
        })
      );
    });
    expect(result.mutate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rollbackOnError: true, revalidate: true })
    );
  });

  it('shows the history toggle when purchased/removed items exist', () => {
    mockUseWishlist.mockReturnValue(
      hookResult({
        data: {
          items: [makeItem(), makeItem({ id: 'w-2', name: 'Old thing', status: 'purchased' })],
        },
      })
    );
    renderWithChakra(<WishlistSection />);

    expect(screen.getByText('Show history (1)')).toBeInTheDocument();
    expect(screen.queryByText('Old thing')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show history (1)'));
    expect(screen.getByText('Old thing')).toBeInTheDocument();
  });
});

/**
 * Category-picker degradation — deferred item re-rated at the Epic 16 retro.
 *
 * The `/api/categories` fetch had its `error` discarded, so a failure rendered a
 * picker holding nothing but the "No category" placeholder. That reads as "you
 * have no categories", not "we couldn't load them" — a silent failure, which
 * the project's degradation policy says enrichment must not be.
 */
describe('WishlistSection category picker', () => {
  const mockUseSWR = useSWR as unknown as jest.Mock;
  const HINT = "Categories couldn't be loaded — you can still add the item without one.";
  const LOADED = {
    data: { data: [{ id: 'cat-1', name: 'Electronics', isOwn: true }] },
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  };
  const FAILED = {
    data: undefined,
    error: new Error('network'),
    isLoading: false,
    mutate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // A sibling describe stubs this in its own beforeEach, which does not reach
    // here.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    }) as jest.Mock;
    mockUseWishlist.mockReturnValue(hookResult({ data: { items: [] } }));
  });

  afterEach(() => {
    // Restore the file-wide default so suite ordering cannot matter.
    mockUseSWR.mockReturnValue(LOADED);
  });

  it('says so when the categories cannot be loaded', () => {
    mockUseSWR.mockReturnValue(FAILED);

    renderWithChakra(<WishlistSection />);

    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('disables the empty picker rather than inviting a pointless tap', () => {
    mockUseSWR.mockReturnValue(FAILED);

    renderWithChakra(<WishlistSection />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('ties the hint to the picker for screen readers', () => {
    // A disabled control with an unassociated explanation tells a screen-reader
    // user nothing. FormControl generates the id and the link; this asserts the
    // wiring survives, since an explicit id on either side silently breaks it.
    mockUseSWR.mockReturnValue(FAILED);

    renderWithChakra(<WishlistSection />);

    const describedBy = screen.getByRole('combobox').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const described = describedBy!
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);

    expect(described.some((node) => node.textContent === HINT)).toBe(true);
  });

  it('still lets the item be added — the category is optional', async () => {
    // The point of warning rather than blocking: a failed enrichment fetch must
    // not cost the user the thing they came to do.
    mockUseSWR.mockReturnValue(FAILED);

    renderWithChakra(<WishlistSection />);

    fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'Headphones' } });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const call = (global.fetch as jest.Mock).mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('/api/wishlist')
    );
    expect(call).toBeTruthy();
    expect(JSON.parse(call![1].body as string)).toMatchObject({
      name: 'Headphones',
      category_id: null,
    });
  });

  it('shows no hint when the categories load', () => {
    mockUseSWR.mockReturnValue(LOADED);

    renderWithChakra(<WishlistSection />);

    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });

  // The case the first version of this suite never exercised. Both fixtures
  // above are clean states — data XOR error — so the combination that actually
  // occurs in production went untested, and the bug shipped.
  describe('stale data survives a failed revalidation', () => {
    const STALE = { ...LOADED, error: new Error('revalidation 500') };

    it('keeps the picker usable when cached options are still present', () => {
      // SWR retains `data` when a background revalidation fails.
      // `docs/api-conventions.md` names hiding it as the WRONG behaviour and
      // lists this hook as the example.
      mockUseSWR.mockReturnValue(STALE);

      renderWithChakra(<WishlistSection />);

      expect(screen.getByRole('combobox')).not.toBeDisabled();
      expect(screen.getByRole('option', { name: 'Electronics' })).toBeInTheDocument();
    });

    it('does not claim the categories are unavailable while showing them', () => {
      mockUseSWR.mockReturnValue(STALE);

      renderWithChakra(<WishlistSection />);

      expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    });

    it('still degrades when the error leaves nothing to show', () => {
      // Guards the guard: if the condition were simply inverted, this fails.
      mockUseSWR.mockReturnValue({ ...FAILED, data: { data: [] } });

      renderWithChakra(<WishlistSection />);

      expect(screen.getByText(HINT)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeDisabled();
    });
  });
});
