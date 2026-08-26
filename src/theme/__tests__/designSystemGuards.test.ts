/**
 * @jest-environment node
 */

/**
 * Quiet Ledger design-system guards — Story 16.7.
 *
 * Two things this repo has learned the hard way:
 *
 * 1. A value-grep during review is not enough. `colorScheme={x ? 'blue' : 'gray'}`
 *    survived three redesign stories and kept painting Chakra's #3182ce, because
 *    reviewers grepped for the literal string `"blue"`. The first block below
 *    catches the dynamic form too.
 * 2. Contrast regressions ship when a state is not reachable in the dev account.
 *    The admin role badge was 4.01:1 in dark mode and no browser audit caught it,
 *    because the test account has no household members. The second block computes
 *    the pairings directly instead of waiting for them to render.
 */

import fs from 'fs';
import path from 'path';
import { colors } from '../colors';

const ROOT = path.resolve(__dirname, '../../..');
const DIRS = [
  'src/components/goals',
  'src/components/household',
  // Changed by Story 16.7 and rendered in the Header on every page — the first
  // version of this guard omitted it, which is exactly how it drifted before.
  'src/components/shared',
  'src/app/goals',
  'src/app/household',
];

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const dir of DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          out.push(full);
        }
      }
    };
    walk(abs);
  }
  return out;
}

/** Chakra default palettes that are not part of this design system. */
const OFF_SYSTEM = ['blue', 'green', 'gray', 'purple', 'teal', 'orange', 'pink', 'cyan'];

