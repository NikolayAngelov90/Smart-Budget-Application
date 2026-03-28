/**
 * HeatmapGrid Component Tests
 * Story 11.3: Spending Heatmap
 *
 * Task 9.3: Unit tests for HeatmapGrid component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { HeatmapGrid, buildCalendarCells, HEATMAP_COLORS } from '@/components/ai/HeatmapGrid';
import type { DailySpendingEntry } from '@/types/database.types';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'weekdays.mon': 'Mon',
      'weekdays.tue': 'Tue',
      'weekdays.wed': 'Wed',
      'weekdays.thu': 'Thu',
      'weekdays.fri': 'Fri',
      'weekdays.sat': 'Sat',
      'weekdays.sun': 'Sun',
      noSpending: 'No spending',
      title: 'Spending Heatmap',
    };
    return translations[key] ?? key;
  },
}));

const renderWithChakra = (component: React.ReactElement) =>
  render(<ChakraProvider>{component}</ChakraProvider>);

const defaultProps = {
  year: 2026,
  month: 3, // March 2026 starts on Sunday → 6 leading empty cells
  currency: 'EUR',
  showTable: false,
  onDayClick: jest.fn(),
};

// ============================================================================
// PURE HELPER: buildCalendarCells
// ============================================================================

describe('buildCalendarCells', () => {
  it('March 2026: starts on Sunday (6 leading empty cells), 31 days', () => {
    const cells = buildCalendarCells(2026, 3);
    // 6 leading nulls + 31 days + 5 trailing nulls = 42
    expect(cells).toHaveLength(42);
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cells[6]).toBe(1);
    expect(cells[36]).toBe(31);
  });

  it('February 2026: starts on Sunday (6 leading empty cells), 28 days', () => {
    const cells = buildCalendarCells(2026, 2);
    expect(cells.filter((c) => c !== null)).toHaveLength(28);
  });

  it('February 2024 (leap year): has 29 days', () => {
    const cells = buildCalendarCells(2024, 2);
    expect(cells.filter((c) => c !== null)).toHaveLength(29);
  });

  it('total cells is always a multiple of 7', () => {
    for (let month = 1; month <= 12; month++) {
      const cells = buildCalendarCells(2026, month);
      expect(cells.length % 7).toBe(0);
    }
  });

  it('day values are 1 through daysInMonth in sequence', () => {
    const cells = buildCalendarCells(2026, 3);
    const dayValues = cells.filter((c) => c !== null);
    expect(dayValues).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });
});

// ============================================================================
// HEATMAP_COLORS constant
// ============================================================================

describe('HEATMAP_COLORS', () => {
  it('defines 5 intensity levels (0-4)', () => {
    expect(Object.keys(HEATMAP_COLORS)).toHaveLength(5);
  });

  it('level 0 is the lightest color', () => {
    expect(HEATMAP_COLORS[0]).toBe('#f7fafc');
  });

  it('level 4 is Trust Blue (brand primary)', () => {
    expect(HEATMAP_COLORS[4]).toBe('#2b6cb0');
  });
});

// ============================================================================
// COMPONENT: Visual grid mode
// ============================================================================

describe('HeatmapGrid (visual grid mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders 7 weekday column headers', () => {
    renderWithChakra(<HeatmapGrid {...defaultProps} entries={[]} />);
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  it('renders gridcell elements for all cells including aria-hidden empty cells', () => {
    renderWithChakra(<HeatmapGrid {...defaultProps} entries={[]} />);
    // hidden: true includes aria-hidden cells (empty placeholders)
    const allCells = screen.getAllByRole('gridcell', { hidden: true });
    // March 2026: 6 leading + 31 days + 5 trailing = 42
    expect(allCells).toHaveLength(42);
    // Only the 31 day cells are accessible (non-hidden)
    const accessibleCells = screen.getAllByRole('gridcell');
    expect(accessibleCells).toHaveLength(31);
  });

  it('renders a grid container with role="grid"', () => {
    renderWithChakra(<HeatmapGrid {...defaultProps} entries={[]} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('renders aria-label "No spending" for days with no transactions', () => {
    renderWithChakra(<HeatmapGrid {...defaultProps} entries={[]} />);
    const noSpendingCells = screen.getAllByRole('gridcell', { name: /No spending/i });
    expect(noSpendingCells.length).toBeGreaterThan(0);
  });

  it('renders aria-label with amount and count for days with spending', () => {
    const entries: DailySpendingEntry[] = [
      { date: '2026-03-15', total: 142.5, count: 5 },
    ];
    renderWithChakra(<HeatmapGrid {...defaultProps} entries={entries} />);
    const cell = screen.getByRole('gridcell', { name: /142/ });
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveAttribute('aria-label', expect.stringContaining('5 transactions'));
  });

  it('calls onDayClick with date string when a spending day is clicked', () => {
    const onDayClick = jest.fn();
    const entries: DailySpendingEntry[] = [
      { date: '2026-03-15', total: 50.0, count: 2 },
    ];
    renderWithChakra(
      <HeatmapGrid {...defaultProps} entries={entries} onDayClick={onDayClick} />
    );
    const cell = screen.getByRole('gridcell', { name: /50/ });
    fireEvent.click(cell);
    expect(onDayClick).toHaveBeenCalledWith('2026-03-15');
  });

  it('calls onDayClick with Enter key press', () => {
    const onDayClick = jest.fn();
    const entries: DailySpendingEntry[] = [
      { date: '2026-03-15', total: 50.0, count: 1 },
    ];
    renderWithChakra(
      <HeatmapGrid {...defaultProps} entries={entries} onDayClick={onDayClick} />
    );
    const cell = screen.getByRole('gridcell', { name: /50/ });
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(onDayClick).toHaveBeenCalledWith('2026-03-15');
  });

  it('does not call onDayClick when clicking empty day', () => {
    const onDayClick = jest.fn();
    renderWithChakra(
      <HeatmapGrid {...defaultProps} entries={[]} onDayClick={onDayClick} />
    );
    // Click the first non-hidden gridcell (first day, no spending)
    const dayCells = screen.getAllByRole('gridcell', { name: /No spending/i });
    fireEvent.click(dayCells[0]!);
    expect(onDayClick).not.toHaveBeenCalled();
  });

  it('singular "transaction" for count=1, plural "transactions" for count>1', () => {
    const entries: DailySpendingEntry[] = [
      { date: '2026-03-01', total: 10.0, count: 1 },
      { date: '2026-03-02', total: 20.0, count: 3 },
    ];
    renderWithChakra(<HeatmapGrid {...defaultProps} entries={entries} />);
    expect(screen.getByRole('gridcell', { name: /1 transaction\b/ })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /3 transactions/ })).toBeInTheDocument();
  });
});

// ============================================================================
// COMPONENT: Data table mode
// ============================================================================

describe('HeatmapGrid (data table mode)', () => {
  it('renders a table element when showTable is true', () => {
    const entries: DailySpendingEntry[] = [
      { date: '2026-03-05', total: 25.0, count: 2 },
      { date: '2026-03-10', total: 100.0, count: 3 },
    ];
    renderWithChakra(
      <HeatmapGrid {...defaultProps} showTable entries={entries} />
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows all entry rows in table mode', () => {
    const entries: DailySpendingEntry[] = [
      { date: '2026-03-05', total: 25.0, count: 2 },
      { date: '2026-03-10', total: 100.0, count: 3 },
    ];
    renderWithChakra(
      <HeatmapGrid {...defaultProps} showTable entries={entries} />
    );
    expect(screen.getByText('2026-03-05')).toBeInTheDocument();
    expect(screen.getByText('2026-03-10')).toBeInTheDocument();
  });

  it('shows "No spending" message in table mode when no entries', () => {
    renderWithChakra(
      <HeatmapGrid {...defaultProps} showTable entries={[]} />
    );
    expect(screen.getByText('No spending')).toBeInTheDocument();
  });

  it('does not render the visual grid when showTable is true', () => {
    renderWithChakra(
      <HeatmapGrid {...defaultProps} showTable entries={[]} />
    );
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
