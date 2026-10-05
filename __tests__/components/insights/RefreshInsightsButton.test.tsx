/**
 * Tests for RefreshInsightsButton Component
 *
 * Story 6.5: Insight Generation Scheduling and Manual Refresh
 * AC3: Manual Refresh Button
 * AC5: Loading Indicator
 * AC6: Success and Empty State Toasts
 * AC8: Rate Limiting
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RefreshInsightsButton } from '@/components/insights/RefreshInsightsButton';

// Mock Chakra UI useToast
const mockToast = jest.fn();
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useToast: () => mockToast,
}));

// Mock the SCOPED mutate. The component used to call the global `mutate` from
// 'swr', which binds to SWR's default cache — inert under this app's
// localStorage cache provider, so the list never revalidated after a refresh.
const mockMutate = jest.fn();
jest.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('RefreshInsightsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mockRESET, not mockClear. `clearAllMocks` and `mockClear` clear recorded
    // CALLS and leave the IMPLEMENTATION in place, so the delayed-resolve
    // `mockImplementation` set by "should disable button during API call"
    // survives into every later test. It is masked today only because each test
    // queues its own `mockResolvedValueOnce`, which takes precedence — a test
    // that forgot to would silently inherit a 100ms ok:true response.
    //
    // Same gotcha as #66's pushService leak, where a leaked
    // mockRejectedValue({statusCode:410}) made five tests assert 'sent' against
    // a fixture in which nothing could be sent.
    (global.fetch as jest.Mock).mockReset();
  });

  it('should render refresh button', () => {
    render(<RefreshInsightsButton />);

    expect(screen.getByRole('button', { name: /refresh insights/i })).toBeInTheDocument();
  });

  it('should disable button during API call', async () => {
    const user = userEvent.setup();

    // Mock response with delay to capture loading state
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ success: true, count: 3 }),
              }),
            100
          )
        )
    );

    render(<RefreshInsightsButton />);

    const button = screen.getByRole('button', { name: /refresh insights/i });
    await user.click(button);

    // Button should be disabled during API call
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    // AND THEN WAIT FOR IT TO FINISH. Without this the test ends with a pending
    // 100ms timer and an in-flight handler: the timer fires inside the NEXT
    // test, the handler sees ok:true and calls mutate(), and the next test's
    // beforeEach has already run clearAllMocks — so a call belonging to this
    // test is attributed to that one.
    //
    // That is the whole of the intermittent failure in "does NOT revalidate when
    // the refresh request fails": `Expected 0, Received 1`, roughly one run in
    // six, only when the shuffle puts that test immediately after this one. A
    // test must not outlive itself.
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
  });

  it('should call API with forceRegenerate=true', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 5 }),
    });

    render(<RefreshInsightsButton />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/insights/generate?forceRegenerate=true',
        { method: 'POST' }
      );
    });
  });

  it('should show success toast when insights generated', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 5 }),
    });

    render(<RefreshInsightsButton />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Insights updated!',
          description: '5 new insights generated.',
          status: 'success',
        })
      );
    });
  });

  it('should show "all caught up" toast when no new insights', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 0 }),
    });

    render(<RefreshInsightsButton />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'All caught up!',
          description: 'No new insights at this time.',
          status: 'info',
        })
      );
    });
  });

  it('should handle rate limit error (429)', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limit exceeded', remainingSeconds: 180 }),
    });

    render(<RefreshInsightsButton />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Please wait',
          status: 'warning',
        })
      );
    });
  });

  it('should show remaining time in rate limit toast', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limit exceeded', remainingSeconds: 125 }),
    });

    render(<RefreshInsightsButton />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('2m 5s'),
        })
      );
    });
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    render(<RefreshInsightsButton />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Refresh failed',
          status: 'error',
        })
      );
    });
  });

  it('should revalidate the insights list via the scoped mutate after a refresh', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 3 }),
    });

    render(<RefreshInsightsButton />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(expect.any(Function));
    });

    // The key filter must actually match the list's SWR key.
    const keyFilter = mockMutate.mock.calls[0][0] as (key: unknown) => boolean;
    expect(keyFilter('/api/insights?limit=20&offset=0&dismissed=false')).toBe(true);
    expect(keyFilter('/api/transactions?limit=5')).toBe(false);
  });

  it('does NOT revalidate when the refresh request fails', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });

    render(<RefreshInsightsButton />);
    const button = screen.getByRole('button');
    await user.click(button);

    // Wait for the failure path to SETTLE, not merely for fetch to have been
    // called. `expect(fetch).toHaveBeenCalled()` resolves while the response is
    // still being handled, so the assertion below was a snapshot taken
    // mid-flight: it said "mutate has not been called YET", which is true of a
    // version that calls it a microtask later.
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    await waitFor(() => expect(button).toBeEnabled());

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('should call onRefreshComplete callback when provided', async () => {
    const user = userEvent.setup();
    const onRefreshComplete = jest.fn();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 7 }),
    });

    render(<RefreshInsightsButton onRefreshComplete={onRefreshComplete} />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(onRefreshComplete).toHaveBeenCalledWith(7);
    });
  });

  it('should prevent double-clicks (client-side)', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 2 }),
    });

    render(<RefreshInsightsButton />);

    const button = screen.getByRole('button');

    // Click twice rapidly
    await user.click(button);
    await user.click(button);

    // Should only call API once
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