describe('Goals & Household stay on the design system', () => {
  const files = sourceFiles();

  it('finds the source files it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(OFF_SYSTEM)('never uses colorScheme %s — static or dynamic', (scheme) => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      // Static: colorScheme="blue".  Dynamic: colorScheme={cond ? 'blue' : …}
      const staticHit = new RegExp(`colorScheme=["']${scheme}["']`).test(src);
      const dynamicHit = new RegExp(`colorScheme=\\{[^}]*['"]${scheme}['"]`).test(src);
      if (staticHit || dynamicHit) offenders.push(path.relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('allows colorScheme red only on destructive controls', () => {
    // The app's own convention (DangerZoneSection); the theme deliberately
    // passes red through so destructive actions stay unmistakable.
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (!/colorScheme=["']red["']/.test(line)) return;
        const window = lines.slice(Math.max(0, i - 6), i + 8).join(' ');
        expect(window).toMatch(/delete|remove|revoke|cancel|danger/i);
      });
    }
  });

  it('uses no raw hex colours outside the theme palette', () => {
    const allowed = new Set<string>();
    const collect = (v: unknown) => {
      if (typeof v === 'string' && v.startsWith('#')) allowed.add(v.toUpperCase());
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    };
    collect(colors);

    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const hex of src.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
        if (!allowed.has(hex.toUpperCase())) {
          offenders.push(`${path.relative(ROOT, file)}: ${hex}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── contrast ────────────────────────────────────────────────────────────────

type RGB = [number, number, number];

const hex = (h: string): RGB => {
  const v = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.substr(i, 2), 16)) as RGB;
};
const over = (fg: RGB, alpha: number, bg: RGB): RGB =>
  fg.map((c, i) => c * alpha + bg[i]! * (1 - alpha)) as RGB;
const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]: RGB) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const evergreen = colors.evergreen as Record<string, string>;
const paper = colors.paper as Record<string, string>;
const amber = colors.amber as Record<string, string>;

/**
 * Badge pairings introduced by Story 16.7, resolved through the semantic
 * tokens in `src/theme/index.ts`. All carry small text, so AA is 4.5:1.
 */
const PAIRINGS: { name: string; fg: RGB; bg: RGB }[] = [
  {
    name: 'admin role badge — light (income subtle)',
    fg: hex(evergreen['800']!),
    bg: hex(evergreen['100']!),
  },
  {
    name: 'admin role badge — dark (income subtle)',
    fg: hex(evergreen['200']!),
    bg: over(hex(evergreen['200']!), 0.16, hex(paper['850']!)),
  },
  {
    name: 'member role badge — light (paper subtle)',
    fg: hex(paper['800']!),
    bg: hex(paper['100']!),
  },
  {
    name: 'member role badge — dark (paper subtle)',
    fg: hex(paper['200']!),
    bg: over(hex(paper['200']!), 0.16, hex(paper['850']!)),
  },
  {
    name: 'milestone badge — light (amber subtle)',
    fg: hex(amber['800']!),
    bg: hex(amber['100']!),
  },
  {
    name: 'milestone badge — dark (amber subtle)',
    fg: hex(amber['200']!),
    bg: over(hex(amber['200']!), 0.16, hex(paper['850']!)),
  },
];

describe('Story 16.7 badge pairings meet WCAG AA', () => {
  it.each(PAIRINGS)('$name', ({ fg, bg }) => {
    // Regression lock: the dark admin badge shipped at 4.01:1 using
    // accent.emphasis (evergreen.400) and no rendered audit caught it, because
    // the QA account has no household members to render a role badge at all.
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * A badge is two contrast problems, not one. Checking only text-on-badge
 * passes a chip whose background is invisible against the card it sits on —
 * which is exactly what `achievement.surface` (yellow.50, 1.01:1 on a white
 * Card) did. These assert the PILL is distinguishable from the card.
 *
 * The bar is deliberately low: a subtle badge is meant to be quiet. It is set
 * just under what Chakra's own `subtle` recipe achieves, so the guard fires on
 * "the pill disappeared", not on "the pill is understated".
 */
const CARD_LIGHT = hex(paper['0']!);
const CARD_DARK = hex(paper['850']!);
const MIN_PILL = 1.15;

const transparentize = (h: string, alpha: number, base: RGB) => over(hex(h), alpha, base);

const PILLS: { name: string; light: RGB; dark: RGB }[] = [
  {
    name: 'amber badge (milestone)',
    light: hex(amber['100']!),
    dark: transparentize(amber['200']!, 0.16, CARD_DARK),
  },
  {
    name: 'paper badge (neutral / member role)',
    light: hex(paper['100']!),
    dark: transparentize(paper['200']!, 0.16, CARD_DARK),
  },
  {
    name: 'income badge (admin role)',
    light: hex(evergreen['100']!),
    dark: transparentize(evergreen['200']!, 0.16, CARD_DARK),
  },
];

describe('Story 16.7 badges stay visible as pills against their card', () => {
  it.each(PILLS)('$name — light', ({ light }) => {
    expect(contrast(light, CARD_LIGHT)).toBeGreaterThanOrEqual(MIN_PILL);
  });

  it.each(PILLS)('$name — dark', ({ dark }) => {
    expect(contrast(dark, CARD_DARK)).toBeGreaterThanOrEqual(MIN_PILL);
  });

  it('rejects a card-background token used as a badge background', () => {
    // achievement.surface is for CARDS. Used as a chip on a white card it is
    // 1.01:1 — the shape vanishes and the label floats. Kept as an executable
    // note so nobody reaches for it again.
    const achievementSurfaceLight = hex('#FFFFF0');
    expect(contrast(achievementSurfaceLight, CARD_LIGHT)).toBeLessThan(MIN_PILL);
  });
});


/**
 * The contrast blocks above assert facts about `colors.ts`. On their own they
 * do NOT stop a component from pointing at a different token — flipping the
 * admin badge back to `accent.emphasis` leaves every one of them green, which
 * is precisely the regression this story fixed.
 *
 * These close that loop by reading the component source, so the guard fails if
 * the badge stops using the treatment whose contrast is verified above.
 */
describe('role badges keep pointing at the verified treatment', () => {
  const roleBadgeFiles = [
    'src/components/household/HouseholdMembers.tsx',
    // Story 17.1: the role badge moved out of HouseholdSection to the index's
    // summary card. Same recipe, new home.
    'src/components/household/HouseholdSummaryCard.tsx',
  ];

  it.each(roleBadgeFiles)('%s uses the income/paper subtle recipe', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');

    expect(src).toMatch(/role === 'admin'/);
    expect(src).toMatch(/\{ colorScheme: 'income' \}/);
    expect(src).toMatch(/\{ colorScheme: 'paper' \}/);

    // The exact pairing that shipped at 4.01:1 in dark mode.
    expect(src).not.toMatch(/color: 'accent\.emphasis'/);
    // A card-background token used as a chip background (1.01:1 on a white card).
    expect(src).not.toMatch(/bg: 'achievement\.surface'/);
  });

  it('milestone badges use the amber recipe, not a card-surface token', () => {
    for (const rel of [
      'src/components/goals/GoalCard.tsx',
      'src/components/goals/MilestoneOverlay.tsx',
      'src/components/goals/WishlistItem.tsx',
    ]) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(src).not.toMatch(/bg="achievement\.surface"/);
    }
  });
});
