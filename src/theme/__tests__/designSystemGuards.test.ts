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
  'src/app/goals',
  'src/app/household',
];

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const dir of DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        out.push(path.join(abs, entry.name));
      }
    }
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
    name: 'admin role badge — light (accent on accent.subtle)',
    fg: hex(evergreen['500']!),
    bg: hex(evergreen['50']!),
  },
  {
    name: 'admin role badge — dark (accent on accent.subtle over surface)',
    fg: hex(evergreen['300']!),
    bg: over([11, 94, 74], 0.22, hex(paper['850']!)),
  },
  {
    name: 'member role badge — light (fg.muted on surface.sunken)',
    fg: hex(paper['600']!),
    bg: hex(paper['100']!),
  },
  {
    name: 'member role badge — dark (fg.muted on surface.sunken)',
    fg: hex(paper['400']!),
    bg: hex(paper['900']!),
  },
  {
    name: 'milestone badge — light (warning.fg on achievement.surface)',
    fg: hex(amber['700']!),
    bg: hex('#FFFFF0'),
  },
  {
    name: 'milestone badge — dark (warning.fg on achievement.surface over surface)',
    fg: hex(amber['300']!),
    bg: over([214, 158, 46], 0.16, hex(paper['850']!)),
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
