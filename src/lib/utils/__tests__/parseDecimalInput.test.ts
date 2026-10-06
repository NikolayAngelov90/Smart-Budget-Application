/**
 * @jest-environment node
 */

/**
 * The decisions, asserted. Each case below is a judgement call recorded in
 * parseDecimalInput's header, and the reason it is a test rather than a comment
 * is that a comment is exactly what failed: the comma fix existed inline in
 * BudgetEditor and WishlistSection, with its reasoning written down, and the
 * primary amount input never received it.
 *
 * The acceptance test for the DEFECT is not here — it is in
 * TransactionEntryModal.amount.test.tsx, which types into the field and asserts
 * the submitted payload. A helper test alone would pass while the modal still
 * called raw `parseFloat`, which is precisely the shape that let this ship.
 */

import { parseDecimalInput } from '../parseDecimalInput';

describe('parseDecimalInput — the defect itself', () => {
  it('reads a COMMA as the decimal separator', () => {
    // THE BUG. parseFloat("12,50") is 12, silently, and .toFixed(2) renders
    // "12.00". A bg-locale iPhone keypad emits ',' for the decimal key.
    expect(parseDecimalInput('12,50')).toBe(12.5);
  });

  it('still reads a DOT as the decimal separator', () => {
    expect(parseDecimalInput('12.50')).toBe(12.5);
  });

  it.each([
    ['0,01', 0.01],
    ['1234,56', 1234.56],
    ['12,', 12],
    ['0,5', 0.5],
    [',5', 0.5],
  ])('%s -> %s', (input, expected) => {
    expect(parseDecimalInput(input as string)).toBe(expected);
  });
});

describe('parseDecimalInput — rejects rather than truncates', () => {
  it('returns null for trailing junk instead of the prefix', () => {
    // The half raw parseFloat gets wrong EVEN WITH DOTS, and the half a bare
    // .replace(',', '.') does not fix. parseFloat("12abc") === 12.
    expect(parseDecimalInput('12abc')).toBeNull();
    expect(parseDecimalInput('12.5kg')).toBeNull();
    expect(parseDecimalInput('abc')).toBeNull();
  });

  it('returns null for exponent notation', () => {
    // parseFloat("1e3") === 1000. Nobody types that into an amount field on
    // purpose, and accepting it turns a typo into a thousand-fold error.
    expect(parseDecimalInput('1e3')).toBeNull();
    expect(parseDecimalInput('1E3')).toBeNull();
  });

  it.each(['', '   ', ',', '.', '-', '+', '-,'])('returns null for %p', (input) => {
    expect(parseDecimalInput(input)).toBeNull();
  });

  it('returns null for null and undefined', () => {
    expect(parseDecimalInput(null)).toBeNull();
    expect(parseDecimalInput(undefined)).toBeNull();
  });
});

describe('parseDecimalInput — two separators, which is the paste case', () => {
  it('treats the LAST separator as the decimal, either way round', () => {
    // A bare .replace(',', '.') turns "1.234,56" into "1.234.56" and parseFloat
    // returns 1.234 — the same silent truncation in a new costume. An iOS
    // keypad cannot produce two separators; a paste can.
    expect(parseDecimalInput('1.234,56')).toBe(1234.56);
    expect(parseDecimalInput('1,234.56')).toBe(1234.56);
  });

  it('accepts multiple well-formed groups', () => {
    expect(parseDecimalInput('1.234.567,89')).toBe(1234567.89);
    expect(parseDecimalInput('1,234,567.89')).toBe(1234567.89);
  });

  it('returns null when the grouping is NOT well formed', () => {
    // "12.5.6" is not a number anyone meant. Guessing at it is how a silent
    // misread gets reintroduced; null sends it back to the user.
    expect(parseDecimalInput('12.5.6')).toBeNull();
    expect(parseDecimalInput('1.23.456')).toBeNull();
    expect(parseDecimalInput('1,2,3')).toBeNull();
  });
});

describe('parseDecimalInput — the stated ambiguity', () => {
  it('reads a SINGLE separator as the decimal even with three digits after it', () => {
    // "12.500" is twelve and a half. This is the documented cost: a single
    // separator is always decimal, so grouped thousands typed WITHOUT decimals
    // are misread, and that is chosen deliberately because "12.500" is the far
    // likelier keystroke and because it matches what parseFloat and the two
    // previous inline fixes already did.
    expect(parseDecimalInput('12.500')).toBe(12.5);
    expect(parseDecimalInput('12,500')).toBe(12.5);
    expect(parseDecimalInput('1.234')).toBe(1.234);
  });
});

describe('parseDecimalInput — whitespace and sign', () => {
  it('trims, and tolerates spaces used as grouping', () => {
    expect(parseDecimalInput(' 12,50 ')).toBe(12.5);
    expect(parseDecimalInput('1 234,56')).toBe(1234.56);
    // Non-breaking space: what a locale-formatted number often actually carries.
    expect(parseDecimalInput('1 234,56')).toBe(1234.56);
  });

  it('parses the sign and leaves the POLICY to the caller', () => {
    // Whether a negative amount is allowed depends on the field, so this returns
    // the number and does not decide.
    expect(parseDecimalInput('-5,5')).toBe(-5.5);
    expect(parseDecimalInput('+5,5')).toBe(5.5);
  });

  it('passes through a number unchanged, and rejects a non-finite one', () => {
    expect(parseDecimalInput(12.5)).toBe(12.5);
    expect(parseDecimalInput(0)).toBe(0);
    expect(parseDecimalInput(NaN)).toBeNull();
    expect(parseDecimalInput(Infinity)).toBeNull();
  });
});
