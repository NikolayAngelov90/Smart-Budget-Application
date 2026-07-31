/**
 * "Where it's going" — HP-1.
 *
 * The dashboard's last un-migrated section. Three things are pinned here:
 *
 *  1. the category donut follows the period selector, and labels itself from the
 *     window the SERVER echoed rather than the pending selection;
 *  2. nothing in these three components renders a hardcoded English literal —
 *     they predate next-intl and were shipping English into the Bulgarian UI;
 *  3. every key they reference actually exists in BOTH message files, so a
 *     typo'd key cannot reach production as a visible `dashboard.foo`.
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { CategorySpendingChart } from '../CategorySpendingChart';

const mockUseSpendingByCategory = jest.fn();
jest.mock('@/lib/hooks/useSpendingByCategory', () => ({
  SPENDING_BY_CATEGORY_KEY: '/api/dashboard/spending-by-category',
  useSpendingByCategory: (...args: unknown[]) => mockUseSpendingByCategory(...args),
}));
jest.mock('@/lib/hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: jest.fn(),
}));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
jest.mock('@/lib/hooks/useChartColors', () => ({
  useChartColors: () => ({ accent: '#000', tick: '#000', grid: '#000', axis: '#000' }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// Keys, not translations: a hardcoded English literal then stands out because
// it is the only thing on screen that is not a key.
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
}));

const result = (over: Record<string, unknown> = {}) => ({
  data: { month: '2026-07', period: 'month', total: 0, categories: [], ...over },
  error: undefined,
  isLoading: false,
  mutate: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSpendingByCategory.mockReturnValue(result());
});

const renderChart = (props = {}) =>
  render(<CategorySpendingChart {...props} />, { wrapper: ChakraProvider });

describe('category donut follows the period', () => {
  it('passes the selected period to the hook', () => {
    renderChart({ period: 'year' });

    expect(mockUseSpendingByCategory).toHaveBeenCalledWith(undefined, 'year');
  });

  it('an explicit month still reaches the hook', () => {
    renderChart({ month: '2026-03', period: 'year' });

    expect(mockUseSpendingByCategory).toHaveBeenCalledWith('2026-03', 'year');
  });

  it.each([
    ['week', 'noExpensesWeek'],
    ['month', 'noExpensesMonth'],
    ['quarter', 'noExpensesQuarter'],
    ['year', 'noExpensesYear'],
  ])('captions an empty %s with %s', (period, key) => {
    mockUseSpendingByCategory.mockReturnValue(result({ period, categories: [] }));

    renderChart({ period });

    expect(screen.getByText(key)).toBeInTheDocument();
  });

  it('labels from the window the SERVER returned, not the pending selection', () => {
    // keepPreviousData holds the outgoing figures on screen while the next
    // window loads. Labelling by selection would caption last month's data
    // "no expenses this year" (the Story 16-6 lesson).
    mockUseSpendingByCategory.mockReturnValue(result({ period: 'month', categories: [] }));

    renderChart({ period: 'year' });

    expect(screen.getByText('noExpensesMonth')).toBeInTheDocument();
    expect(screen.queryByText('noExpensesYear')).not.toBeInTheDocument();
  });
});

describe('no hardcoded English', () => {
  it('renders no English literal in the empty state', () => {
    renderChart({ period: 'month' });

    expect(screen.queryByText(/No expenses this month/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Start adding transactions to see your spending breakdown/i)
    ).not.toBeInTheDocument();
  });

  it('renders no English literal in the error state', () => {
    mockUseSpendingByCategory.mockReturnValue({
      data: undefined,
      error: new Error('boom'),
      isLoading: false,
      mutate: jest.fn(),
    });

    renderChart();

    expect(screen.queryByText(/Failed to load spending data/i)).not.toBeInTheDocument();
    expect(screen.getByText('categoryChartError')).toBeInTheDocument();
  });

  it('titles the card once — the page owns the heading', () => {
    // The card used to render its OWN hardcoded "Spending by Category" heading
    // directly under the page's localized one, so a Bulgarian user saw the
    // title twice, in two languages.
    mockUseSpendingByCategory.mockReturnValue(
      result({
        total: 120,
        categories: [
          {
            category_id: 'c1',
            category_name: 'Groceries',
            category_color: '#0B5E4A',
            amount: 120,
            percentage: 100,
            transaction_count: 3,
          },
        ],
      })
    );

    renderChart({ period: 'month' });

    expect(screen.queryByText(/Spending by Category/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('translation keys resolve in both locales', () => {
  const ROOT = path.resolve(__dirname, '../../../..');
  const COMPONENTS = [
    'src/components/dashboard/CategorySpendingChart.tsx',
    'src/components/dashboard/SpendingTrendsChart.tsx',
    'src/components/dashboard/MonthOverMonth.tsx',
  ];

  const messages = (locale: string) =>
    JSON.parse(fs.readFileSync(path.join(ROOT, `messages/${locale}.json`), 'utf8'))
      .dashboard as Record<string, string>;

  /** `t('someKey')` occurrences — the literal ones, which is all of them. */
  function keysUsedIn(rel: string): string[] {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    return [...src.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)].map((m) => m[1]!);
  }

  it.each(COMPONENTS)('%s uses only keys present in en and bg', (rel) => {
    const used = keysUsedIn(rel);
    const en = messages('en');
    const bg = messages('bg');

    // Guards the guard: a regex that matched nothing would pass silently.
    expect(used.length).toBeGreaterThan(3);
    expect(used.filter((k) => !(k in en))).toEqual([]);
    expect(used.filter((k) => !(k in bg))).toEqual([]);
  });

  it('keeps the period-keyed empty states complete', () => {
    // These are looked up by period at runtime, so a missing one is a crash
    // rather than a visible English string.
    const en = messages('en');
    const bg = messages('bg');
    for (const key of [
      'noExpensesWeek',
      'noExpensesMonth',
      'noExpensesQuarter',
      'noExpensesYear',
      'thisWeek',
      'thisMonth',
      'thisQuarter',
      'thisYear',
    ]) {
      expect(en).toHaveProperty(key);
      expect(bg).toHaveProperty(key);
    }
  });
});
