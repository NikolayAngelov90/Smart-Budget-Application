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
  'HouseholdSection.tsx',
  'HouseholdInvites.tsx',
  'AllowanceCard.tsx',
  'ContributionSplitCard.tsx',
  'SharedGoalsCard.tsx',
];

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
  let i = src.indexOf(needle);
  while (i !== -1) {
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

/** `<HStack …>` blocks, with enough following text to see what they wrap. */
function hstackBlocks(src: string): string[] {
  return [...src.matchAll(/<HStack[^>]*>/g)].map((m) =>
    src.slice(m.index!, m.index! + 400)
  );
}

describe('household forms stack on a phone', () => {
  it.each(FORM_COMPONENTS)('%s puts no form control directly in an HStack', (file) => {
    const src = read(file);

    // An HStack is fine around badges, headings or icon buttons — it is only a
    // problem when it holds a control that has to stay readable.
    const offenders = hstackBlocks(src).filter((block) => {
      const untilClose = block.split('</HStack>')[0]!;
      const firstChild = untilClose.replace(/<HStack[^>]*>/, '');
      return /<(Input|Select|Textarea)\b/.test(firstChild.split('<HStack')[0]!);
    });

    expect(offenders).toEqual([]);
  });

  it.each(FORM_COMPONENTS)('%s uses a responsive direction where it stacks', (file) => {
    const src = read(file);
    if (!src.includes('<Stack')) return; // not every file needed one

    const stacks = [...src.matchAll(/<Stack\b[^>]*>/gs)].map((m) => m[0]);
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
    if (controls.length === 0) return;

    const missing = controls.filter((c) => !/minH=\{\{\s*base:\s*'44px'/.test(c));

    expect(missing.map((c) => c.replace(/\s+/g, ' ').slice(0, 70))).toEqual([]);
  });

  it('is not a vacuous check — the pattern it looks for is real', () => {
    // Guards the guard: if the extractor found nothing, every assertion above
    // would pass on an empty list.
    const src = read('HouseholdInvites.tsx');
    expect(openingTags(src, 'Input').length).toBeGreaterThan(0);
    expect(src).toContain("minH={{ base: '44px'");
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
