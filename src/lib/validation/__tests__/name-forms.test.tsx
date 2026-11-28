/**
 * spec-cyrillic-names: the four name forms that do not use react-hook-form -
 * the household, a shared goal, a value (add and rename) and the display name -
 * follow the shared rule. A refused name is said in words (the real English
 * messages file, through the global next-intl mock, with {max} filled in) and
 * nothing is sent; an accepted name is sent NORMALISED; the fields no longer
 * cut a name at a UTF-16 maxLength.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import en from '../../../../messages/en.json';
import { HouseholdCreateCard } from '@/components/household/HouseholdCreateCard';
import { SharedGoalsCard } from '@/components/household/SharedGoalsCard';
import { ValuesPlanSection } from '@/components/values/ValuesPlanSection';
import { AccountSection } from '@/components/settings/sections/AccountSection';

const mockToast = jest.fn();
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useToast: () => mockToast,
}));
const mockMutate = jest.fn();
jest.mock('@/lib/hooks/useHousehold', () => ({
  useHousehold: () => ({ household: null, isLoading: false, error: undefined, mutate: mockMutate }),
}));
jest.mock('@/components/household/PendingInviteBanner', () => ({
  PendingInviteBanner: () => null,
}));
jest.mock('@/lib/hooks/useHouseholdGoals', () => ({
  useHouseholdGoals: () => ({ goals: [], isLoading: false, mutate: mockMutate }),
}));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
jest.mock('@/lib/hooks/useValues', () => ({
  useValues: () => ({
    values: [{ id: 'v1', name: 'Здраве', priority: 0, category_ids: [] }],
    isLoading: false,
    mutate: mockMutate,
  }),
}));
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: { data: [] } })),
  useSWRConfig: () => ({ mutate: jest.fn(), cache: new Map() }),
}));
jest.mock('@/hooks/useUserProfile', () => ({
  PROFILE_KEY: '/api/user/profile',
  refreshProfile: jest.fn(),
}));
jest.mock('@/components/settings/ProfilePictureUpload', () => ({
  ProfilePictureUpload: () => null,
}));

const fetchMock = jest.fn();
const renderIt = (ui: React.ReactElement) => render(ui, { wrapper: ChakraProvider });
const tooLong = (max: number) => en.names.tooLong.replace('{max}', String(max));
/** The JSON body of the nth fetch call. */
const bodyOf = (n = 0) => JSON.parse(String((fetchMock.mock.calls[n][1] as RequestInit).body));
const ok = (data: unknown = {}) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => data,
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockResolvedValue(ok());
});

describe('HouseholdCreateCard', () => {
  const input = () => screen.getByLabelText(en.household.namePlaceholder);
  const create = () => screen.getByRole('button', { name: en.household.create });

  test('an invisible character is refused in words, and nothing is sent', async () => {
    renderIt(<HouseholdCreateCard />);
    fireEvent.change(input(), { target: { value: 'Вкъ\u200Bщи' } });
    fireEvent.click(create());
    expect(await screen.findByText(en.names.invalidCharacters)).toBeInTheDocument();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a name past 100 characters can be typed (no maxLength cut) and is refused with the limit', async () => {
    renderIt(<HouseholdCreateCard />);
    expect(input()).not.toHaveAttribute('maxLength');
    fireEvent.change(input(), { target: { value: 'ж'.repeat(101) } });
    fireEvent.click(create());
    expect(await screen.findByText(tooLong(100))).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a Bulgarian name is sent normalised; editing clears an earlier error', async () => {
    renderIt(<HouseholdCreateCard />);
    fireEvent.change(input(), { target: { value: '- -' } });
    fireEvent.click(create());
    expect(await screen.findByText(en.names.needsLetter)).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: '  Нашият   дом ' } });
    expect(screen.queryByText(en.names.needsLetter)).not.toBeInTheDocument();
    fireEvent.click(create());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/households');
    expect(bodyOf()).toEqual({ name: 'Нашият дом' });
  });
});

describe('SharedGoalsCard', () => {
  const open = () =>
    fireEvent.click(screen.getByRole('button', { name: en.householdGoals.newGoal }));
  const name = () => screen.getByLabelText(en.householdGoals.name);
  const target = () => screen.getByLabelText(en.householdGoals.target);
  const create = () => screen.getByRole('button', { name: en.householdGoals.create });

  test('a name with no letter is refused in words, and nothing is sent', async () => {
    renderIt(<SharedGoalsCard />);
    open();
    fireEvent.change(name(), { target: { value: '/ /' } });
    fireEvent.change(target(), { target: { value: '500' } });
    fireEvent.click(create());
    expect(await screen.findByText(en.names.needsLetter)).toBeInTheDocument();
    expect(name()).not.toHaveAttribute('maxLength');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a good name with no target: the toast speaks of the TARGET only', async () => {
    renderIt(<SharedGoalsCard />);
    open();
    fireEvent.change(name(), { target: { value: 'Ваканция' } });
    fireEvent.change(target(), { target: { value: '0' } });
    fireEvent.click(create());
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: en.householdGoals.invalidTarget, status: 'error' })
      )
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a Bulgarian name is sent normalised', async () => {
    renderIt(<SharedGoalsCard />);
    open();
    fireEvent.change(name(), { target: { value: '  Ваканция   на  морето ' } });
    fireEvent.change(target(), { target: { value: '500' } });
    fireEvent.click(create());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodyOf()).toMatchObject({ name: 'Ваканция на морето', target_amount: 500 });
  });
});

