/**
 * @jest-environment node
 */

/**
 * Household forms must not squeeze their inputs on a phone — HP-4.
 *
 * Every household form put its input and its submit button in a fixed
 * `<HStack>`. The button keeps its natural width, so the input absorbs all the
 * squeeze. Measured in a real browser at 320px before the fix, **7 of 8 controls
 * were narrower than their own placeholder**, and all 8 were below the project's
 * 44px mobile tap-target size:
 *
 *   Задайте вашия процент   58px available, 172px needed
 *   Краен срок (date)       62px available, 139px needed
 *   name@email.com          71px available, 122px needed
 *   Име на домакинството    52px available, 165px needed  (at 390px!)
 *
 * The create-household field was the worst and it fails at 390px, not just 320 —
 * the Bulgarian button label ("Създай домакинство") is long, so this was
 * invisible to anyone testing in English.
 *
 * These are SOURCE assertions on purpose. jsdom has no layout engine: every
 * width it reports is 0, so a render test cannot see this class of bug at all.
 * What it can do is pin the two decisions that fixed it — stack on base, and
 * declare a 44px mobile height — so the pattern cannot quietly return.
 */

import fs from 'fs';
import path from 'path';

const DIR = path.resolve(__dirname, '..');

const FORM_COMPONENTS = [
  // Story 17.1 split HouseholdSection: its create <Input> is now in
  // HouseholdCreateCard and its preset <Select> in TransparencyPresetCard, so
  // the guard follows both rather than losing them with the file.
  'HouseholdCreateCard.tsx',
  'TransparencyPresetCard.tsx',
  'HouseholdInvites.tsx',
  'AllowanceCard.tsx',
  'ContributionSplitCard.tsx',
  'SharedGoalsCard.tsx',
];

/**
 * Components from the list above that actually contain a `<Button>`.
 *
 * The button check asserts `buttons.length > 0` so it can never pass on an
 * empty extraction — which means a component with no buttons cannot be in it.
 * `TransparencyPresetCard` is a `<Select>` and a hint, nothing more.
 *
 * The exclusion is verified below rather than trusted: an excluded file that
 * grew a `<Button>` would silently escape the 44px rule, so a test asserts the
 * excluded ones genuinely have none.
 */
const BUTTON_COMPONENTS = FORM_COMPONENTS.filter((f) => f !== 'TransparencyPresetCard.tsx');
const NO_BUTTON_COMPONENTS = FORM_COMPONENTS.filter((f) => !BUTTON_COMPONENTS.includes(f));

const read = (file: string) => fs.readFileSync(path.join(DIR, file), 'utf8');

/**
 * Extract whole `<Input …>` / `<Select …>` opening tags.
 *
 * Deliberately not a regex. `<Input[^>]*>` looks right and is wrong: it stops at
 * the first `>`, which in this codebase is the arrow of
 * `onChange={(e) => setX(...)}`. That truncates the tag before its later props
 * and reports attributes as missing when they are present — it produced four
 * false failures on the first run of this suite.
 */
function openingTags(src: string, name: string): string[] {
  const tags: string[] = [];
  const needle = `<${name}`;
  /**
   * The character after the name must not continue an identifier, or
   * `<Input` also matches `<InputGroup` / `<InputLeftElement` and `<Stack`
   * matches nothing sensible inside `<HStack`. Without this the 44px rule
   * would be demanded of Chakra input WRAPPERS the moment anyone used one.
   */
  const isWholeTag = (at: number) => !/[A-Za-z0-9_]/.test(src[at + needle.length] ?? '');
  let i = src.indexOf(needle);
  while (i !== -1) {
    if (!isWholeTag(i)) {
      i = src.indexOf(needle, i + needle.length);
      continue;
    }
    let depth = 0;
    let quote: string | null = null;
    for (let j = i + needle.length; j < src.length; j++) {
      const c = src[j]!;
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) {
        tags.push(src.slice(i, j + 1));
        break;
      }
    }
    i = src.indexOf(needle, i + needle.length);
  }
  return tags;
}

/**
 * `<HStack …>` blocks, each running to its matching `</HStack>`.
 *
 * The first version of this used `/<HStack[^>]*>/` and a fixed 400-character
 * slice — the exact `[^>]*` mistake the docblock above spends a paragraph
 * explaining, left in place two functions below the explanation.
 * `HouseholdInvites.tsx` already carries `mb={pending.length > 0 ? 4 : 0}` on a
 * stack, so the tag truncated in this very repo; it only passed because
 * `direction` happened to precede `mb`. The 400-char window was the second
 * half of the bug: a control further down was invisible, and a sibling past the
 * closing tag counted as inside.
 */
function hstackBlocks(src: string): string[] {
  const blocks: string[] = [];
  for (const tag of openingTags(src, 'HStack')) {
    const start = src.indexOf(tag);
    // Balance nested HStacks so an inner one cannot end the outer block early.
    let depth = 0;
    let cursor = start;
    while (cursor < src.length) {
      const open = src.indexOf('<HStack', cursor + 1);
      const close = src.indexOf('</HStack>', cursor + 1);
      if (close === -1) break;
      if (open !== -1 && open < close) {
        depth++;
        cursor = open;
      } else if (depth > 0) {
        depth--;
        cursor = close;
      } else {
        blocks.push(src.slice(start, close));
        break;
      }
    }
  }
  return blocks;
}

