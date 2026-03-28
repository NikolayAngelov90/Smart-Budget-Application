'use client';

/**
 * HeatmapGrid Component
 * Story 11.3: Spending Heatmap
 *
 * Calendar grid displaying daily spending intensity using color gradients.
 * Composition: Chakra Grid + Box + Tooltip
 *
 * Accessibility:
 * - role="grid" on container, role="gridcell" per day cell
 * - aria-label per cell: "[Month Day]: [Amount] spent, [Count] transaction(s)"
 * - VisuallyHidden data table for screen readers (always present)
 * - Visible data table when showTable is true
 */

import {
  Box,
  Grid,
  Tooltip,
  VisuallyHidden,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { getIntensityLevel } from '@/lib/services/heatmapService';
import type { DailySpendingEntry, IntensityLevel } from '@/types/database.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** 5-level color intensity scale: 0 = no spending, 4 = peak spending (Trust Blue) */
export const HEATMAP_COLORS: Record<IntensityLevel, string> = {
  0: '#f7fafc', // No spending — Chakra gray.50
  1: '#bee3f8', // Low (~0-25% of max) — Chakra blue.100
  2: '#63b3ed', // Medium-low (~25-50%) — Chakra blue.300
  3: '#4299e1', // Medium-high (~50-75%) — Chakra blue.400
  4: '#2b6cb0', // High (~75-100%) — Trust Blue (brand primary)
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Builds the calendar cells array for a month using Monday-first layout.
 * Returns null for empty leading/trailing cells, day number for actual days.
 */
export function buildCalendarCells(year: number, month: number): (number | null)[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const rawFirstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun, 1=Mon...
  const firstDayMon = (rawFirstDay + 6) % 7; // Convert: Mon=0, Tue=1, ..., Sun=6

  const cells: (number | null)[] = [];
  // Leading empty cells for alignment
  for (let i = 0; i < firstDayMon; i++) cells.push(null);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Trailing empty cells to complete the last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Format amount using Intl.NumberFormat with the user's currency */
function formatAmount(amount: number, currency: string): string {
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export interface HeatmapGridProps {
  entries: DailySpendingEntry[];
  year: number;
  /** Month number (1-12) */
  month: number;
  currency: string;
  /** When true, shows a visible data table instead of the visual grid */
  showTable: boolean;
  onDayClick?: (date: string) => void;
}

export function HeatmapGrid({
  entries,
  year,
  month,
  currency,
  showTable,
  onDayClick,
}: HeatmapGridProps) {
  const t = useTranslations('heatmap');

  // O(1) lookup map: date string → entry
  const entryMap = new Map(entries.map((e) => [e.date, e]));

  // Compute max daily spend for intensity scaling
  const maxAmount = entries.length > 0 ? Math.max(...entries.map((e) => e.total)) : 0;

  const cells = buildCalendarCells(year, month);
  const paddedMonth = String(month).padStart(2, '0');

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));

  const weekdays = [
    t('weekdays.mon'),
    t('weekdays.tue'),
    t('weekdays.wed'),
    t('weekdays.thu'),
    t('weekdays.fri'),
    t('weekdays.sat'),
    t('weekdays.sun'),
  ];

  // ── Visible data table mode ──────────────────────────────────────────────
  if (showTable) {
    return (
      <TableContainer>
        <Table size="sm" variant="simple" aria-label={monthLabel}>
          <caption
            style={{ captionSide: 'top', textAlign: 'left', marginBottom: '8px', fontWeight: 600 }}
          >
            {monthLabel}
          </caption>
          <Thead>
            <Tr>
              <Th>{t('tableDate')}</Th>
              <Th isNumeric>{t('tableAmount')}</Th>
              <Th isNumeric>{t('tableTransactions')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {entries.length === 0 ? (
              <Tr>
                <Td colSpan={3} textAlign="center" color="gray.500">
                  {t('noSpending')}
                </Td>
              </Tr>
            ) : (
              entries.map((entry) => (
                <Tr key={entry.date}>
                  <Td>{entry.date}</Td>
                  <Td isNumeric>{formatAmount(entry.total, currency)}</Td>
                  <Td isNumeric>{entry.count}</Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableContainer>
    );
  }

  // ── Visual calendar grid mode ────────────────────────────────────────────
  return (
    <Box overflowX={{ base: 'auto', md: 'visible' }}>
      {/* Screen-reader accessible data table (always hidden visually) */}
      <VisuallyHidden>
        <table aria-label={`${monthLabel} spending data`}>
          <caption>{monthLabel}</caption>
          <thead>
            <tr>
              <th>{t('tableDate')}</th>
              <th>{t('tableAmount')}</th>
              <th>{t('tableTransactions')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.date}>
                <td>{entry.date}</td>
                <td>{formatAmount(entry.total, currency)}</td>
                <td>
                  {entry.count} {entry.count === 1 ? t('transaction') : t('transactions')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>

      {/* Visual grid */}
      <Box minW={{ base: '280px', md: 'auto' }} role="grid" aria-label={monthLabel}>
        {/* Weekday header row */}
        <Grid
          templateColumns="repeat(7, minmax(32px, 1fr))"
          gap={1}
          mb={1}
          role="row"
          aria-rowindex={1}
        >
          {weekdays.map((day) => (
            <Box
              key={day}
              role="columnheader"
              textAlign="center"
              fontSize="xs"
              color="gray.500"
              fontWeight="medium"
              py={1}
            >
              {day}
            </Box>
          ))}
        </Grid>

        {/* Day cells — split into weekly rows for ARIA grid/row/gridcell hierarchy (AC #7) */}
        {Array.from({ length: cells.length / 7 }, (_, weekIndex) => (
          <Grid
            key={`week-${weekIndex}`}
            templateColumns="repeat(7, minmax(32px, 1fr))"
            gap={1}
            role="row"
            aria-rowindex={weekIndex + 2}
          >
            {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => {
              const cellIndex = weekIndex * 7 + dayIndex;

              // Empty placeholder cell
              if (day === null) {
                return (
                  <Box
                    key={`empty-${cellIndex}`}
                    role="gridcell"
                    aria-hidden="true"
                    w={{ base: '32px', md: '40px' }}
                    h={{ base: '32px', md: '40px' }}
                  />
                );
              }

              const dateStr = `${year}-${paddedMonth}-${String(day).padStart(2, '0')}`;
              const entry = entryMap.get(dateStr);
              const level = entry ? getIntensityLevel(entry.total, maxAmount) : 0;
              const bgColor = HEATMAP_COLORS[level];

              const dayLabel = new Intl.DateTimeFormat(undefined, {
                month: 'long',
                day: 'numeric',
              }).format(new Date(year, month - 1, day));

              const txWord = entry
                ? entry.count === 1
                  ? t('transaction')
                  : t('transactions')
                : '';

              const ariaLabel = entry
                ? `${dayLabel}: ${formatAmount(entry.total, currency)} spent, ${entry.count} ${txWord}`
                : `${dayLabel}: ${t('noSpending')}`;

              const tooltipContent = entry
                ? `${formatAmount(entry.total, currency)}\n${entry.count} ${txWord}`
                : t('noSpending');

              const isClickable = Boolean(entry && onDayClick);

              return (
                <Tooltip key={dateStr} label={tooltipContent} placement="top" hasArrow>
                  <Box
                    role="gridcell"
                    aria-label={ariaLabel}
                    tabIndex={0}
                    w={{ base: '32px', md: '40px' }}
                    h={{ base: '32px', md: '40px' }}
                    bg={bgColor}
                    borderRadius="sm"
                    border="1px solid"
                    borderColor="gray.100"
                    cursor={isClickable ? 'pointer' : 'default'}
                    _hover={isClickable ? { opacity: 0.8, borderColor: 'trustBlue.300' } : {}}
                    _focus={{
                      outline: '2px solid',
                      outlineColor: 'trustBlue.500',
                      outlineOffset: '2px',
                    }}
                    onClick={() => {
                      if (isClickable) onDayClick?.(dateStr);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && isClickable) {
                        e.preventDefault();
                        onDayClick?.(dateStr);
                      }
                    }}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  />
                </Tooltip>
              );
            })}
          </Grid>
        ))}
      </Box>
    </Box>
  );
}
