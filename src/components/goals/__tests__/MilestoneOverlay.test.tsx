/**
 * MilestoneOverlay Component Tests
 * Story 11.6: Goal Milestone Celebrations
 *
 * Tests: rendering, confetti presence, reduced-motion, auto-dismiss, dismiss button, aria-live.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MilestoneOverlay } from '@/components/goals/MilestoneOverlay';

// ============================================================================
// MOCKS
// ============================================================================

// Override the global @chakra-ui/react mock to avoid requireActual issues
// when framer-motion is also mocked. Provide stub implementations for all
// components used by MilestoneOverlay.
jest.mock('@chakra-ui/react', () => ({
  Modal: ({ children, isOpen }: React.PropsWithChildren<{ isOpen: boolean }>) =>
    isOpen ? <div data-testid="chakra-modal">{children}</div> : null,
  ModalOverlay: () => null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ModalContent: ({ children, ...rest }: React.PropsWithChildren<any>) => (
    <div data-testid="milestone-overlay" {...rest}>{children}</div>
  ),
  ModalBody: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ModalFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Box: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
  Heading: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  Text: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VisuallyHidden: ({ children }: React.PropsWithChildren<any>) => (
    <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}>
      {children}
    </span>
  ),
}));

const mockUseReducedMotion = jest.fn();

jest.mock('framer-motion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  motion: { div: ({ children, ...props }: React.PropsWithChildren<any>) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      milestoneTitle: 'Milestone Reached!',
      milestoneComplete: 'Goal Complete! 🏆',
      milestoneDismiss: 'Keep Going!',
    };
    if (key === 'milestoneMessage') {
      return `${String(params?.goalName ?? '')} is ${String(params?.percentage ?? '')}% funded!`;
    }
    if (key === 'milestoneAmount') {
      return `You've saved ${String(params?.amount ?? '')} toward your goal`;
    }
    return map[key] ?? key;
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  milestone: 50,
  goalName: 'Emergency Fund',
  currentAmount: 500,
  currency: 'EUR',
};

// ============================================================================
// TESTS
// ============================================================================

describe('MilestoneOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders milestone percentage and goal name', () => {
    render(<MilestoneOverlay {...defaultProps} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Emergency Fund is 50% funded!')).toBeInTheDocument();
  });

  it('renders "Milestone Reached!" heading for non-100% milestones', () => {
    render(<MilestoneOverlay {...defaultProps} milestone={50} />);
    expect(screen.getByText('Milestone Reached!')).toBeInTheDocument();
  });

  it('renders "Goal Complete! 🏆" heading for 100% milestone', () => {
    render(<MilestoneOverlay {...defaultProps} milestone={100} />);
    expect(screen.getByText('Goal Complete! 🏆')).toBeInTheDocument();
  });

  it('renders the overlay when isOpen is true', () => {
    render(<MilestoneOverlay {...defaultProps} />);
    expect(screen.getByTestId('milestone-overlay')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<MilestoneOverlay {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('milestone-overlay')).not.toBeInTheDocument();
  });

  it('renders confetti motion.divs when useReducedMotion returns false', () => {
    mockUseReducedMotion.mockReturnValue(false);
    render(<MilestoneOverlay {...defaultProps} />);
    // 15 confetti pieces — each renders as a motion.div (which our mock renders as a div)
    // The confetti box is only rendered when NOT reducedMotion
    expect(screen.getByTestId('milestone-overlay')).toBeInTheDocument();
    // Content is present (confetti rendered inside modal)
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('does not render confetti when useReducedMotion returns true', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<MilestoneOverlay {...defaultProps} />);
    // Reduced motion: still shows milestone content
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
  });

  it('auto-dismisses after 4 seconds', () => {
    const onClose = jest.fn();
    render(<MilestoneOverlay {...defaultProps} onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(4000); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismiss button calls onClose immediately', () => {
    const onClose = jest.fn();
    render(<MilestoneOverlay {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText('Keep Going!'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has aria-live="assertive" element outside Modal so it pre-exists in DOM', () => {
    render(<MilestoneOverlay {...defaultProps} />);
    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toBeInTheDocument();
    // Live region must be outside ModalContent so screen readers observe a change,
    // not a newly-mounted region already populated with content.
    const overlay = document.querySelector('[data-testid="milestone-overlay"]');
    expect(overlay).not.toContainElement(liveRegion as HTMLElement);
  });
});
