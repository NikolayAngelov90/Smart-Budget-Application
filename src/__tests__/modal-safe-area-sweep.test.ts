/**
 * @jest-environment node
 */

/**
 * Every full-bleed modal must reserve the safe-area insets.
 *
 * `viewportFit: 'cover'` (layout.tsx) puts the content box at the PHYSICAL top
 * of the display. A modal at `size={{ base: 'full' }}` therefore draws its first
 * line under the Dynamic Island and its last control in the home-indicator
 * strip, on every notched iPhone in PWA standalone.
 *
 * hp-9 fixed this on InsightDetailModal and TransactionEntryModal, and claimed
 * InsightDetailModal was "the only modal with no safe-area handling". That was
 * FALSE — CategoryModal and OnboardingModal had the same defect, and
 * OnboardingModal is the first screen a new user ever sees. hp-11 fixed those
 * and replaced the claim with this sweep.
 *
 * CLASS GUARD, not a per-file one, deliberately: the failure mode was a NEW
 * full-bleed modal being added without the insets, which two file-specific
 * assertions cannot catch. Adding `size={{ base: 'full' }}` anywhere now fails
 * this suite until the insets come with it.
 *
 * It asserts on the PADDING PROPERTIES, not on the presence of the string
 * `env(safe-area-inset-top)` anywhere in the file. hp-9 learned that the hard
 * way: its guard was satisfied by the close button's own `top`, so deleting the
 * `pt` that fixes the actual defect left every test green.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'src');

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      sourceFiles(full, acc);
    } else if (entry.name.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

const rel = (f: string) => path.relative(process.cwd(), f).replace(/\\/g, '/');

/** Files rendering a modal at full bleed on the base (mobile) breakpoint. */
const FULL_BLEED = /size=\{\{\s*base:\s*'full'/;
/**
 * A bottom-anchored drawer sits on the home indicator, so it needs that inset.
 *
 * Both halves are required. `placement="bottom"` alone also matches Tooltip,
 * Popover and Menu — the first version of this flagged
 * SyncStatusIndicator.tsx, which contains a `<Tooltip placement="bottom">` and
 * no Drawer at all. Adding a safe-area inset to a tooltip would have been
 * nonsense, and a guard that reports nonsense gets deleted, taking the real
 * coverage with it.
 */
const hasBottomDrawer = (src: string) => /<Drawer[\s>]/.test(src) && /placement="bottom"/.test(src);

const TOP_INSET_PADDING = /p[tby]=\{\{[^}]*env\(safe-area-inset-top\)/;
const BOTTOM_INSET_PADDING = /p[bby]=\{\{[^}]*env\(safe-area-inset-bottom\)/;

const files = sourceFiles(SRC).map((f) => ({ file: f, src: fs.readFileSync(f, 'utf8') }));
const fullBleed = files.filter(({ src }) => FULL_BLEED.test(src));
const bottomDrawers = files.filter(({ src }) => hasBottomDrawer(src));

describe('safe-area sweep', () => {
  it('every full-bleed modal reserves the TOP inset in a padding property', () => {
    const offenders = fullBleed
      .filter(({ src }) => !TOP_INSET_PADDING.test(src))
      .map(({ file }) => rel(file));
    expect(offenders).toEqual([]);
  });

  it('every full-bleed modal reserves the BOTTOM inset in a padding property', () => {
    const offenders = fullBleed
      .filter(({ src }) => !BOTTOM_INSET_PADDING.test(src))
      .map(({ file }) => rel(file));
    expect(offenders).toEqual([]);
  });

  it('every bottom-anchored drawer reserves the BOTTOM inset', () => {
    const offenders = bottomDrawers
      .filter(({ src }) => !/env\(safe-area-inset-bottom\)/.test(src))
      .map(({ file }) => rel(file));
    expect(offenders).toEqual([]);
  });

  // ---- non-vacuity -------------------------------------------------------
  // Every assertion above passes trivially if the detectors match nothing. A
  // renamed prop, a reformatted `size`, a moved directory — any of those turns
  // this suite into decoration that still reports green. Prove it is looking at
  // something real before trusting its silence.

  it('the full-bleed detector finds the modals we know are full-bleed', () => {
    const found = fullBleed.map(({ file }) => rel(file));
    expect(found).toEqual(
      expect.arrayContaining([
        'src/components/categories/CategoryModal.tsx',
        'src/components/common/OnboardingModal.tsx',
      ])
    );
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it('the bottom-drawer detector finds the sheets we know are bottom-anchored', () => {
    const found = bottomDrawers.map(({ file }) => rel(file));
    expect(found).toEqual(
      expect.arrayContaining([
        'src/components/layout/AccountSheet.tsx',
        'src/components/layout/MoreSheet.tsx',
      ])
    );
  });

  it('the padding detectors match a real declaration, not any occurrence', () => {
    // A file containing the inset only in some non-padding property (a `top`,
    // say) must NOT satisfy the padding detectors — that exact confusion is
    // what made hp-9's guard vacuous.
    expect(TOP_INSET_PADDING.test("top={{ base: 'env(safe-area-inset-top)' }}")).toBe(false);
    expect(TOP_INSET_PADDING.test("pt={{ base: 'env(safe-area-inset-top)' }}")).toBe(true);
    expect(
      BOTTOM_INSET_PADDING.test("pb={{ base: 'calc(env(safe-area-inset-bottom) + 2rem)' }}")
    ).toBe(true);
  });
});
