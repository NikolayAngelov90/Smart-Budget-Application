'use client';

/**
 * Chart palette — Story 16.5
 *
 * Recharts takes raw colour STRINGS for SVG strokes/fills, so it can't consume
 * Chakra semantic tokens the way components do. Charts were therefore pinned to
 * light-mode hex (axis text `#4A5568`, grid `#E2E8F0`), which is effectively
 * invisible on a dark canvas.
 *
 * These are CSS VARIABLES, not `useColorModeValue` hex. Chakra's colour mode is
 * React state that only settles AFTER hydration, so a hex palette painted one
 * light frame on top of an already-dark canvas on every load. The `data-theme`
 * stamp from the pre-hydration script flips these variables in the very first
 * paint instead — verified in-browser that `var()` resolves when recharts sets
 * it as an SVG presentation attribute (`fill="var(--…)"`), not just via CSS.
 *
 * It also means the palette is a stable constant: no hook subscription, and
 * charts stop re-rendering on every colour-mode change.
 */

export interface ChartColors {
  /** Axis lines. */
  axis: string;
  /** Axis tick labels + legend text. */
  tick: string;
  /** Background grid lines. */
  grid: string;
  /** Hover cursor line. */
  cursor: string;
  /** Money in (evergreen). */
  income: string;
  /** Money out (clay). */
  expense: string;
  /** Neutral/primary series (accent). */
  accent: string;
  /** Tooltip surface + its border. */
  tooltipBg: string;
  tooltipBorder: string;
}

const CHART_COLORS: ChartColors = {
  axis: 'var(--chakra-colors-fg-muted)',
  tick: 'var(--chakra-colors-fg-muted)',
  grid: 'var(--chakra-colors-border)',
  cursor: 'var(--chakra-colors-border-strong)',
  income: 'var(--chakra-colors-income)',
  expense: 'var(--chakra-colors-expense)',
  accent: 'var(--chakra-colors-accent)',
  tooltipBg: 'var(--chakra-colors-surface)',
  tooltipBorder: 'var(--chakra-colors-border)',
};

export function useChartColors(): ChartColors {
  return CHART_COLORS;
}
