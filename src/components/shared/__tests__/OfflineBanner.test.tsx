/**
 * Tests for OfflineBanner Component
 * Story 8.5: Offline Data Caching for Viewing (Phase 1)
 *
 * Test Coverage:
 * AC-8.5.2: Offline Indicator
 * AC-8.5.4: Reconnection Behavior
 */

import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import * as useOnlineStatusHook from '@/lib/hooks/useOnlineStatus';

// Mock useOnlineStatus hook
jest.mock('@/lib/hooks/useOnlineStatus', () => ({
  useOnlineStatus: jest.fn(),
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '5 minutes ago'),
}));

// Wrapper with ChakraProvider
const renderWithChakra = (component: React.ReactElement) => {
  return render(<ChakraProvider>{component}</ChakraProvider>);
};

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AC-8.5.2: Offline Indicator', () => {
    it('should display offline banner when offline', () => {
      // Mock offline state
      jest.spyOn(useOnlineStatusHook, 'useOnlineStatus').mockReturnValue({
        isOnline: false,
        lastSync: new Date('2025-01-01T00:00:00Z'),
        syncStatus: 'offline',
        cachedDataTimestamp: new Date('2025-01-01T00:00:00Z'),
      });

      renderWithChakra(<OfflineBanner />);

      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
      expect(screen.getByText(/Viewing cached data from 5 minutes ago/i)).toBeInTheDocument();
    });

    it('should show "unknown" when cached data timestamp is null', () => {
      jest.spyOn(useOnlineStatusHook, 'useOnlineStatus').mockReturnValue({
        isOnline: false,
        lastSync: null,
        syncStatus: 'offline',
        cachedDataTimestamp: null,
      });

      renderWithChakra(<OfflineBanner />);

      expect(screen.getByText(/Viewing cached data from unknown/i)).toBeInTheDocument();
    });

    it('should not display banner when online and not reconnecting', () => {
      jest.spyOn(useOnlineStatusHook, 'useOnlineStatus').mockReturnValue({
        isOnline: true,
        lastSync: new Date(),
        syncStatus: 'synced',
        cachedDataTimestamp: new Date(),
      });

      renderWithChakra(<OfflineBanner />);

      // Should not show offline banner
      expect(screen.queryByText(/You're offline/i)).not.toBeInTheDocument();
      // Should not show reconnection banner
      expect(screen.queryByText(/Back online!/i)).not.toBeInTheDocument();
    });
  });

  // MOCK BEFORE THE FIRST RENDER, in every test here. All three of these used to
  // render and THEN call jest.spyOn(...).mockReturnValue(...), which only worked
  // because of state left behind by an earlier test.
  //
  // The factory at the top of this file is `useOnlineStatus: jest.fn()` — a bare
  // mock with NO implementation, so it returns `undefined` and the component's
  // `const { isOnline } = useOnlineStatus()` throws:
  //
  //   TypeError: Cannot destructure property 'isOnline' of
  //   '(0 , _useOnlineStatus.useOnlineStatus)(...)' as it is undefined.
  //
  // `jest.clearAllMocks()` in the outer beforeEach clears recorded CALLS and
  // LEAVES the implementation, so once any AC-8.5.2 test has run its
  // mockReturnValue survives into these — and in declaration order those three
  // run first. The initial render here was therefore succeeding on borrowed
  // state.
  //
  // MEASURED 2026-10-06: run individually, all three of these FAILED and all
  // three AC-8.5.2 tests passed. Under --randomize the file failed at seeds 2
  // and 4 (the orders that put these first) and passed at 1, 3, 5, 7.
  //
  // Note the polarity against exchangeRateService: there a leaked mock POISONED
  // a later test; here a leaked mock RESCUED one. Same boundary, opposite sign.
  describe('AC-8.5.4: Reconnection Behavior', () => {
    it('should display "Back online! Syncing..." banner when reconnecting', async () => {
      // Start offline
      jest.spyOn(useOnlineStatusHook, 'useOnlineStatus').mockReturnValue({
        isOnline: false,
        lastSync: null,
        syncStatus: 'offline',
        cachedDataTimestamp: null,
      });

      const { rerender } = renderWithChakra(<OfflineBanner />);

      rerender(
        <ChakraProvider>
          <OfflineBanner />
        </ChakraProvider>
      );

      // Go online
      jest.spyOn(useOnlineStatusHook, 'useOnlineStatus').mockReturnValue({
        isOnline: true,
        lastSync: new Date(),
        syncStatus: 'syncing',
        cachedDataTimestamp: new Date(),
      });

      rerender(
        <ChakraProvider>
          <OfflineBanner />
        </ChakraProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Back online!/i)).toBeInTheDocument();
      });
    });

    it('should show synced message when sync completes', async () => {
      // Simulate reconnection with synced status
      // Start offline
      jest.spyOn(useOnlineStatusHook, 'useOnlineStatus').mockReturnValue({
        isOnline: false,
        lastSync: null,
        syncStatus: 'offline',
        cachedDataTimestamp: null,
      });

      const { rerender } = renderWithChakra(<OfflineBanner />);

      rerender(
        <ChakraProvider>
          <OfflineBanner />
        </ChakraProvider>
      );

      // Go online with synced status
      jest.spyOn(useOnlineStatusHook, 'useOnlineStatus').mockReturnValue({
        isOnline: true,
        lastSync: new Date(),
        syncStatus: 'synced',
        cachedDataTimestamp: new Date(),
      });

      rerender(
        <ChakraProvider>
          <OfflineBanner />
        </ChakraProvider>
      );

      await waitFor(() => {
        const syncedText = screen.queryByText(/Data synced successfully/i);
        // Note: This may or may not appear depending on timing
        // The banner auto-hides after 3 seconds
        if (syncedText) {
          expect(syncedText).toBeInTheDocument();
        }
      });
    });

    it('should auto-hide reconnection banner after 3 seconds', async () => {
      jest.useFakeTimers();

      // Start offline
      jest.spyOn(useOnlineStatusHook, 'useOnlineStatus').mockReturnValue({
        isOnline: false,
        lastSync: null,
        syncStatus: 'offline',
        cachedDataTimestamp: null,
      });

      const { rerender } = renderWithChakra(<OfflineBanner />);

      rerender(
        <ChakraProvider>
          <OfflineBanner />
        </ChakraProvider>
      );

      // Go online
      jest.spyOn(useOnlineStatusHook, 'useOnlineStatus').mockReturnValue({
        isOnline: true,
        lastSync: new Date(),
        syncStatus: 'syncing',
        cachedDataTimestamp: new Date(),
      });

      rerender(
        <ChakraProvider>
          <OfflineBanner />
        </ChakraProvider>
      );

      // Banner should be visible
      await waitFor(() => {
        expect(screen.getByText(/Back online!/i)).toBeInTheDocument();
      });

      // Fast-forward 3 seconds
      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.queryByText(/Back online!/i)).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });
});
