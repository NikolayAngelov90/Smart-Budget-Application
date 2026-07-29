/**
 * HouseholdMembers — role badge rendering (Story 16.7).
 *
 * These components had no tests at all, and the QA account has no household
 * members, so the role badge had never been rendered by anything — which is
 * how it shipped at 4.01:1 in dark mode. Rendering it here at least pins the
 * markup and the admin/member branch.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import theme from '@/theme';
import { HouseholdMembers } from '../HouseholdMembers';

const mockUseHouseholdMembers = jest.fn();
jest.mock('@/lib/hooks/useHouseholdMembers', () => ({
  useHouseholdMembers: () => mockUseHouseholdMembers(),
}));
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const member = (over: Record<string, unknown> = {}) => ({
  user_id: 'u1',
  email: 'a@example.com',
  display_name: 'Ann',
  role: 'member',
  joined_at: '2026-01-01',
  ...over,
});

const withTheme = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider theme={theme}>{children}</ChakraProvider>
);

const renderList = (isAdmin = true) =>
  render(<HouseholdMembers isAdmin={isAdmin} />, { wrapper: withTheme });

/** Emotion writes its rules into <style> tags; jsdom will not resolve them via
 *  getComputedStyle, so read the generated CSS directly. */
const cssFor = (el: Element): string => {
  const classes = el.className.split(/\s+/).filter((c) => c.startsWith('css-'));
  if (classes.length === 0) return '';
  // Emotion inserts through CSSOM here, so <style>.textContent is empty —
  // the rules are only reachable via styleSheets.
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(cssRules)) {
      const text = rule.cssText;
      if (classes.some((c) => text.includes(`.${c}`))) rules.push(text);
    }
  }
  return rules.join(' ');
};

beforeEach(() => jest.clearAllMocks());

describe('HouseholdMembers', () => {
  it('renders nothing while loading', () => {
    mockUseHouseholdMembers.mockReturnValue({ members: [], isLoading: true, mutate: jest.fn() });
    renderList();
    expect(screen.queryByText('membersHeading')).not.toBeInTheDocument();
  });

  it('renders nothing when the household has no members', () => {
    mockUseHouseholdMembers.mockReturnValue({ members: [], isLoading: false, mutate: jest.fn() });
    renderList();
    expect(screen.queryByText('membersHeading')).not.toBeInTheDocument();
  });

  it('gives admin and member visibly different badges', () => {
    mockUseHouseholdMembers.mockReturnValue({
      members: [
        member({ user_id: 'u1', email: 'boss@example.com', role: 'admin' }),
        member({ user_id: 'u2', email: 'mate@example.com', role: 'member' }),
      ],
      isLoading: false,
      mutate: jest.fn(),
    });
    renderList();

    const badges = screen.getAllByText(/^role(Admin|Member)$/);
    expect(badges).toHaveLength(2);
    // Not just "different classes" — that passes even if one badge is
    // invisible. Both must actually paint a background, and a different one.
    const adminCss = cssFor(badges[0]!);
    const memberCss = cssFor(badges[1]!);
    expect(adminCss).toMatch(/background/);
    expect(memberCss).toMatch(/background/);
    expect(adminCss).not.toBe(memberCss);
  });

  it('still renders a legible badge for an unrecognised role', () => {
    // The badge branches on `=== 'admin'`, so anything else must fall through
    // to the neutral treatment rather than rendering unstyled.
    mockUseHouseholdMembers.mockReturnValue({
      members: [member({ role: 'owner' })],
      isLoading: false,
      mutate: jest.fn(),
    });
    renderList();

    // Anything that is not 'admin' must take the neutral branch.
    const badge = screen.getByText('roleMember');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/chakra-badge/);
  });

  it('never offers to remove yourself, even as admin', () => {
    // The safety property: an admin removing themselves would orphan the
    // household. Guarded by `!m.isSelf`, which nothing exercised before.
    mockUseHouseholdMembers.mockReturnValue({
      members: [
        member({ user_id: 'me', email: 'me@example.com', role: 'admin', isSelf: true }),
        member({ user_id: 'u2', email: 'mate@example.com', role: 'member' }),
      ],
      isLoading: false,
      mutate: jest.fn(),
    });
    renderList(true);

    expect(screen.getByText('you')).toBeInTheDocument();
    // One remove button — for the other member, not for yourself.
    expect(screen.getAllByText('remove')).toHaveLength(1);
  });

  it('offers removal only to admins', () => {
    mockUseHouseholdMembers.mockReturnValue({
      members: [member({ user_id: 'u2', role: 'member' })],
      isLoading: false,
      mutate: jest.fn(),
    });

    const { unmount } = renderList(true);
    const asAdmin = screen.queryAllByRole('button').length;
    unmount();

    renderList(false);
    const asMember = screen.queryAllByRole('button').length;

    expect(asAdmin).toBeGreaterThan(asMember);
  });
});
