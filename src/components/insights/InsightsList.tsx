'use client';

import { useState, useMemo } from 'react';
import { VStack, Text, Spinner, Center, Box, HStack, Badge } from '@chakra-ui/react';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { AIInsightCard } from './AIInsightCard';
import { InsightMetadata } from './InsightMetadata';
import { InsightDetailModal } from './InsightDetailModal';
import { groupInsights, selectLeadInsight } from '@/lib/utils/insightGroups';
import type { Insight } from '@/types/database.types';

interface InsightsListProps {
  insights: Insight[];
  onDismiss: (id: string) => void;
  onUndismiss: (id: string) => void;
  isLoading?: boolean;
}

export function InsightsList({
  insights,
  onDismiss,
  onUndismiss,
  isLoading = false,
}: InsightsListProps) {
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const t = useTranslations('insights');
  // Timestamps were formatted with the default (English) locale, so they read
  // "July 25th, 2026" inside the Bulgarian UI (same class as the hero-date fix).
  const locale = useLocale();
  const dateLocale = locale === 'bg' ? bg : undefined;

  const handleOpenModal = (insight: Insight) => {
    setSelectedInsight(insight);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedInsight(null);
  };

  // Story 16.4: spotlight the single most valuable insight, then group the rest
  // into semantic sections so the page reads as guidance, not a flat stream.
  const { lead, groups } = useMemo(() => {
    const { lead: leadInsight, rest } = selectLeadInsight(insights);
    return { lead: leadInsight, groups: groupInsights(rest) };
  }, [insights]);

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
        expandable={true}
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
              fontSize="2xs"
              color="accent"
              textTransform="uppercase"
              letterSpacing="wide"
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
