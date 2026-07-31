'use client';

import { useState, useMemo, useRef } from 'react';
import { VStack, Text, Spinner, Center, Box, HStack, Badge } from '@chakra-ui/react';
import { format } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import { AIInsightCard } from './AIInsightCard';
import { InsightMetadata, hasInsightMetadata } from './InsightMetadata';
import { InsightDetailModal } from './InsightDetailModal';
import { groupInsights, selectLeadInsight } from '@/lib/utils/insightGroups';
import type { Insight } from '@/types/database.types';
import { getDateLocale } from '@/lib/utils/dateFormatter';

interface InsightsListProps {
  insights: Insight[];
  onDismiss: (id: string) => void;
  onUndismiss: (id: string) => void;
  isLoading?: boolean;
  /**
   * Whether to spotlight a lead insight. False on page 2+ and in the dismissed
   * view — "Start here" must mean the single most valuable insight overall, not
   * "the best thing on whichever page you happen to be on".
   */
  showLead?: boolean;
}

export function InsightsList({
  insights,
  onDismiss,
  onUndismiss,
  isLoading = false,
  showLead = true,
}: InsightsListProps) {
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const t = useTranslations('insights');
  // Timestamps were formatted with the default (English) locale, so they read
  // "July 25th, 2026" inside the Bulgarian UI (same class as the hero-date fix).
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  const handleOpenModal = (insight: Insight) => {
    setSelectedInsight(insight);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedInsight(null);
  };

  // Once an insight has been spotlighted we keep it in that slot (by id) for as
  // long as it stays in the list — even after it's dismissed. Re-running the
  // selection on every change would let a dismiss instantly promote a different
  // insight into the slot under the user's finger, so the 44px dismiss button
  // they just tapped now belongs to something they haven't read.
  const pinnedLeadIdRef = useRef<string | null>(null);

  // Story 16.4: spotlight the single most valuable insight, then group the rest
  // into semantic sections so the page reads as guidance, not a flat stream.
  const { lead, groups } = useMemo(() => {
    if (!showLead) {
      pinnedLeadIdRef.current = null;
      return { lead: null, groups: groupInsights(insights) };
    }

    const pinnedId = pinnedLeadIdRef.current;
    const pinned = pinnedId ? insights.find((i) => i.id === pinnedId) : undefined;
    if (pinned) {
      return {
        lead: pinned,
        groups: groupInsights(insights.filter((i) => i.id !== pinned.id)),
      };
    }

    // No pin yet (first render), or the pinned insight left the list (filter or
    // page change) — pick a fresh lead and remember it.
    const { lead: leadInsight, rest } = selectLeadInsight(insights);
    pinnedLeadIdRef.current = leadInsight?.id ?? null;
    return { lead: leadInsight, groups: groupInsights(rest) };
  }, [insights, showLead]);

  if (isLoading) {
    return (
      <Center w="full" py={12}>
        <VStack spacing={4}>
          <Spinner size="xl" color="accent" />
          <Text color="fg.muted">{t('loading')}</Text>
        </VStack>
      </Center>
    );
  }

  if (insights.length === 0) {
    return null; // Empty state handled by parent component
  }

  const renderCard = (insight: Insight, variant: 'default' | 'lead' = 'default') => (
    <Box key={insight.id} position="relative">
      {/* Timestamp */}
      <Text fontSize="xs" color="fg.subtle" mb={2} fontWeight="medium">
        {format(new Date(insight.created_at), 'PPP', { locale: dateLocale })} •{' '}
        {format(new Date(insight.created_at), 'p', { locale: dateLocale })}
      </Text>

      <AIInsightCard
        insight={insight}
        onDismiss={onDismiss}
        onUndismiss={onUndismiss}
        isDismissed={insight.is_dismissed}
        // DW-3: no affordance when there is nothing behind it. The Epic-12
        // types have no renderer, so this used to open a panel containing
        // "No additional details available", a divider, and a bold heading
        // over empty space.
        expandable={hasInsightMetadata(insight)}
        variant={variant}
        onOpenModal={() => handleOpenModal(insight)}
      >
        <InsightMetadata insight={insight} />
      </AIInsightCard>
    </Box>
  );

  return (
    <>
      <VStack align="stretch" spacing={8} w="full">
        {/* Lead / spotlight insight — the one to act on first */}
        {lead && (
          <Box as="section" aria-label={t('leadInsight')}>
            <Text
              as="h2"
              fontSize="2xs"
              color="accent"
              textTransform="uppercase"
              letterSpacing="wider"
              fontWeight="bold"
              mb={2}
            >
              {t('leadInsight')}
            </Text>
            {renderCard(lead, 'lead')}
          </Box>
        )}

        {/* Grouped remainder — Needs attention → What changed → Recommendations → Progress */}
        {groups.map((group) => (
          <Box as="section" key={group.key} aria-label={t(group.labelKey)}>
            <HStack spacing={2} mb={3} align="center">
              <Text
                as="h2"
                fontSize="sm"
                fontFamily="heading"
                fontWeight={600}
                color="fg"
                letterSpacing="tight"
              >
                {t(group.labelKey)}
              </Text>
              <Badge bg="surface.sunken" color="fg.muted" fontSize="2xs" borderRadius="full" px={2}>
                {group.insights.length}
              </Badge>
            </HStack>

            <VStack align="stretch" spacing={4}>
              {group.insights.map((insight) => renderCard(insight))}
            </VStack>
          </Box>
        ))}
      </VStack>

      {/* Detail Modal for Mobile */}
      <InsightDetailModal
        insight={selectedInsight}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}
