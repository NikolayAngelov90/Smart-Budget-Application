/**
 * FilterBreadcrumbs — regression guard for the shared `/api/categories` SWR cache.
 *
 * The bug: FilterBreadcrumbs stored the BARE ARRAY under the `/api/categories`
 * key, poisoning the shared cache so the Categories page (which reads
 * `data.data`) rendered "No categories found". This test lets the REAL fetcher
 * run (fetch mocked) and asserts the component reads the category from the
 * `{ data: [...] }` shape — locking in the consistent shape.
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig } from 'swr';
import { useSearchParams } from 'next/navigation';
import { FilterBreadcrumbs } from '../FilterBreadcrumbs';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const mockParams = useSearchParams as jest.Mock;
const CAT = { id: 'c1', name: 'Groceries', color: '#0B5E4A', type: 'expense' as const };

beforeEach(() => {
  // Real fetcher runs against this — returns the shared `{ data }` shape.
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [CAT], recent: [], count: 1 }),
  }) as jest.Mock;
});

const renderBC = () =>
  render(
    <ChakraProvider>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FilterBreadcrumbs />
      </SWRConfig>
    </ChakraProvider>
  );

describe('FilterBreadcrumbs', () => {
  it('renders nothing when no category/month filter is active', () => {
    mockParams.mockReturnValue(new URLSearchParams(''));
    renderBC();
    expect(screen.queryByText('filtering')).not.toBeInTheDocument();
  });

  it('looks the category up from the { data } SWR shape and shows its name', async () => {
    mockParams.mockReturnValue(new URLSearchParams('category=c1'));
    renderBC();
    expect(await screen.findByText('Groceries')).toBeInTheDocument();
  });

  it('formats an active month filter', () => {
    mockParams.mockReturnValue(new URLSearchParams('month=2026-05'));
    renderBC();
    expect(screen.getByText(/May 2026/)).toBeInTheDocument();
  });
});
