/**
 * Parse a user-typed decimal amount.
 *
 * WHY THIS EXISTS, AND WHY IT IS SHARED. On an iPhone with a Bulgarian locale
 * the amount keypad's decimal key is a COMMA. `parseFloat("12,50")` is `12` —
 * JavaScript stops at the first character it cannot read and returns what it
 * has, with no NaN and no throw. `.toFixed(2)` then renders `"12.00"`. A user
 * entered twelve-fifty and the database stored twelve.
 *
 * The fix existed in this repository already, inline, in TWO secondary inputs
 * (`BudgetEditor` and `WishlistSection`) with the reasoning in a comment — and
 * the PRIMARY amount input never got it. A comment in one file is not a
 * mechanism, which is why this is one function, used everywhere, with a lint
 * rule behind it.
 *
 * DECISIONS, each with its reason, because the edge cases are where the silent
 * truncation comes back in a new costume:
 *
 *  - `"12,50"` and `"12.50"` both give `12.5`. Either separator is accepted.
 *
 *  - `"12abc"` gives `null`, NOT `12`. This is the half that raw `parseFloat`
 *    gets wrong even when the separator is a dot, and the half a bare
 *    `.replace(',', '.')` does not fix.
 *
 *  - TWO separators: the LAST is the decimal, earlier ones are grouping.
 *    `"1.234,56"` and `"1,234.56"` both give `1234.56`. A bare
 *    `.replace(',', '.')` turns the first into `"1.234.56"` and `parseFloat`
 *    returns `1.234` — the same silent truncation the comma fix was for. An iOS
 *    keypad cannot type this; a paste can.
 *
 *  - With two or more separators the grouping must be well formed: every group
 *    after the first exactly three digits. `"12.5.6"` is not a number anyone
 *    meant, so it is `null` rather than a guess.
 *
 *  - A SINGLE separator is always the decimal, even with three digits after it:
 *    `"12.500"` is twelve and a half, not twelve thousand five hundred. This is
 *    genuinely ambiguous against grouped thousands (`"1.234"` meaning 1234), and
 *    the decimal reading is chosen because it is what both `parseFloat` and the
 *    previous inline fixes already did, and because `"12.500"` is a far likelier
 *    keystroke in an amount field than grouped thousands typed with no decimals.
 *    The cost is stated rather than hidden: someone typing `"1.234"` meaning one
 *    thousand two hundred thirty-four gets `1.234`.
 *
 *  - A trailing separator keeps the integer part: `"12,"` gives `12`. No
 *    information is lost, and a user mid-typing should not have their entry
 *    rejected.
 *
 *  - A lone separator, empty, or whitespace gives `null`.
 *
 *  - Exponent notation gives `null`. `parseFloat("1e3")` is `1000`, which nobody
 *    types into an amount field on purpose.
 *
 *  - The SIGN is parsed, not validated. `"-5,5"` gives `-5.5`; whether a
 *    negative amount is allowed belongs to the caller, which knows what the
 *    field means.
 */

/** Digits, separators, ASCII and non-breaking spaces, and an optional sign. */
const SHAPE = /^[+-]?[\d.,\s ]+$/;
const DIGITS = /^\d+$/;

export function parseDecimalInput(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;

  const s = String(raw).trim();
  if (!s) return null;

  // Anything outside digits/separators/space/sign is rejected outright rather
  // than truncated — this is the "12abc" case.
  if (!SHAPE.test(s)) return null;

  const negative = s.startsWith('-');
  const unsigned = s.replace(/^[+-]/, '');

  const lastDot = unsigned.lastIndexOf('.');
  const lastComma = unsigned.lastIndexOf(',');
  const decimalAt = Math.max(lastDot, lastComma);

  const intRaw = decimalAt === -1 ? unsigned : unsigned.slice(0, decimalAt);
  const fracRaw = decimalAt === -1 ? '' : unsigned.slice(decimalAt + 1);

  // Separators remaining in the integer part are grouping, and if there are any
  // the grouping has to be well formed.
  const groups = intRaw.split(/[.,]/).map((g) => g.replace(/[\s ]/g, ''));
  if (groups.length > 1) {
    const [first, ...rest] = groups;
    if (first === undefined || !DIGITS.test(first)) return null;
    if (rest.some((g) => g.length !== 3 || !DIGITS.test(g))) return null;
  }

  const intDigits = groups.join('');
  const fracDigits = fracRaw.replace(/[\s ]/g, '');

  if (intDigits && !DIGITS.test(intDigits)) return null;
  if (fracDigits && !DIGITS.test(fracDigits)) return null;
  // "." or "," alone, or a sign with nothing after it.
  if (!intDigits && !fracDigits) return null;

  const value = Number(`${intDigits || '0'}.${fracDigits || '0'}`);
  if (!Number.isFinite(value)) return null;

  return negative ? -value : value;
}
