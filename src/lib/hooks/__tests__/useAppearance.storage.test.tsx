/**
 * useAppearance — storage-unavailable path.
 *
 * Lives in its OWN FILE deliberately: the session-override is module-global, so
 * running this alongside the other cases let a previously-set value satisfy the
 * assertion and the test passed without exercising the click at all. Jest gives
 * each test file a fresh module registry, which makes the assertion honest.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { useAppearance } from '@/lib/hooks/useAppearance';

const mockSetColorMode = jest.fn();
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useColorMode: () => ({ colorMode: 'light', setColorMode: mockSetColorMode }),
}));

function Probe() {
  const { preference, setPreference } = useAppearance();
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <button onClick={() => setPreference('dark')}>go-dark</button>
    </div>
  );
}

it('applies the chosen mode for the session even when storage is unavailable', () => {
  // Fully unavailable storage: both read and write throw (private mode /
  // blocked site data). Without the session override the snapshot would re-read
  // empty storage and the click would appear to do nothing at all.
  const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('SecurityError');
  });
  const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError');
  });

  render(
    <ChakraProvider>
      <Probe />
    </ChakraProvider>
  );

  // Fresh module registry → no leaked session value.
  expect(screen.getByTestId('pref')).toHaveTextContent('system');
  mockSetColorMode.mockClear();

  expect(() =>
    act(() => {
      screen.getByText('go-dark').click();
    })
  ).not.toThrow();

  // The click alone drives it, despite the write throwing.
  expect(screen.getByTestId('pref')).toHaveTextContent('dark');
  expect(mockSetColorMode).toHaveBeenCalledWith('dark');

  getItem.mockRestore();
  setItem.mockRestore();
});
