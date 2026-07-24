/**
 * Categories page — Story 16-3 caption logic (code-review coverage).
 *
 * Locks in the review patches on `src/app/categories/page.tsx` +
 * `src/components/categories/BudgetEditor.tsx`:
 *  - the per-category "spent this month" caption renders ONLY when spend is
 *    actually known (endpoint omits zero-spend categories) — never zero-fills
 *    "€0.00" for absent/loading/errored spend (degradation policy);
 *  - the caption is suppressed on categories owned by another household member
 *    (`isOwn === false`), whose spend figure would be the CURRENT user's ~0;
 *  - a budgeted expense card shows BudgetEditor spend-vs-budget (on-brand
 *    tokens) instead of the plain caption — no double display.
 *
 * The real SWR fetcher runs against a mocked `fetch` (branch by URL); the three
 * non-lazy TabPanels each mount the list, so every card's text appears more than
 * once — assertions use *AllByText.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig } from 'swr';
import type { Category } from '@/types/category.types';
import CategoriesPage from '@/app/categories/page';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/categories/CategoryModal', () => ({ CategoryModal: () => null }));

let mockHousehold: { household: unknown };
jest.mock('@/lib/hooks/useHousehold', () => ({ useHousehold: () => mockHousehold }));

let mockBudgets: { data: { budgets: unknown[] } | undefined; mutate: jest.Mock };
jest.mock('@/lib/hooks/useBudgets', () => ({ useBudgets: () => mockBudgets }));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));

let mockCategories: Category[];
let mockSpendRows: Array<{ category_id: string; amount: number }>;

const cat = (over: Partial<Category>): Category => ({
  id: 'c',
  user_id: 'u1',
  name: 'Cat',
  color: '#0B5E4A',
  type: 'expense',
  is_predefined: false,
  household_id: null,
  isOwn: true,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

beforeEach(() => {
  mockHousehold = { household: null };
  mockBudgets = { data: { budgets: [] }, mutate: jest.fn() };
  mockCategories = [];
  mockSpendRows = [];
  global.fetch = jest.fn((url: string) => {
    const body = url.includes('/api/dashboard/spending-by-category')
      ? { categories: mockSpendRows }
      : { data: mockCategories };
    return Promise.resolve({ ok: true, json: async () => body });
  }) as jest.Mock;
});

const renderPage = () =>
  render(
    <ChakraProvider>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CategoriesPage />
      </SWRConfig>
    </ChakraProvider>
  );

describe('Categories page — Story 16-3 spend caption', () => {
  it('shows the current-month spend caption for an expense category with recorded spend', async () => {
    mockCategories = [cat({ id: 'c1', name: 'Groceries', type: 'expense' })];
    mockSpendRows = [{ category_id: 'c1', amount: 42.5 }];

    renderPage();

    expect((await screen.findAllByText('€42.50')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('spentThisMonth').length).toBeGreaterThan(0);
  });

  it('does NOT zero-fill "€0.00" for an expense category absent from the spend data', async () => {
    // Groceries has spend (proves the spend fetch resolved); Rent has none.
    mockCategories = [
      cat({ id: 'c1', name: 'Groceries', type: 'expense' }),
      cat({ id: 'c2', name: 'Rent', type: 'expense' }),
    ];
    mockSpendRows = [{ category_id: 'c1', amount: 42.5 }];

    renderPage();

    // Wait until spend has resolved and Groceries' real caption is on screen…
    await screen.findAllByText('€42.50');
    // …then Rent (unknowable spend) must show no zero-filled figure.
    expect(screen.queryAllByText('€0.00')).toHaveLength(0);
  });

  it('suppresses the caption on another household member\'s shared expense category (isOwn === false)', async () => {
    mockHousehold = { household: { id: 'h1' } };
    mockCategories = [
      cat({ id: 'c1', name: 'Groceries', type: 'expense', isOwn: true }),
      cat({ id: 'c4', name: 'SharedRent', type: 'expense', isOwn: false, household_id: 'h1' }),
    ];
    // Spend endpoint only ever returns the current user's own transactions, but
    // guard against a stray row for the shared category regardless.
    mockSpendRows = [
      { category_id: 'c1', amount: 42.5 },
      { category_id: 'c4', amount: 99.99 },
    ];

    renderPage();

    await screen.findAllByText('€42.50'); // spend resolved
    expect(screen.queryAllByText('€99.99')).toHaveLength(0);
  });

  it('shows BudgetEditor spend-vs-budget (not the plain caption) for a budgeted expense category', async () => {
    mockCategories = [cat({ id: 'c5', name: 'Dining', type: 'expense' })];
    mockBudgets = {
      data: {
        budgets: [
          {
            id: 'b5',
            category_id: 'c5',
            category_name: 'Dining',
            category_color: '#C4593A',
            limit_amount: 100,
            spent: 120,
            remaining: -20,
            pct_used: 120,
            status: 'over',
          },
        ],
      },
      mutate: jest.fn(),
    };
    mockSpendRows = [{ category_id: 'c5', amount: 120 }];

    renderPage();

    await screen.findAllByText('Dining');
    // Budgeted card renders BudgetEditor's spend-of-limit + over-by lines…
    expect(screen.getAllByText('spentOfLimit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('overBy').length).toBeGreaterThan(0);
    // …and the plain "spent this month" caption is suppressed (no double display).
    expect(screen.queryAllByText('spentThisMonth')).toHaveLength(0);
  });
});
