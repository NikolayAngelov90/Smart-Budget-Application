/**
 * THE DEFECT, AT THE LAYER WHERE A USER MEETS IT.
 *
 * On an iPhone with a Bulgarian locale the amount keypad's decimal key is a
 * COMMA. `parseFloat("12,50")` is `12` — JavaScript stops at the first character
 * it cannot read and returns what it has, with no NaN and no throw — and
 * `.toFixed(2)` then renders `"12.00"`. A user entered twelve-fifty and the
 * database stored twelve.
 *
 * WHY THIS EXISTS AND NOT ONLY A HELPER TEST. A test of `parseDecimalInput` alone
 * passes while this modal still calls raw `parseFloat`, which is precisely the
 * shape that let the defect ship: the fix existed inline in `BudgetEditor` and
 * `WishlistSection`, with its reasoning written in a comment, and the primary
 * amount input never received it. So the assertion is on the SUBMITTED PAYLOAD,
 * reached by typing into the field.
 *
 * WHY EDIT MODE. Create mode requires choosing a category, and the quick-pick
 * chips are driven by a categories fetch that remounts them; a first version of
 * this suite clicked a chip and failed about one run in three on that race. Edit
 * mode pre-fills `category_id` from the transaction, so the only thing this suite
 * touches is the amount — the thing under test. Both payload sites (the PUT and
 * the POST) are the identical expression, so a mutation of one is a mutation of
 * both.
 *
 * MUTATION RECORD — applied, run, observed, reverted:
 *   1. payload `parseDecimalInput(data.amount)` -> `parseFloat(data.amount)`.
 *      Against the BLURRED path this came back GREEN: the blur handler rewrites
 *      the field to "12.50" first, so by submit time the value already has a dot
 *      and parseFloat gets it right — the blur was MASKING the payload defect.
 *      "submits 12.5 when the amount is NEVER BLURRED" is the test that covers
 *      it, and with that test present the mutation goes RED with `amount: 12`.
 *   2. blur handler -> raw `parseFloat` -> "does not rewrite a comma amount to a
 *      truncated value on blur" FAILS: the field becomes "12.00".
 *   3. zod positivity refine -> raw `parseFloat` -> NOTHING FAILS, and that is
 *      correct and worth recording: that refine never SAW the defect. It asked
 *      "is it > 0" and 12 is, so it passed while the value was already wrong.
 *      Fixing it removes a latent trap rather than a live symptom.
 *   4. `pattern` back to `^\d+(\.\d{1,2})?$` -> "accepts a comma amount as valid"
 *      FAILS.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import TransactionEntryModal from '../TransactionEntryModal';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'bg',
}));

jest.mock('@/lib/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
jest.mock('@/lib/config/currencies', () => ({
  getEnabledCurrencies: () => [{ code: 'EUR', symbol: '€' }],
}));
jest.mock('@/lib/utils/haptic', () => ({ triggerHaptic: jest.fn() }));
jest.mock('@/components/categories/CategoryMenu', () => ({
  CategoryMenu: () => <div data-testid="category-menu" />,
}));
// Desktop Modal path, so the fields render without the bottom-sheet Drawer.
jest.mock('@chakra-ui/react', () => {
  const actual = jest.requireActual('@chakra-ui/react');
  return { ...actual, useBreakpointValue: () => false };
});

const CATEGORIES = [
  { id: 'c1', name: 'Groceries', color: '#C4593A', type: 'expense', usage_count: 9 },
];

/**
 * ONE STABLE response object, reused for every categories fetch. Returning a
 * fresh `{ data, recent }` per call re-triggers the modal's categories effect on
 * each render, which produces a continuous re-fetch loop.
 */
const CATEGORIES_RESPONSE = { data: CATEGORIES, recent: [CATEGORIES[0]] };

const EXISTING = {
  id: 't1',
  user_id: 'u1',
  category_id: 'c1',
  amount: 1,
  type: 'expense' as const,
  date: '2026-10-06',
  notes: null,
  currency: 'EUR',
  exchange_rate: null,
};

/** Every fetch call, so the payload can be read back. */
let calls: Array<{ url: string; init?: RequestInit }>;

