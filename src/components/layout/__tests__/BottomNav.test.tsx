/**
 * BottomNav Component Tests
 * Story 10-8: Mobile-Optimized Touch UI
 * AC-10.8.11: Unit/component tests for bottom nav rendering, Add tab modal trigger, touch target sizes
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import * as nextNavigation from 'next/navigation';
import { BottomNav } from '../BottomNav';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/dashboard'),
}));

// Mock next/link — forward all props so Chakra can pass aria-current etc. to the DOM
jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockLink = ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const mockUsePathname = nextNavigation.usePathname as jest.Mock;

const renderWithChakra = (component: React.ReactElement) =>
  render(<ChakraProvider>{component}</ChakraProvider>);

describe('BottomNav', () => {
  const onAddClick = jest.fn();

  beforeEach(() => {
    onAddClick.mockClear();
    // Reset pathname to /dashboard
    mockUsePathname.mockReturnValue('/dashboard');
  });

  it('renders the tab areas (Dashboard, Transactions, Add, Insights, More)', () => {
    renderWithChakra(<BottomNav onAddClick={onAddClick} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
    // Household + Settings now live inside the More sheet (closed by default).
    expect(screen.queryByText('Household')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('opens the More sheet with the secondary destinations when tapped', () => {
    renderWithChakra(<BottomNav onAddClick={onAddClick} />);

    // Sheet is closed initially — its destinations are not shown.
    expect(screen.queryByRole('link', { name: /^categories$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^more$/i }));

    // Categories, Goals, Household, Settings are now reachable.
    expect(screen.getByRole('link', { name: /^categories$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^goals$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^household$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^settings$/i })).toBeInTheDocument();
    // Inline quick-add affordances for Categories + Goals.
    expect(screen.getByRole('link', { name: /add category/i })).toHaveAttribute('href', '/categories?new=1');
    expect(screen.getByRole('link', { name: /add goal/i })).toHaveAttribute('href', '/goals?new=1');
  });

  it('calls onAddClick when the Add button is tapped', () => {
    renderWithChakra(<BottomNav onAddClick={onAddClick} />);

    const addButton = screen.getByRole('button', { name: /add transaction/i });
    fireEvent.click(addButton);

    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  it('renders the nav landmark with accessible label', () => {
    renderWithChakra(<BottomNav onAddClick={onAddClick} />);
    const nav = screen.getByRole('navigation', { name: /mobile navigation/i });
    expect(nav).toBeInTheDocument();
  });

  it('the Add tab button has aria-label "Add transaction"', () => {
    renderWithChakra(<BottomNav onAddClick={onAddClick} />);

    const addButton = screen.getByRole('button', { name: /add transaction/i });
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveAttribute('aria-label', 'Add transaction');
  });

  it('marks the Dashboard tab as active on /dashboard (aria-current="page")', () => {
    mockUsePathname.mockReturnValue('/dashboard');

    renderWithChakra(<BottomNav onAddClick={onAddClick} />);

    const dashboardLink = screen.getByRole('link', { name: /^dashboard$/i });
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
  });

  it('marks the Transactions tab as active when on /transactions', () => {
    mockUsePathname.mockReturnValue('/transactions');

    renderWithChakra(<BottomNav onAddClick={onAddClick} />);

    const transactionsLink = screen.getByRole('link', { name: /^transactions$/i });
    expect(transactionsLink).toHaveAttribute('aria-current', 'page');
  });

  it('renders the primary navigation tab links as accessible links', () => {
    renderWithChakra(<BottomNav onAddClick={onAddClick} />);

    expect(screen.getByRole('link', { name: /^dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^transactions$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^insights$/i })).toBeInTheDocument();
    // "More" is a button (opens a sheet), not a link.
    expect(screen.getByRole('button', { name: /^more$/i })).toBeInTheDocument();
  });
});
