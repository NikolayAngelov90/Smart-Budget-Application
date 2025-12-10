/**
 * Unit tests for AIBudgetCoach Component
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { AIBudgetCoach } from '@/components/dashboard/AIBudgetCoach';
import type { Insight } from '@/types/database.types';

// Wrapper component with ChakraProvider
const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider>{children}</ChakraProvider>
);

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock AIInsightCard
jest.mock('@/components/insights/AIInsightCard', () => ({
  AIInsightCard: ({
    insight,
    onDismiss,
  }: {
    insight: Insight;
    onDismiss: (id: string) => void;
  }) => (
    <div data-testid={`insight-${insight.id}`}>
      <div>{insight.title}</div>
      <button onClick={() => onDismiss(insight.id)}>Dismiss</button>
    </div>
  ),
}));

import useSWR from 'swr';

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>;

// Helper to create mock insights
function createMockInsights(count: number): Insight[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `insight-${i + 1}`,
    user_id: 'user-1',
    type: 'budget_recommendation' as const,
    title: `Insight ${i + 1}`,
    description: `Description for insight ${i + 1}`,
    priority: 3,
    is_dismissed: false,
    metadata: null,
    created_at: new Date().toISOString(),
    view_count: 0,
    first_viewed_at: null,
    last_viewed_at: null,
    dismissed_at: null,
    metadata_expanded_count: 0,
    last_metadata_expanded_at: null,
  }));
}

describe('AIBudgetCoach', () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('should render loading skeleton when loading', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      mutate: mockMutate,
      isValidating: false,
    } as any);

    render(<AIBudgetCoach />, { wrapper: AllProviders });

    expect(screen.getByText('AI Budget Coach')).toBeInTheDocument();
  });

  it('should render error state when fetch fails', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('Failed to fetch'),
      isLoading: false,
      mutate: mockMutate,
      isValidating: false,
    } as any);

    render(<AIBudgetCoach />, { wrapper: AllProviders });

    expect(screen.getByText(/Unable to load insights/i)).toBeInTheDocument();
  });

  it('should render empty state when no insights available', () => {
    mockUseSWR.mockReturnValue({
      data: { insights: [], total: 0 },
      error: undefined,
      isLoading: false,
      mutate: mockMutate,
      isValidating: false,
    } as any);

    render(<AIBudgetCoach />, { wrapper: AllProviders });

    expect(screen.getByText(/Keep tracking!/i)).toBeInTheDocument();
    expect(
      screen.getByText(/We'll have insights after a few weeks of data/i)
    ).toBeInTheDocument();
  });

  it('should render insights when data is available', () => {
    const mockInsights = createMockInsights(3);
    mockUseSWR.mockReturnValue({
      data: { insights: mockInsights, total: 3 },
      error: undefined,
      isLoading: false,
      mutate: mockMutate,
      isValidating: false,
    } as any);

    render(<AIBudgetCoach />, { wrapper: AllProviders });

    expect(screen.getByText('Insight 1')).toBeInTheDocument();
    expect(screen.getByText('Insight 2')).toBeInTheDocument();
    expect(screen.getByText('Insight 3')).toBeInTheDocument();
  });

  it('should show "View all" link when total insights > 3', () => {
    const mockInsights = createMockInsights(3);
    mockUseSWR.mockReturnValue({
      data: { insights: mockInsights, total: 10 },
      error: undefined,
      isLoading: false,
      mutate: mockMutate,
      isValidating: false,
    } as any);

    render(<AIBudgetCoach />, { wrapper: AllProviders });

    expect(screen.getByText(/See all 10 insights/i)).toBeInTheDocument();
    const link = screen.getByText(/See all 10 insights/i).closest('a');
    expect(link).toHaveAttribute('href', '/insights');
  });

  it('should not show "View all" link when total insights <= 3', () => {
    const mockInsights = createMockInsights(2);
    mockUseSWR.mockReturnValue({
      data: { insights: mockInsights, total: 2 },
      error: undefined,
      isLoading: false,
      mutate: mockMutate,
      isValidating: false,
    } as any);

    render(<AIBudgetCoach />, { wrapper: AllProviders });

    expect(screen.queryByText(/See all/i)).not.toBeInTheDocument();
  });

  it('should handle dismiss action with optimistic update', async () => {
    const mockInsights = createMockInsights(3);
    mockUseSWR.mockReturnValue({
      data: { insights: mockInsights, total: 3 },
      error: undefined,
      isLoading: false,
      mutate: mockMutate,
      isValidating: false,
    } as any);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<AIBudgetCoach />, { wrapper: AllProviders });

    const dismissButton = screen.getAllByText('Dismiss')[0];
    fireEvent.click(dismissButton);

    await waitFor(() => {
      // Should call mutate for optimistic update
      expect(mockMutate).toHaveBeenCalled();
    });

    // Should make API call to dismiss
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/insights/insight-1/dismiss',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_dismissed: true }),
      })
    );
  });

  it('should revert optimistic update on dismiss error', async () => {
    const mockInsights = createMockInsights(3);
    mockUseSWR.mockReturnValue({
      data: { insights: mockInsights, total: 3 },
      error: undefined,
      isLoading: false,
      mutate: mockMutate,
      isValidating: false,
    } as any);

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Failed to dismiss'));

    // Mock console.error to avoid test output noise
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<AIBudgetCoach />, { wrapper: AllProviders });

    const dismissButton = screen.getAllByText('Dismiss')[0];
    fireEvent.click(dismissButton);

    await waitFor(() => {
      // Should call mutate twice: once for optimistic update, once to revert
      expect(mockMutate).toHaveBeenCalledTimes(2);
    });

    consoleErrorSpy.mockRestore();
  });
});