describe('household forms stack on a phone', () => {
  it.each(FORM_COMPONENTS)('%s puts no form control directly in an HStack', (file) => {
    const src = read(file);

    // An HStack is fine around badges, headings or icon buttons — it is only a
    // problem when it holds a control that has to stay readable.
    const offenders = hstackBlocks(src).filter(
      (block) => openingTags(block, 'Input').length > 0 || openingTags(block, 'Select').length > 0
    );

    expect(offenders.map((b) => b.replace(/\s+/g, ' ').slice(0, 80))).toEqual([]);
  });

  it.each(FORM_COMPONENTS)('%s uses a responsive direction where it stacks', (file) => {
    const src = read(file);
    if (!src.includes('<Stack')) return; // not every file needed one

    // Same brace-aware extractor, not `/<Stack\b[^>]*>/` — see hstackBlocks.
    const stacks = openingTags(src, 'Stack');
    expect(stacks.length).toBeGreaterThan(0);
    for (const s of stacks) {
      // A bare <Stack> is column at EVERY width — that would fix the phone and
      // break the desktop row.
      expect(s).toMatch(/direction=\{\{\s*base:\s*'column'/);
      expect(s).toMatch(/sm:\s*'row'/);
    }
  });
});

describe('mobile tap targets', () => {
  /**
   * The project's stated convention, set in PeriodSelector: "44px minimum: this
   * is a primary mobile control." These controls were 32-40px.
   */
  it.each(FORM_COMPONENTS)('%s gives every control a 44px mobile height', (file) => {
    const src = read(file);

    const controls = [...openingTags(src, 'Input'), ...openingTags(src, 'Select')];
    expect(controls.length).toBeGreaterThan(0);

    const missing = controls.filter((c) => !/minH=\{\{\s*base:\s*'44px'/.test(c));

    expect(missing.map((c) => c.replace(/\s+/g, ' ').slice(0, 70))).toEqual([]);
  });

  it.each(BUTTON_COMPONENTS)('%s sizes its buttons too', (file) => {
    // HP-4's docblock claimed "all 8 controls were below 44px", then checked
    // Input/Select only — so `<Button size="sm">` (Chakra sm = 32px) survived on
    // Save / Cancel / Contribute / Send in every form it touched. On mobile
    // those rows are stacked full-width, which makes them the largest-LOOKING
    // and still-shortest targets on the screen.
    //
    // EVERY Button, not just those inside a responsive Stack. The first version
    // of this check scoped itself to Stack blocks and was therefore VACUOUS for
    // SharedGoalsCard, whose form buttons sit in an `<HStack justify="flex-end">`
    // — stripping a minH there did not fail the suite. The buttons that OPEN
    // each form ("Настройване", "Нова цел") are tap targets too; the browser
    // audit measured them at 38px.
    const src = read(file);
    const buttons = openingTags(src, 'Button');
    expect(buttons.length).toBeGreaterThan(0);

    const missing = buttons.filter((b) => !/minH=\{\{\s*base:\s*'44px'/.test(b));

    expect(missing.map((b) => b.replace(/\s+/g, ' ').slice(0, 70))).toEqual([]);
  });

  it.each(NO_BUTTON_COMPONENTS)('%s is excluded from the button check for a real reason', (file) => {
    // If this file grows a <Button>, it must join BUTTON_COMPONENTS — otherwise
    // the exclusion becomes a hole the 44px rule quietly falls through.
    expect(openingTags(read(file), 'Button')).toEqual([]);
  });

  it('is not a vacuous check — the pattern it looks for is real', () => {
    // Guards the guard: if the extractor found nothing, every assertion above
    // would pass on an empty list.
    const src = read('HouseholdInvites.tsx');
    expect(openingTags(src, 'Input').length).toBeGreaterThan(0);
    expect(src).toContain("minH={{ base: '44px'");
  });

  it('extracts whole tags past a `>` inside a prop expression', () => {
    // The real case this repo already contains: HouseholdInvites' Stack carries
    // `mb={pending.length > 0 ? 4 : 0}`. A `[^>]*` extractor truncates there,
    // and the suite passed only because `direction` happened to come first.
    const tag = openingTags(
      `<Stack direction={{ base: 'column' }} mb={pending.length > 0 ? 4 : 0} spacing={2}>`,
      'Stack'
    )[0]!;

    expect(tag).toContain('spacing={2}');
  });

  it('does not treat <InputGroup as an <Input', () => {
    // Otherwise the 44px rule gets demanded of Chakra input WRAPPERS.
    const src = `<InputGroup><InputLeftElement /><Input value={x} /></InputGroup>`;

    expect(openingTags(src, 'Input')).toHaveLength(1);
    expect(openingTags(src, 'Input')[0]).toContain('value={x}');
  });

  it('extracts whole tags, past an arrow function', () => {
    // Pins the bug in the FIRST version of this suite: `<Input[^>]*>` stopped at
    // the `>` of `(e) =>`, so props after onChange looked absent.
    const tag = openingTags(
      `<Input value={x} onChange={(e) => setX(e.target.value)} minH={{ base: '44px' }} />`,
      'Input'
    )[0]!;
    expect(tag).toContain("minH={{ base: '44px' }}");
  });
});
