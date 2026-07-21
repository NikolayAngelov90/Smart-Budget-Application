'use client';

/**
 * FeatureIntroCard — Story 15.7 (FR37)
 *
 * The "brief introduction" that surfaces when a usage threshold is first
 * crossed (AC1). Shows the SINGLE highest-priority pending intro at a time
 * (15-3 toast-cap lesson applied to the card — no stack of "new feature!"
 * cards). Dismissing ("Got it") persists the acknowledgment so it never
 * re-surfaces. Renders null when nothing is pending.
 */

import { useState } from 'react';
import { Box, Button, Flex, Heading, HStack, Text, Link as ChakraLink } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { useFeatureDisclosure } from '@/lib/hooks/useFeatureDisclosure';
import { FEATURE_DISCLOSURE, type FeatureKey } from '@/lib/ai/disclosureCatalog';

/**
 * Picks the highest-priority pending intro by CATALOG (onboarding) order —
 * not by requirement.value, which mixes incompatible metrics (14 days vs 30/50
 * transactions) and would always rank projections last just because 14 < 30.
 */
function pickIntro(pending: FeatureKey[]): FeatureKey | null {
  if (pending.length === 0) return null;
  const catalogOrder = Object.keys(FEATURE_DISCLOSURE) as FeatureKey[];
  return catalogOrder.find((k) => pending.includes(k)) ?? null;
}

export function FeatureIntroCard() {
  const t = useTranslations('disclosure');
  const { pending, acknowledge } = useFeatureDisclosure();
  // Optimistic hide keyed to the feature — a later intro must not inherit an
  // earlier one's dismissal in a long-lived tab (15-4 dismissal-key lesson).
  const [dismissed, setDismissed] = useState<Set<FeatureKey>>(new Set());

  const visiblePending = pending.filter((k) => !dismissed.has(k));
  const feature = pickIntro(visiblePending);
  if (!feature) return null;

  const { url } = FEATURE_DISCLOSURE[feature];

  const handleDismiss = () => {
    setDismissed((prev) => new Set(prev).add(feature)); // optimistic hide
    void acknowledge(feature);
  };

  return (
    <Box
      as="section"
      aria-label={t('cardHeading')}
      bg="trustBlue.50"
      border="1px solid"
      borderColor="trustBlue.200"
      borderRadius="xl"
      p={{ base: 4, md: 5 }}
      mb={{ base: 6, md: 8 }}
    >
      <Flex justify="space-between" align="flex-start" gap={3} flexWrap="wrap">
        <Box>
          <Heading as="h3" size="sm" color="gray.800" mb={1}>
            {t('cardHeading')}
          </Heading>
          <Text color="gray.700" fontSize="sm">
            {t(`intro.${feature}`)}
          </Text>
        </Box>
        <HStack spacing={2} flexShrink={0}>
          <ChakraLink
            as={NextLink}
            href={url}
            bg="#2b6cb0"
            color="white"
            _hover={{ bg: '#2c5282', textDecoration: 'none' }}
            borderRadius="md"
            px={4}
            py={2}
            minH="44px"
            display="inline-flex"
            alignItems="center"
            fontSize="sm"
            fontWeight={600}
            onClick={handleDismiss}
          >
            {t('introCta')}
          </ChakraLink>
          <Button variant="ghost" size="sm" minH="44px" onClick={handleDismiss}>
            {t('introDismiss')}
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
}
