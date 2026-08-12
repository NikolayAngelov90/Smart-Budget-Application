/**
 * @jest-environment node
 */

/**
 * Modal safe-area and keyboard guards — hp-9.
 *
 * Two defects on a notched iPhone in PWA standalone:
 *
 *  1. `InsightDetailModal` was the only modal with no safe-area handling. With
 *     `viewportFit: 'cover'` (layout.tsx) the content box starts at the PHYSICAL
 *     top of the display, so the title rendered through the system clock, the
 *     badge sat under the status icons, and the close button landed in the band
 *     where a downward swipe opens Control Centre.
 *  2. The transaction composer carried a bare `autoFocus` on the amount field.
 *     iOS raised the keyboard while the bottom-sheet Drawer was still animating
 *     in, then scrolled the document to reveal the focused input — dragging the
 *     whole fixed-position sheet up past its own header, so the user typed into
 *     an Amount field that had scrolled off the top of the screen.
 *
 * These are SOURCE assertions, and that is not laziness: jsdom has no layout
 * engine and reports every width and offset as 0, so neither defect can be
 * caught by rendering. The visual proof is the Playwright before/after pair in
 * the story file; this is the regression guard.
 *
 * Measured with the insets emulated at the iPhone 15 Pro Max values
 * (top 59px, bottom 34px) — desktop Chromium has no notch and reports 0.
 *   before: header top 0, close button top 16   -> both inside the 59px band
 *   after:  header top 59, close button top 71  -> both clear
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const INSIGHT_MODAL = 'src/components/insights/InsightDetailModal.tsx';
const COMPOSER = 'src/components/transactions/TransactionEntryModal.tsx';

describe('InsightDetailModal respects the safe area', () => {
  it('reserves both the top and bottom insets', () => {
    const src = read(INSIGHT_MODAL);

    expect(src).toMatch(/env\(safe-area-inset-top\)/);
    expect(src).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it('offsets the absolutely-positioned close button by the top inset', () => {
    // The button is out of flow, so it does not inherit the content padding and
    // needs its own offset — the same reason the Drawer's close button has one.
    const src = read(INSIGHT_MODAL);

    expect(src).toMatch(/top=\{\{[^}]*calc\(env\(safe-area-inset-top\)/);
  });

  it('sizes with dvh and keeps a vh fallback', () => {
    // `100vh` alone is wrong on iOS: it is the LAYOUT viewport, so it ignores
    // the browser chrome and the keyboard. Pattern from AppLayout.
    const src = read(INSIGHT_MODAL);

    expect(src).toMatch(/@supports \(height: 100dvh\)/);
    expect(src).toMatch(/maxHeight: '100vh'/);
  });

  it('gives the close button a 44px tap target', () => {
    // Measured at 40x40 with `size="lg"` alone, under the repo's 44px rule.
    const src = read(INSIGHT_MODAL);

    expect(src).toMatch(/minW="44px"/);
    expect(src).toMatch(/minH="44px"/);
  });

  it('reserves a column for the close button in the header', () => {
    // The button is absolutely positioned, so the header laid its badge
    // straight underneath it until the header reserved the space.
    const src = read(INSIGHT_MODAL);

    expect(src).toMatch(/<ModalHeader[^>]*pr=/);
  });
});

describe('the composer does not raise the keyboard on mobile', () => {
  it('never carries a bare autoFocus', () => {
    // THE defect. `autoFocus` with no expression applies on every breakpoint.
    //
    // Comments are stripped first: the fix's own explanatory comment contains
    // the word `autoFocus` in prose, and without stripping this guard matched
    // that and failed against correct code. A guard that trips on the sentence
    // explaining it is worse than no guard.
    const src = read(COMPOSER).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

    // A bare attribute is `autoFocus` not followed by `=`.
    expect(/autoFocus(?!\s*=)/.test(src)).toBe(false);
  });

  it('gates focus on the breakpoint value, not a user-agent sniff', () => {
    const src = read(COMPOSER);

    expect(src).toMatch(/autoFocus=\{!isMobile\}/);
    // `isMobile` must come from the breakpoint the component already computes.
    expect(src).toMatch(/const isMobile = useBreakpointValue\(/);
  });

  it('sizes the sheet against the visual viewport', () => {
    // `95vh` reserves height the keyboard has already taken, leaving a band of
    // dead space between the last control and the keyboard accessory bar.
    const src = read(COMPOSER);

    expect(src).toMatch(/@supports \(height: 100dvh\)/);
    expect(src).toMatch(/maxHeight: '95dvh'/);
    expect(src).toMatch(/maxHeight: '95vh'/); // fallback retained
  });

  it('keeps the existing safe-area padding on the sheet', () => {
    // Regression guard: the sheet already handled insets correctly and the
    // keyboard fix must not disturb it.
    const src = read(COMPOSER);

    expect(src).toMatch(/pt="calc\(env\(safe-area-inset-top\) \+ 0\.5rem\)"/);
    expect(src).toMatch(/pb="env\(safe-area-inset-bottom\)"/);
    expect(src).toMatch(/top="calc\(env\(safe-area-inset-top\) \+ 0\.75rem\)"/);
  });
});

describe('highlighted metadata inherits the insight tone', () => {
  it('does not hardcode the accent token', () => {
    // A clay "unusual expense" badge above evergreen numbers reads as "good" on
    // a card whose whole point is "this looks wrong". insightGroups.ts already
    // says its tokens exist so every insight surface colours identically.
    const src = read('src/components/insights/InsightMetadata.tsx');

    expect(src).not.toMatch(/color=\{highlight \? 'accent' : 'fg'\}/);
    expect(src).toMatch(/color=\{highlight \? highlightColor : 'fg'\}/);
    expect(src).toMatch(/getInsightToneTokens\(insight\.type\)/);
  });
});