describe('ValuesPlanSection', () => {
  const addInput = () => screen.getByPlaceholderText(en.values.namePlaceholder);
  const add = () => screen.getByRole('button', { name: en.values.addValue });
  const startRename = () => fireEvent.click(screen.getByRole('button', { name: en.values.edit }));
  const save = () => screen.getByRole('button', { name: en.values.save });

  test('adding: a refused name is said in words; nothing is sent', async () => {
    renderIt(<ValuesPlanSection />);
    expect(addInput()).not.toHaveAttribute('maxLength');
    fireEvent.change(addInput(), { target: { value: 'Хра\u200Bна' } });
    fireEvent.click(add());
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: en.names.invalidCharacters, status: 'error' })
      )
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('adding: a Bulgarian name is sent normalised', async () => {
    renderIt(<ValuesPlanSection />);
    fireEvent.change(addInput(), { target: { value: '  Пътувания  ' } });
    fireEvent.click(add());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/values');
    expect(bodyOf()).toEqual({ name: 'Пътувания' });
  });

  test('renaming: a refused name keeps the editor open with what was typed', async () => {
    renderIt(<ValuesPlanSection />);
    startRename();
    const long = 'ж'.repeat(51);
    fireEvent.change(screen.getByDisplayValue('Здраве'), { target: { value: long } });
    fireEvent.click(save());
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: tooLong(50) }))
    );
    expect(screen.getByDisplayValue(long)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('renaming: a name the server refuses (duplicate) also keeps the editor open', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({}) });
    renderIt(<ValuesPlanSection />);
    startRename();
    fireEvent.change(screen.getByDisplayValue('Здраве'), { target: { value: 'Семейство' } });
    fireEvent.click(save());
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: en.values.duplicateName })
      )
    );
    expect(screen.getByDisplayValue('Семейство')).toBeInTheDocument();
  });

  test('renaming: an accepted name is sent normalised and the editor closes', async () => {
    renderIt(<ValuesPlanSection />);
    startRename();
    fireEvent.change(screen.getByDisplayValue('Здраве'), {
      target: { value: '  Здраве   и спорт ' },
    });
    fireEvent.click(save());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/values/v1');
    expect(bodyOf()).toEqual({ name: 'Здраве и спорт' });
    await waitFor(() =>
      expect(screen.queryByDisplayValue('  Здраве   и спорт ')).not.toBeInTheDocument()
    );
  });

  test('renaming to the same name once normalised sends nothing and closes', async () => {
    renderIt(<ValuesPlanSection />);
    startRename();
    fireEvent.change(screen.getByDisplayValue('Здраве'), { target: { value: '  Здраве ' } });
    fireEvent.click(save());
    await waitFor(() => expect(screen.queryByDisplayValue('  Здраве ')).not.toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('AccountSection (display name, through useSettingsProfile)', () => {
  const PROFILE = {
    id: 'u1',
    email: 'person@example.test',
    display_name: 'Иван',
    profile_picture_url: null,
    preferences: {},
    created_at: '2026-01-01T00:00:00Z',
  };
  const puts = () =>
    fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PUT');

  beforeEach(() => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'PUT'
        ? ok({ data: { ...PROFILE, display_name: JSON.parse(String(init.body)).display_name } })
        : ok({ data: PROFILE })
    );
  });

  async function renderLoaded() {
    renderIt(<AccountSection />);
    return screen.findByDisplayValue('Иван');
  }
  const saveButton = () => screen.getByRole('button', { name: en.settings.saveProfile });

  test('an invisible character is refused in words, and no PUT is sent', async () => {
    const input = await renderLoaded();
    fireEvent.change(input, { target: { value: 'Ив\u200Bан' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText(en.names.invalidCharacters)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(puts()).toEqual([]);
  });

  test('the display name has a limit now, 100, said in words', async () => {
    const input = await renderLoaded();
    fireEvent.change(input, { target: { value: 'ж'.repeat(101) } });
    fireEvent.click(saveButton());
    expect(await screen.findByText(tooLong(100))).toBeInTheDocument();
    expect(puts()).toEqual([]);
  });

  test('a Bulgarian name is sent normalised; an emptied field clears the name (null)', async () => {
    const input = await renderLoaded();
    fireEvent.change(input, { target: { value: '  Иван   Петров ' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(JSON.parse(String((puts()[0][1] as RequestInit).body))).toEqual({
      display_name: 'Иван Петров',
    });
    // The first save must FINISH: while saving, the button is disabled and a click is lost.
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }))
    );
    fireEvent.change(await screen.findByDisplayValue('Иван Петров'), { target: { value: '   ' } });
    await waitFor(() => expect(saveButton()).not.toBeDisabled());
    fireEvent.click(saveButton());
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(JSON.parse(String((puts()[1][1] as RequestInit).body))).toEqual({ display_name: null });
  });
});
