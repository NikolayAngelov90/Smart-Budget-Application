'use client';

/**
 * Chart palette — Story 16.5
 *
 * Recharts takes raw colour STRINGS for SVG strokes/fills, so it can't consume
 * Chakra semantic tokens the way components do. Charts were therefore pinned to
 * light-mode hex (axis text `#4A5568`, grid `#E2E8F0`), which is effectively
 * invisible on a dark canvas.
 *
 * One hook resolves the palette per colour mode so every chart stays legible in
 * both, and chart theming lives in a single place.
 */

import { useColorModeValue } from '@chakra-ui/react';

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

export function useChartColors(): ChartColors {
  return {
    // paper.600 / paper.400 — readable label grey in each mode
    axis: useColorModeValue('#5F5B52', '#A8A49A'),
    tick: useColorModeValue('#5F5B52', '#A8A49A'),
    // paper.200 / paper.800 — a grid you can see but not fight
    grid: useColorModeValue('#E1DFD8', '#26241F'),
    cursor: useColorModeValue('#CFCCC2', '#443F38'),
    // evergreen.500 / evergreen.300 — matches the `income` semantic token
    income: useColorModeValue('#0B5E4A', '#6BB09A'),
    // clay.600 / clay.300 — matches the `expense` semantic token
    expense: useColorModeValue('#AC4C30', '#D98A6D'),
    accent: useColorModeValue('#0B5E4A', '#6BB09A'),
    // paper.0 / paper.850 — matches `surface`
    tooltipBg: useColorModeValue('#FFFFFF', '#1B1A16'),
    tooltipBorder: useColorModeValue('#E1DFD8', '#26241F'),
  };
}
