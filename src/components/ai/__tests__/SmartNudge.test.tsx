/**
 * SmartNudge a11y tests — Story 15.8
 *
 * The nudge is a NON-blocking coaching banner: role="status" (polite), never
 * role="alert" (assertive/interruptive). Severity is conveyed by text/icon,
 * not color alone; the dismiss control has an accessible name.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SmartNudge } from '@/components/ai/SmartNudge';
import type { NudgePayload } from '@/types/database.types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'dismiss' ? 'Dismiss' : key),
}));

// FinancialDisclaimer pulls its own translations — stub it out
jest.mock('@/components/ai/FinancialDisclaimer', () => ({
  FinancialDisclaimer: () => null,
}));

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

const NUDGE: NudgePayload = {
  title: 'Groceries spending at 85%',
  body: 'You are approaching your usual monthly amount.',
  severity: 'approaching',
} as NudgePayload;

describe('SmartNudge — accessibility (Story 15.8)', () => {
  it('renders nothing with no nudge (no status region)', () => {
    // Chakra renders a hidden env span, so query for content — never emptiness (15-1)
    renderWithChakra(<SmartNudge nudge={null} onDismiss={jest.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('uses role="status" (polite) — NOT role="alert"', () => {
    renderWithChakra(<SmartNudge nudge={NUDGE} onDismiss={jest.fn()} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    // must not be an assertive alert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('conveys the nudge via TEXT (color-not-sole) and shows a named dismiss control', () => {
    renderWithChakra(<SmartNudge nudge={NUDGE} onDismiss={jest.fn()} />);
    expect(screen.getByText('Groceries spending at 85%')).toBeInTheDocument();
    expect(screen.getByText('You are approaching your usual monthly amount.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('dismiss button fires onDismiss', () => {
    const onDismiss = jest.fn();
    renderWithChakra(<SmartNudge nudge={NUDGE} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
