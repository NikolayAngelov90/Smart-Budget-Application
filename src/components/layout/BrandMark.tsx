'use client';

import { Box, HStack, Text } from '@chakra-ui/react';

interface BrandMarkProps {
  /** Hide the wordmark and show only the glyph (e.g. collapsed rail). */
  iconOnly?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Quiet Ledger brand mark — an evergreen rounded square holding a minimal
 * "flow" glyph: a rising ledger line with two nodes (money in, money kept).
 * Deliberately quiet; the personality lives in the type, not a busy logo.
 */
export function BrandMark({ iconOnly = false, size = 'md' }: BrandMarkProps) {
  const box = size === 'sm' ? '26px' : '30px';

  const glyph = (
    <Box
      as="span"
      w={box}
      h={box}
      minW={box}
      borderRadius="9px"
      bg="accent"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      boxShadow="accent"
      aria-hidden="true"
    >
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
        <path
          d="M2.5 11.5 L6.5 7.5 L9.5 9.5 L14.5 4"
          stroke="white"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="14.5" cy="4" r="1.7" fill="white" />
        <circle cx="2.5" cy="11.5" r="1.4" fill="rgba(255,255,255,0.55)" />
      </svg>
    </Box>
  );

  if (iconOnly) return glyph;

  return (
    <HStack spacing={2.5} align="center">
      {glyph}
      <Text
        fontFamily="heading"
        fontWeight={600}
        fontSize={size === 'sm' ? 'md' : 'lg'}
        letterSpacing="tight"
        color="fg"
        whiteSpace="nowrap"
      >
        Smart Budget
      </Text>
    </HStack>
  );
}
