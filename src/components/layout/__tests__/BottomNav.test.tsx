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

  it('renders all 5 tab areas (Dashboard, Transactions, Add, Insights, Settings)', () => {
    renderWithChakra(<BottomNav onAddClick={onAddClick} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
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

  it('renders all navigation tab links as accessible links', () => {
    renderWithChakra(<BottomNav onAddClick={onAddClick} />);

    expect(screen.getByRole('link', { name: /^dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^transactions$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^insights$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^settings$/i })).toBeInTheDocument();
  });
});
