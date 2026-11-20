/**
 * spec-account-deletion-refused-message: what the deletion dialog SHOWS when the
 * delete request fails. A 5xx shows a translated message chosen from the
 * response code - never the server's English `message`/`details`. A 4xx (wrong
 * or missing password) keeps its `details`, as before.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { DangerZoneSection } from '@/components/settings/sections/DangerZoneSection';
import enMessages from '../../../../../messages/en.json';

// The provider-bound mutate the component uses to revalidate after a refusal.
const mockMutate = jest.fn();
jest.mock('swr', () => ({
  __esModule: true,
  ...jest.requireActual('swr'),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

const settings = enMessages.settings;
const RAW = 'Failed to delete user account: Database error deleting user';

function failNetwork() {
  global.fetch = jest
    .fn()
    .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
}

function respond(status: number, body: unknown, { json = true } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: json
      ? jest.fn().mockResolvedValue(body)
      : jest.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON')),
  }) as unknown as typeof fetch;
}

async function attemptDeletion(): Promise<HTMLElement> {
  render(
    <ChakraProvider>
      <DangerZoneSection />
    </ChakraProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: settings.deleteAccount }));
  fireEvent.change(await screen.findByPlaceholderText(settings.yourPassword), {
    target: { value: 'secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: settings.confirmDeletion }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  // The dialog already holds a static warning Alert ("cannot be undone"); the
  // error is the alert that appears once the request has failed.
  const errorAlert = () =>
    screen.getAllByRole('alert').filter((a) => !a.textContent?.includes(settings.cannotBeUndone));
  await waitFor(() => expect(errorAlert()).toHaveLength(1));
  return errorAlert()[0]!;
}

describe('DangerZoneSection: a failed deletion', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    mockMutate.mockClear();
  });

  test('a confirmed refusal shows the translated text for its outcome, names filled in', async () => {
    respond(500, {
      error: {
        message: 'Account not deleted',
        code: 'ACCOUNT_NOT_DELETED',
        outcome: 'transferred',
        household: 'Home',
        owner: 'owner@example.test',
      },
    });

    const alert = await attemptDeletion();

    expect(alert).toHaveTextContent('Your account was not deleted.');
    expect(alert).toHaveTextContent('Home passed to owner@example.test');
    expect(alert).not.toHaveTextContent('Account not deleted');
    // The preparation moved the household: every cached key is revalidated, so
    // the app stops showing the old owner and admin controls.
    expect(mockMutate).toHaveBeenCalledTimes(1);
    const matcher = mockMutate.mock.calls[0]![0] as (key: unknown) => boolean;
    expect(matcher('/api/household')).toBe(true);
    expect(mockMutate.mock.calls[0]).toHaveLength(1); // revalidate only: no data argument
  });

  test('an unchanged refusal shows its text and revalidates nothing', async () => {
    respond(500, {
      error: { message: 'Account not deleted', code: 'ACCOUNT_NOT_DELETED', outcome: 'unchanged' },
    });

    const alert = await attemptDeletion();

    expect(alert).toHaveTextContent(settings.deletionRefusedUnchanged);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test('no response at all (offline) shows the generic failure, not the browser text', async () => {
    failNetwork();

    const alert = await attemptDeletion();

    expect(alert).toHaveTextContent(settings.accountDeleteFailed);
    expect(alert).not.toHaveTextContent('Failed to fetch');
  });

  test('a 2xx whose body cannot be read is not a success: no toast, no redirect', async () => {
    respond(200, null, { json: false });

    const alert = await attemptDeletion();

    expect(alert).toHaveTextContent(settings.accountDeleteFailed);
    expect(screen.queryByText(settings.accountDeleted)).not.toBeInTheDocument();
  });

  test('any other 500 shows the translated generic failure, never the server text', async () => {
    respond(500, { error: { message: 'Failed to delete account', details: RAW } });

    const alert = await attemptDeletion();

    expect(alert).toHaveTextContent(settings.accountDeleteFailed);
    expect(alert).not.toHaveTextContent('Database error');
  });

  test('a 500 whose body is not JSON shows the generic failure, not a SyntaxError', async () => {
    respond(502, null, { json: false });

    const alert = await attemptDeletion();

    expect(alert).toHaveTextContent(settings.accountDeleteFailed);
    expect(alert).not.toHaveTextContent('Unexpected token');
  });

  test('a 401 (wrong password) still shows its details, as before', async () => {
    respond(401, {
      error: { message: 'Invalid password', details: 'The password you entered is incorrect' },
    });

    const alert = await attemptDeletion();

    expect(alert).toHaveTextContent('The password you entered is incorrect');
  });
});
