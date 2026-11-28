/**
 * Names in any script (spec-cyrillic-names). THE ONE DEFINITION of what a
 * name a person chooses may contain - categories, goals, shared goals, the
 * household, wishlist items, values and the display name - used by every form
 * and every API route that writes one. A static test pins those files to this
 * module; no other copy of the rule may exist (two copies drift).
 *
 * Allowed: letters of ANY script (\p{L}), combining marks (\p{M}), digits
 * (\p{N}), the space, and & - ' . , ( ) /. The `u` flag is what makes the
 * classes Unicode-aware: without it, \w and [a-z] are ASCII-only, which is how
 * "Храна" came to be refused.
 *
 * Before validating and storing, a name is normalised: NFC (so "й" typed as
 * и + breve is the same name as the composed "й"); every kind of space (a
 * pasted no-break space) becomes a plain space; the typographic apostrophe and
 * dashes a phone or Mac keyboard types become ' and -; then it is trimmed and
 * runs of spaces collapsed to one. Control characters, zero-width/format and
 * other invisible (default-ignorable) characters, and line breaks are never
 * allowed; the database enforces that half too (public.is_clean_name), and an
 * RLS test checks the two agree code point by code point. A name also needs a
 * letter or digit, and combining marks must sit on something, never in a pile.
 *
 * Case is NOT folded: "Храна" and "храна" are two names, as "Food" and "food".
 * Emoji are not allowed (a later product choice).
 */

import { z } from 'zod';

/** Letters of any script, combining marks, digits, the space, and & - ' . , ( ) / */
export const NAME_PATTERN = /^[\p{L}\p{M}\p{N} &\-'.,()/]+$/u;

/** Each field keeps the limit it had; the display name, unlimited before, gets 100. */
export const NAME_LIMITS = {
  category: 100,
  goal: 200,
  sharedGoal: 100,
  household: 100,
  wishlistItem: 100,
  value: 50,
  displayName: 100,
} as const;

export type NameField = keyof typeof NAME_LIMITS;

/** Also the message key in the `names` namespace of messages/{en,bg}.json. */
export type NameProblem = 'empty' | 'tooLong' | 'invalidCharacters' | 'needsLetter';

/**
 * Invisible characters: zero-width and other format characters, variation
 * selectors, Hangul fillers, the combining grapheme joiner. A name holding one
 * LOOKS like another (or like nothing) while being different data.
 */
const INVISIBLE = /\p{Default_Ignorable_Code_Point}/u;
/** A combining mark with nothing under it, or more than three piled up (drawn over the text around it). */
const BAD_MARKS = /^\p{M}|\p{M}{4,}/u;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export type NameCheck =
  | { ok: true; name: string }
  | { ok: false; name: string; problem: NameProblem; max: number };

/**
 * The form a name is stored in: NFC; every space separator (no-break, thin,
 * ideographic...) as a plain space; the typographic apostrophe ’ ‘ ʼ as ' and the
 * dashes ‐ ‑ ‒ – — ― − as - (what autocorrect types for the signs the rule
 * allows); trimmed; runs of spaces collapsed.
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\p{Zs}/gu, ' ')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .trim()
    .replace(/ {2,}/g, ' ');
}

/**
 * Normalises, then validates. Length is counted in code points, as Postgres
 * counts characters, so a limit means the same on both sides.
 */
export function checkName(raw: unknown, field: NameField): NameCheck {
  const max = NAME_LIMITS[field];
  const name = typeof raw === 'string' ? normalizeName(raw) : '';
  if (name === '') return { ok: false, name, problem: 'empty', max };
  if ([...name].length > max) return { ok: false, name, problem: 'tooLong', max };
  if (!NAME_PATTERN.test(name) || INVISIBLE.test(name) || BAD_MARKS.test(name)) {
    return { ok: false, name, problem: 'invalidCharacters', max };
  }
  if (!HAS_LETTER_OR_DIGIT.test(name)) return { ok: false, name, problem: 'needsLetter', max };
  return { ok: true, name };
}

/**
 * The English message an API returns with a refused name ("Goal name is
 * required"). Forms show their own, translated, from the problem code; this is
 * for API callers and logs.
 */
export function nameApiMessage(label: string, problem: NameProblem, max: number): string {
  if (problem === 'empty') return `${label} name is required`;
  if (problem === 'tooLong') return `${label} name must be ${max} characters or fewer`;
  if (problem === 'needsLetter') return `${label} name needs at least one letter or digit`;
  return `${label} name contains characters that are not allowed`;
}

/**
 * The zod form of the same rule: parses to the NORMALISED name. On failure the
 * issue's message is the problem code, which a form translates with
 * t(`names.${message}`, { max: NAME_LIMITS[field] }).
 */
export function nameSchema(field: NameField) {
  return z.string().transform((raw, ctx) => {
    const result = checkName(raw, field);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: result.problem });
      return z.NEVER;
    }
    return result.name;
  });
}

/**
 * The same rule for a name that may be left EMPTY (the display name at
 * onboarding): empty after normalising parses to '', anything else must pass.
 */
export function optionalNameSchema(field: NameField) {
  return z.string().transform((raw, ctx) => {
    const name = normalizeName(raw);
    if (name === '') return '';
    const result = checkName(name, field);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: result.problem });
      return z.NEVER;
    }
    return result.name;
  });
}

/** True if `value` is one of the problem codes (a form's error message may be anything else). */
export function isNameProblem(value: unknown): value is NameProblem {
  return (
    value === 'empty' ||
    value === 'tooLong' ||
    value === 'invalidCharacters' ||
    value === 'needsLetter'
  );
}

/**
 * The name problem in a failed zod parse, for an API's 400 response, or
 * undefined when the name was not what failed.
 */
export function nameProblemOf(error: z.ZodError, field = 'name'): NameProblem | undefined {
  const issue = error.issues.find((i) => i.path[0] === field && isNameProblem(i.message));
  return issue?.message as NameProblem | undefined;
}
