'use client';

/**
 * Shared chrome for an index-plus-sub-pages screen — Story 17.1.
 *
 * Extracted from `SettingsSubPage` (Story 16.8) so Household can reuse the exact
 * back affordance rather than grow a second copy of it. The a11y details here
 * are the kind that drift silently between duplicates: a 44px target and the
 * `boxShadow: 'focus'` ring, because the UA default ring is near-invisible on
 * the dark canvas and this link is the primary way out of a sub-page.
 *
 * It takes RESOLVED STRINGS, not i18n keys, so it is not coupled to one
 * namespace — Settings resolves from `settings`, Household from
 * `householdDashboard`. It also does NOT render `AppLayout`: Settings supplies
 * that in `SettingsSubPage` (there is no `(dashboard)/layout.tsx`), while
 * Household supplies it in `src/app/household/layout.tsx`. Wrapping it here
 * would double-wrap one of them.
 */

import { Box, Container, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import { ChevronLeftIcon } from '@chakra-ui/icons';
import NextLink from 'next/link';

interface SubPageShellProps {
  /** Where the back link goes — the index this sub-page belongs to. */
  backHref: string;
  /** Visible back-link text, already translated (e.g. "Settings", "Household"). */
  backLabel: string;
  /** Accessible name for the back link, already translated. */
  backAriaLabel: string;
  /** Page title, already translated. Rendered as the page's only h1. */
  title: string;
  /** Optional one-line description under the title, already translated. */
  description?: string;
  children: React.ReactNode;
}

export function SubPageShell({
  backHref,
  backLabel,
  backAriaLabel,
  title,
  description,
  children,
}: SubPageShellProps) {
  return (
    <Container maxW="container.md" py={{ base: 4, md: 8 }}>
      <VStack spacing={6} align="stretch">
        <Box>
          <HStack
            as={NextLink}
            href={backHref}
            spacing={1}
            color="fg.muted"
            fontSize="sm"
            fontWeight="medium"
            mb={3}
            minH="44px"
            display="inline-flex"
            alignItems="center"
            _hover={{ color: 'accent' }}
            _focusVisible={{ boxShadow: 'focus', outline: 'none', borderRadius: 'md' }}
            aria-label={backAriaLabel}
          >
            <ChevronLeftIcon boxSize={5} />
            <Text>{backLabel}</Text>
          </HStack>

          <Heading as="h1" size="lg" color="fg" fontFamily="heading" letterSpacing="tight">
            {title}
          </Heading>
          {description && (
            <Text color="fg.muted" mt={1}>
              {description}
            </Text>
          )}
        </Box>

        {children}
      </VStack>
    </Container>
  );
}
