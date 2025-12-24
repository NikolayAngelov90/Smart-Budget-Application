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

// Mock SWR mutate
jest.mock('swr', () => ({
  mutate: jest.fn(),
}));

import { mutate } from 'swr';
const mockMutate = mutate as jest.MockedFunction<typeof mutate>;

// Mock fetch
global.fetch = jest.fn();

describe('RefreshInsightsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
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

  it('should mutate SWR cache after successful refresh', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 3 }),
    });

    render(<RefreshInsightsButton />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
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