beforeEach(() => {
  jest.clearAllMocks();
  calls = [];
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const body = String(url).startsWith('/api/categories')
      ? CATEGORIES_RESPONSE
      : { data: { id: 't1' } };
    return Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(body),
    });
  }) as unknown as typeof fetch;
});

const renderEdit = () =>
  render(
    <ChakraProvider>
      <TransactionEntryModal
        isOpen
        mode="edit"
        transaction={EXISTING as never}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    </ChakraProvider>
  );

/** The write to the transaction, parsed. */
const submittedBody = () => {
  const put = calls.find((c) => c.init?.method === 'PUT');
  return put ? JSON.parse(String(put.init?.body)) : null;
};

async function editAmountAndSubmit(amount: string, { blur = true } = {}) {
  renderEdit();

  // Edit mode pre-fills from `transaction`, so wait for the prefilled value to
  // arrive rather than for a chip — there is no category to choose.
  const field = await waitFor(() => {
    const el = screen.getByLabelText('amount') as HTMLInputElement;
    expect(el.value).toBe('1.00');
    return el;
  });

  fireEvent.change(field, { target: { value: amount } });
  if (blur) fireEvent.blur(field);

  // The form is SUBMITTED directly rather than by clicking "add". That button is
  // `isDisabled={!isValid || ...}` and react-hook-form's `isValid` does not
  // settle inside this harness, so clicking it would assert nothing — a disabled
  // button swallows the click and the test would pass with no write at all.
  // Submitting runs the same handleSubmit path, including the full zod resolver,
  // so an invalid amount still cannot get through.
  //
  // `document`, not the render container: Chakra's Modal renders through a
  // portal, so a container-scoped query finds nothing.
  const form = document.querySelector('form');
  if (!form) throw new Error('no form element: the modal did not render its form');
  fireEvent.submit(form);

  await waitFor(() => expect(submittedBody()).not.toBeNull(), { timeout: 4000 });
  return submittedBody();
}

describe('TransactionEntryModal — a comma decimal must not be truncated', () => {
  it('submits 12.5 when the keypad gave a comma', async () => {
    // THE DEFECT. Before the fix this wrote `amount: 12` — the user's 50 cents
    // silently gone, in a budgeting app, with no error shown.
    const body = await editAmountAndSubmit('12,50');
    expect(body.amount).toBe(12.5);
  });

  it('submits 12.5 when the amount is NEVER BLURRED', async () => {
    // THE TEST THAT COVERS THE PAYLOAD. With only the blurred case above,
    // reverting the payload to raw `parseFloat` stayed GREEN: the blur handler
    // had already rewritten the field to "12.50", so parseFloat saw a dot. A
    // user who taps Add without the field losing focus never triggers that blur,
    // and on that path raw `parseFloat` truncates identically.
    const body = await editAmountAndSubmit('12,50', { blur: false });
    expect(body.amount).toBe(12.5);
  });

  it('still submits 12.5 for a dot, so the fix did not trade one locale for the other', async () => {
    const body = await editAmountAndSubmit('12.50');
    expect(body.amount).toBe(12.5);
  });
});

describe('TransactionEntryModal — the field itself', () => {
  it('does not rewrite a comma amount to a truncated value on blur', async () => {
    // The blur handler formats to 2 decimal places. With raw parseFloat it
    // rewrote the field itself to "12.00", so the user could SEE the truncation
    // happen and still had no error to act on.
    renderEdit();
    const field = (await waitFor(() => screen.getByLabelText('amount'))) as HTMLInputElement;
    fireEvent.change(field, { target: { value: '12,50' } });
    fireEvent.blur(field);
    await waitFor(() => expect(field.value).toBe('12.50'));
  });

  it('accepts a comma amount as valid rather than marking the field in error', async () => {
    // The `pattern` attribute was `^\d+(\.\d{1,2})?$`, which marks the input
    // invalid the instant a comma is typed — the one decimal key a bg-locale
    // keypad offers.
    renderEdit();
    const field = (await waitFor(() => screen.getByLabelText('amount'))) as HTMLInputElement;
    fireEvent.change(field, { target: { value: '12,50' } });
    expect(field.checkValidity()).toBe(true);
  });
});
