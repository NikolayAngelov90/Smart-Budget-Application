'use client';

import { Box, Flex, Heading, Text } from '@chakra-ui/react';

interface SectionHeaderProps {
  /** Small uppercase kicker that names the *kind* of content below. */
  eyebrow?: string;
  title: string;
  hint?: string;
  /** Optional right-aligned control (e.g. "View all"). */
  action?: React.ReactNode;
  id?: string;
}

/**
 * The dashboard's structural device. An eyebrow + title pair with a hairline
 * gives each band of the page a clear identity, so the screen reads as a set of
 * deliberate sections rather than an undifferentiated stack of cards.
 */
export function SectionHeader({ eyebrow, title, hint, action, id }: SectionHeaderProps) {
  return (
    <Flex align="flex-end" justify="space-between" gap={3} mb={{ base: 3, md: 4 }}>
      <Box minW={0}>
        {eyebrow && (
          <Text
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="wider"
            textTransform="uppercase"
            color="accent"
            mb={1}
          >
            {eyebrow}
          </Text>
        )}
        <Heading as="h2" id={id} fontSize={{ base: 'lg', md: 'xl' }} fontWeight={600} letterSpacing="tight" color="fg">
          {title}
        </Heading>
        {hint && (
          <Text fontSize="sm" color="fg.muted" mt={1}>
            {hint}
          </Text>
        )}
      </Box>
      {action && <Box flexShrink={0}>{action}</Box>}
    </Flex>
  );
}
