/**
 * Household realtime revalidation — Story 13.8 AC#5, moved here by Story 17.1.
 *
 * This assertion used to live in `src/app/household/__tests__/page.test.tsx`,
 * because the subscription lived on the page. Story 17.1 lifted it to
 * `src/app/household/layout.tsx` so it keeps working across the index and its
 * four sub-pages instead of being copied five times — so the test follows it
 * rather than being deleted.
 *
 * The scoped-mutate detail is the load-bearing one: the global `mutate` from
 * 'swr' binds to SWR's own default cache while every hook here reads the
 * localStorage provider, so asserting on the global one passed while nothing
 * was actually revalidated (15-1).
 */

import { render } from '@testing-library/react';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { HouseholdRealtimeProvider } from '../HouseholdRealtimeProvider';

jest.mock('@/lib/hooks/useRealtimeSubscription', () => ({ useRealtimeSubscription: jest.fn() }));

const mockScopedMutate = jest.fn();
jest.mock('swr', () => ({
  ...jest.requireActual('swr'),
  useSWRConfig: () => ({ mutate: mockScopedMutate }),
}));

const mockRealtime = useRealtimeSubscription as jest.MockedFunction<typeof useRealtimeSubscription>;

beforeEach(() => jest.clearAllMocks());

it('renders its children', () => {
  const { getByTestId } = render(
    <HouseholdRealtimeProvider>
      <div data-testid="child" />
    </HouseholdRealtimeProvider>
  );
  expect(getByTestId('child')).toBeInTheDocument();
});

it('revalidates every household aggregate on a realtime event (AC#5)', async () => {
  render(
    <HouseholdRealtimeProvider>
      <div />
    </HouseholdRealtimeProvider>
  );

  const cb = mockRealtime.mock.calls[0]![0];
  cb({ eventType: 'INSERT', new: {}, old: null, timestamp: '' });

  await new Promise((r) => setTimeout(r, 200)); // trailing-guard debounce (150ms)

  expect(mockScopedMutate).toHaveBeenCalledWith('/api/households/category-totals');
  expect(mockScopedMutate).toHaveBeenCalledWith('/api/households/contributions');
  expect(mockScopedMutate).toHaveBeenCalledWith('/api/households/goals');
  expect(mockScopedMutate).toHaveBeenCalledWith('/api/households/insights');
});

it('collapses a burst of events into ONE revalidation', async () => {
  render(
    <HouseholdRealtimeProvider>
      <div />
    </HouseholdRealtimeProvider>
  );

  const cb = mockRealtime.mock.calls[0]![0];
  const event = { eventType: 'INSERT' as const, new: {}, old: null, timestamp: '' };
  cb(event);
  cb(event);
  cb(event);

  await new Promise((r) => setTimeout(r, 200));

  const totalsCalls = mockScopedMutate.mock.calls.filter(
    ([key]) => key === '/api/households/category-totals'
  );
  expect(totalsCalls).toHaveLength(1);
});

it('does not revalidate after unmount', async () => {
  const { unmount } = render(
    <HouseholdRealtimeProvider>
      <div />
    </HouseholdRealtimeProvider>
  );

  const cb = mockRealtime.mock.calls[0]![0];
  cb({ eventType: 'INSERT', new: {}, old: null, timestamp: '' });
  unmount(); // before the 150ms guard fires

  await new Promise((r) => setTimeout(r, 200));

  expect(mockScopedMutate).not.toHaveBeenCalled();
});
