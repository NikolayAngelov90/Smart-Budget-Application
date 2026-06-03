/**
 * AccountSheet Tests — Story UX-1 (Mobile Shell)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { AccountSheet } from '@/components/layout/AccountSheet';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      accountSettings: 'Account & settings',
      logout: 'Logout',
    };
    return map[key] ?? key;
  },
}));

jest.mock('next/link', () => {
  const Link = ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>;
  Link.displayName = 'Link';
  return Link;
});

const renderWithChakra = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);

const baseProps = {
  isOpen: true,
  onClose: jest.fn(),
  email: 'nikit@example.com',
  displayName: 'Nikit',
  onLogout: jest.fn(),
};

describe('AccountSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders identity, account link, and sign out when open', () => {
    renderWithChakra(<AccountSheet {...baseProps} />);
    expect(screen.getByText('Nikit')).toBeInTheDocument();
    expect(screen.getByText('nikit@example.com')).toBeInTheDocument();
    expect(screen.getByText('Account & settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderWithChakra(<AccountSheet {...baseProps} isOpen={false} />);
    expect(screen.queryByText('nikit@example.com')).not.toBeInTheDocument();
  });

  it('calls onLogout (and closes) when Sign out is tapped', () => {
    const onClose = jest.fn();
    const onLogout = jest.fn();
    renderWithChakra(<AccountSheet {...baseProps} onClose={onClose} onLogout={onLogout} />);
    fireEvent.click(screen.getByText('Logout'));
    expect(onLogout).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('account link points to /settings', () => {
    renderWithChakra(<AccountSheet {...baseProps} />);
    const link = screen.getByText('Account & settings').closest('a');
    expect(link).toHaveAttribute('href', '/settings');
  });
});
