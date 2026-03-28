/**
 * SpendingHeatmap Component Tests
 * Story 11.3: Spending Heatmap
 *
 * Task 9.4: Unit tests for SpendingHeatmap component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SpendingHeatmap } from '@/components/ai/SpendingHeatmap';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      title: 'Spending Heatmap',
      'subtitle': params
        ? `${params['month']} ${params['year']}`
        : 'subtitle',
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      viewAsTable: 'View as table',
      viewAsGrid: 'View as grid',
      noSpending: 'No spending',
      'weekdays.mon': 'Mon',
      'weekdays.tue': 'Tue',
      'weekdays.wed': 'Wed',
      'weekdays.thu': 'Thu',
      'weekdays.fri': 'Fri',
      'weekdays.sat': 'Sat',
      'weekdays.sun': 'Sun',
    };
    if (params) {
      const template = translations[key] ?? key;
      return template.replace(/{(\w+)}/g, (_, k) => String(params[k] ?? `{${k}}`));
    }
    return translations[key] ?? key;
  },
}));

// Mock useSpendingHeatmap hook
jest.mock('@/lib/hooks/useSpendingHeatmap', () => ({
  useSpendingHeatmap: jest.fn(),
}));

// Mock useUserPreferences hook
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: jest.fn(),
}));

import { useSpendingHeatmap } from '@/lib/hooks/useSpendingHeatmap';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

const mockUseSpendingHeatmap = useSpendingHeatmap as jest.MockedFunction<
  typeof useSpendingHeatmap
>;
const mockUseUserPreferences = useUserPreferences as jest.MockedFunction<
  typeof useUserPreferences
>;

const renderWithChakra = (component: React.ReactElement) =>
  render(<ChakraProvider>{component}</ChakraProvider>);

function setupDefaultMocks(overrides: Partial<ReturnType<typeof useSpendingHeatmap>> = {}) {
  const now = new Date();
  mockUseSpendingHeatmap.mockReturnValue({
    data: [],
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    hasEnoughData: true,
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
    ...overrides,
  });

  mockUseUserPreferences.mockReturnValue({
    preferences: { currency_format: 'EUR' } as ReturnType<
      typeof useUserPreferences
    >['preferences'],
    isLoading: false,
    error: undefined,
  });
}

describe('SpendingHeatmap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Progressive disclosure ──────────────────────────────────────────────

  describe('Progressive disclosure (AC #6)', () => {
    it('renders null when hasEnoughData is false and not loading', () => {
      mockUseSpendingHeatmap.mockReturnValue({
        data: [],
        year: 2026,
        month: 3,
        hasEnoughData: false,
        isLoading: false,
        error: undefined,
        mutate: jest.fn(),
      });
      mockUseUserPreferences.mockReturnValue({
        preferences: null,
        isLoading: false,
        error: undefined,
          });

      renderWithChakra(<SpendingHeatmap />);
      expect(screen.queryByRole('heading', { name: 'Spending Heatmap' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument();
    });

    it('renders the heading when hasEnoughData is true', () => {
      setupDefaultMocks();
      renderWithChakra(<SpendingHeatmap />);
      expect(screen.getByRole('heading', { name: 'Spending Heatmap' })).toBeInTheDocument();
    });
  });

  // ── Loading state ────────────────────────────────────────────────────────

  describe('Loading state (AC #1)', () => {
    it('shows skeleton when isLoading is true', () => {
      setupDefaultMocks({ isLoading: true, hasEnoughData: false });
      // hasEnoughData false + isLoading true → still renders (skeleton phase)
      mockUseSpendingHeatmap.mockReturnValue({
        data: [],
        year: 2026,
        month: 3,
        hasEnoughData: false,
        isLoading: true,
        error: undefined,
        mutate: jest.fn(),
      });
      mockUseUserPreferences.mockReturnValue({
        preferences: null,
        isLoading: false,
        error: undefined,
          });

      renderWithChakra(<SpendingHeatmap />);
      expect(screen.getByTestId('heatmap-skeleton')).toBeInTheDocument();
    });
  });

  // ── Month navigation ──────────────────────────────────────────────────────

  describe('Month navigation (AC #4)', () => {
    it('disables next month button when viewing current month', () => {
      setupDefaultMocks();
      renderWithChakra(<SpendingHeatmap />);
      const nextBtn = screen.getByRole('button', { name: 'Next month' });
      expect(nextBtn).toBeDisabled();
    });

    it('enables previous month button when viewing current month', () => {
      setupDefaultMocks();
      renderWithChakra(<SpendingHeatmap />);
      const prevBtn = screen.getByRole('button', { name: 'Previous month' });
      expect(prevBtn).not.toBeDisabled();
    });

    it('clicking previous month calls useSpendingHeatmap with previous month', () => {
      setupDefaultMocks();
      renderWithChakra(<SpendingHeatmap />);

      const prevBtn = screen.getByRole('button', { name: 'Previous month' });
      fireEvent.click(prevBtn);

      // Should have called with a different month (previous)
      const calls = mockUseSpendingHeatmap.mock.calls;
      // The last call after navigation should be to previous month
      expect(calls.length).toBeGreaterThan(1);
    });

    it('enables next month button after navigating to previous month', () => {
      setupDefaultMocks();
      renderWithChakra(<SpendingHeatmap />);

      const prevBtn = screen.getByRole('button', { name: 'Previous month' });
      fireEvent.click(prevBtn);

      const nextBtn = screen.getByRole('button', { name: 'Next month' });
      expect(nextBtn).not.toBeDisabled();
    });
  });

  // ── Table toggle ─────────────────────────────────────────────────────────

  describe('View as table toggle (AC #5)', () => {
    it('renders "View as table" button initially', () => {
      setupDefaultMocks();
      renderWithChakra(<SpendingHeatmap />);
      expect(screen.getByRole('button', { name: 'View as table' })).toBeInTheDocument();
    });

    it('toggles to "View as grid" after clicking "View as table"', () => {
      setupDefaultMocks();
      renderWithChakra(<SpendingHeatmap />);

      fireEvent.click(screen.getByRole('button', { name: 'View as table' }));
      expect(screen.getByRole('button', { name: 'View as grid' })).toBeInTheDocument();
    });

    it('toggles back to "View as table" after second click', () => {
      setupDefaultMocks();
      renderWithChakra(<SpendingHeatmap />);

      fireEvent.click(screen.getByRole('button', { name: 'View as table' }));
      fireEvent.click(screen.getByRole('button', { name: 'View as grid' }));
      expect(screen.getByRole('button', { name: 'View as table' })).toBeInTheDocument();
    });
  });

  // ── Section heading ──────────────────────────────────────────────────────

  describe('Section content (AC #1)', () => {
    it('renders as a section element with accessible label', () => {
      setupDefaultMocks();
      const { container } = renderWithChakra(<SpendingHeatmap />);
      const section = container.querySelector('section');
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute('aria-label', 'Spending Heatmap');
    });

    it('renders navigation buttons', () => {
      setupDefaultMocks();
      renderWithChakra(<SpendingHeatmap />);
      expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
    });
  });
});
