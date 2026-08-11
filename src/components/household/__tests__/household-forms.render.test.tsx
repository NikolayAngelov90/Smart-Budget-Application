/**
 * Household form rendering — HP-4.
 *
 * These four components had no render coverage at all: `HouseholdMembers` was
 * the only household component with a test. So the mobile-layout fix changed
 * lines that no test executed.
 *
 * What is asserted here is behaviour a layout change could plausibly break —
 * that each editing form actually opens, that its controls are reachable by
 * their accessible name, and that a control the user must be able to find is
 * present. Widths are NOT asserted: jsdom has no layout engine and reports 0
 * for everything, which is why the geometry lives in `mobile-form-layout.test`
 * as a source guard instead.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { HouseholdInvites } from '../HouseholdInvites';
import { AllowanceCard } from '../AllowanceCard';
import { ContributionSplitCard } from '../ContributionSplitCard';
import { SharedGoalsCard } from '../SharedGoalsCard';
import { HouseholdSection } from '../HouseholdSection';

const mockHousehold = jest.fn();
const mockInvitations = jest.fn();
const mockAllowance = jest.fn();
const mockContributions = jest.fn();
const mockGoals = jest.fn();

jest.mock('@/lib/hooks/useHousehold', () => ({
  useHousehold: () => mockHousehold(),
}));
jest.mock('@/lib/hooks/useInvitations', () => ({
  useInvitations: () => mockInvitations(),
}));
// HouseholdSection composes the page. Stub only the children this file does not
// also test directly — mocking SharedGoalsCard here would silently gut its own
// tests below, which import the real component.
jest.mock('../PendingInviteBanner', () => ({ PendingInviteBanner: () => null }));
jest.mock('../HouseholdMembers', () => ({ HouseholdMembers: () => null }));
jest.mock('../HouseholdInsightsCard', () => ({ HouseholdInsightsCard: () => null }));
jest.mock('../CombinedSpendingCard', () => ({ CombinedSpendingCard: () => null }));
jest.mock('swr', () => ({ useSWRConfig: () => ({ mutate: jest.fn() }) }));
jest.mock('@/lib/hooks/useAllowance', () => ({
  useAllowance: () => mockAllowance(),
}));
jest.mock('@/lib/hooks/useContributions', () => ({
  useContributions: () => mockContributions(),
}));
jest.mock('@/lib/hooks/useHouseholdGoals', () => ({
  useHouseholdGoals: () => mockGoals(),
}));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
// Keys, not prose — the accessible names below are then unambiguous.
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const renderIt = (ui: React.ReactElement) => render(ui, { wrapper: ChakraProvider });

beforeEach(() => {
  jest.clearAllMocks();
  mockHousehold.mockReturnValue({ household: null, isLoading: false, error: undefined, mutate: jest.fn() });
  mockInvitations.mockReturnValue({ invitations: [], isLoading: false, error: undefined, mutate: jest.fn() });
  mockAllowance.mockReturnValue({ status: null, isLoading: false, error: undefined, mutate: jest.fn() });
  mockContributions.mockReturnValue({
    summary: {
      splits: [
        {
          // user_id and progress are not optional decoration: the row is keyed
          // by user_id and the caption computes `progress * 100`. Omitting them
          // produced a React key warning and a NaN percentage in the first
          // draft of this fixture.
          user_id: 'u-1',
          isSelf: true,
          email: 'me@example.com',
          percentage: 50,
          fairShare: 100,
          contributed: 40,
          progress: 0.4,
        },
      ],
    },
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
  });
  mockGoals.mockReturnValue({ goals: [], isLoading: false, error: undefined, mutate: jest.fn() });
});

describe('HouseholdInvites', () => {
  it('exposes the email field by its accessible name', () => {
    renderIt(<HouseholdInvites />);

    expect(screen.getByLabelText('emailPlaceholder')).toBeInTheDocument();
  });

  it('keeps send disabled until an email is typed', () => {
    renderIt(<HouseholdInvites />);

    const send = screen.getByRole('button', { name: 'send' });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText('emailPlaceholder'), {
      target: { value: 'someone@example.com' },
    });
    expect(send).toBeEnabled();
  });
});

describe('AllowanceCard', () => {
  it('opens the amount + currency form from the setup button', () => {
    renderIt(<AllowanceCard />);

    // Closed initially — the form must be reachable, not just present.
    expect(screen.queryByLabelText('amountLabel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'setup' }));

    expect(screen.getByLabelText('amountLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('currencyLabel')).toBeInTheDocument();
  });

  it('closes again on cancel', () => {
    renderIt(<AllowanceCard />);
    fireEvent.click(screen.getByRole('button', { name: 'setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(screen.queryByLabelText('amountLabel')).not.toBeInTheDocument();
  });
});

describe('ContributionSplitCard', () => {
  it('opens the percentage field, which carries its own label', () => {
    renderIt(<ContributionSplitCard />);

    // The trigger and the field share the `yourPercentage` key; the trigger is
    // replaced by the form, so the name is never ambiguous at one moment.
    fireEvent.click(screen.getByRole('button', { name: 'yourPercentage' }));

    const field = screen.getByLabelText('yourPercentage');
    expect(field).toBeInTheDocument();
    // The placeholder is the only hint of what the number means, so it has to
    // survive — this is the field that had 58px for a 172px label.
    expect(field).toHaveAttribute('placeholder', 'yourPercentage');
  });

  it('closes the percentage form on cancel', () => {
    renderIt(<ContributionSplitCard />);
    fireEvent.click(screen.getByRole('button', { name: 'yourPercentage' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(screen.queryByLabelText('yourPercentage')).not.toBeInTheDocument();
  });
});

describe('HouseholdSection', () => {
  it('shows the create form with a labelled name field when in no household', () => {
    // The worst case measured: at 390px this field had 52px for a 165px
    // placeholder, so it read "Име на" and the user could not tell what it
    // wanted. The label is the only thing naming it.
    renderIt(<HouseholdSection />);

    expect(screen.getByLabelText('namePlaceholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'create' })).toBeInTheDocument();
  });

  it('keeps create disabled until a name is entered', () => {
    renderIt(<HouseholdSection />);

    const create = screen.getByRole('button', { name: 'create' });
    expect(create).toBeDisabled();

    fireEvent.change(screen.getByLabelText('namePlaceholder'), {
      target: { value: 'Our place' },
    });
    expect(create).toBeEnabled();
  });

  it('offers the transparency preset once a household exists', () => {
    mockHousehold.mockReturnValue({
      household: { id: 'h-1', name: 'Our place', isAdmin: true, preset: null },
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    });

    renderIt(<HouseholdSection />);

    expect(screen.getByLabelText('presetHeading')).toBeInTheDocument();
  });
});

describe('SharedGoalsCard', () => {
  it('opens the new-goal form with all three fields labelled, and accepts input', () => {
    renderIt(<SharedGoalsCard />);

    fireEvent.click(screen.getByRole('button', { name: 'newGoal' }));

    const name = screen.getByLabelText('name');
    const target = screen.getByLabelText('target');
    const deadline = screen.getByLabelText('deadline');
    expect(name).toBeInTheDocument();
    expect(target).toBeInTheDocument();
    expect(deadline).toBeInTheDocument();

    // Typing, not just presence: each field's onChange is its own closure, and
    // a field that renders but does not accept input looks identical to a
    // working one until someone tries to use it.
    fireEvent.change(name, { target: { value: 'New sofa' } });
    fireEvent.change(target, { target: { value: '750' } });
    fireEvent.change(deadline, { target: { value: '2026-12-31' } });

    expect(name).toHaveValue('New sofa');
    expect(target).toHaveValue(750);
    expect(deadline).toHaveValue('2026-12-31');
  });

  it('closes the new-goal form on cancel', () => {
    renderIt(<SharedGoalsCard />);
    fireEvent.click(screen.getByRole('button', { name: 'newGoal' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(screen.queryByLabelText('name')).not.toBeInTheDocument();
  });

  it('offers a contribute field on an existing goal', () => {
    mockGoals.mockReturnValue({
      goals: [
        {
          goal: {
            id: 'g-1',
            name: 'Vacation',
            target_amount: 1000,
            current_amount: 250,
            deadline: null,
            currency: 'EUR',
          },
          breakdown: [],
        },
      ],
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    });

    renderIt(<SharedGoalsCard />);
    fireEvent.click(screen.getByRole('button', { name: 'contribute' }));

    // The row the source guard caught after the browser pass missed it — this
    // form only exists once a goal does.
    const amount = screen.getByLabelText('contributeAmount');
    expect(amount).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: '25.50' } });
    expect(amount).toHaveValue(25.5);
  });

  it('offers save and cancel on the contribute row', () => {
    // These buttons were 32px until HP-6 — and on mobile they are stacked
    // full-width, so they look like primary targets while being the shortest
    // things on screen.
    mockGoals.mockReturnValue({
      goals: [
        {
          goal: {
            id: 'g-1',
            name: 'Vacation',
            target_amount: 1000,
            current_amount: 250,
            deadline: null,
            currency: 'EUR',
          },
          breakdown: [],
        },
      ],
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    });

    renderIt(<SharedGoalsCard />);
    fireEvent.click(screen.getByRole('button', { name: 'contribute' }));

    expect(screen.getByRole('button', { name: 'save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cancel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByLabelText('contributeAmount')).not.toBeInTheDocument();
  });

  it('shows the goal it is contributing to', () => {
    mockGoals.mockReturnValue({
      goals: [
        {
          goal: {
            id: 'g-1',
            name: 'Vacation',
            target_amount: 1000,
            current_amount: 250,
            deadline: null,
            currency: 'EUR',
          },
          breakdown: [],
        },
      ],
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    });

    renderIt(<SharedGoalsCard />);

    expect(screen.getByText('Vacation')).toBeInTheDocument();
  });
});
