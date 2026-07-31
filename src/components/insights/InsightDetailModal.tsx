'use client';

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Text,
  Badge,
  HStack,
  useBreakpointValue,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import type { Insight } from '@/types/database.types';
import { InsightMetadata } from './InsightMetadata';
import { InsightErrorBoundary } from './InsightErrorBoundary';
import { getInsightToneTokens } from '@/lib/utils/insightGroups';
import { getLocalizedInsightText } from '@/lib/utils/insightText';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

interface InsightDetailModalProps {
  insight: Insight | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * i18n key per type. The old local map covered only four of the six enum values,
 * so `spending_anomaly` / `new_high_spend_category` rendered the RAW ENUM STRING
 * in the badge — on mobile, this modal is the primary read path.
 */
const TYPE_LABEL_KEYS: Record<string, string> = {
  spending_increase: 'type_spending_increase',
  budget_recommendation: 'type_budget_recommendation',
  unusual_expense: 'type_unusual_expense',
  positive_reinforcement: 'type_positive_reinforcement',
  spending_anomaly: 'type_spending_anomaly',
  new_high_spend_category: 'type_new_high_spend_category',
};

export function InsightDetailModal({
  insight,
  isOpen,
  onClose,
}: InsightDetailModalProps) {
  // Responsive modal size: full screen on mobile, xl on desktop
  const modalSize = useBreakpointValue({ base: 'full', md: 'xl' });
  const t = useTranslations('insights');
  const tCommon = useTranslations('common');
  const { preferences } = useUserPreferences();

  if (!insight) return null;

  // DW-3: the SAME localised strings the card shows. This used to render the
  // raw stored columns, which hold English written at generation time — so the
  // Bulgarian UI switched languages the moment an insight was opened. Placed
  // below the guard because it is a plain function, not a hook.
  const { title: localizedTitle, description: localizedDescription } =
    getLocalizedInsightText(insight, t, preferences?.currency_format);

  const tone = getInsightToneTokens(insight.type);
  const labelKey = TYPE_LABEL_KEYS[insight.type];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={modalSize}
      scrollBehavior="inside"
      isCentered
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent
        maxH={{ base: '100vh', md: '90vh' }}
        m={{ base: 0, md: 4 }}
      >
        <ModalHeader pb={2}>
          <HStack spacing={3} align="start" flexWrap="wrap">
            <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="bold" flex="1">
              {localizedTitle}
            </Text>
            <Badge
              bg={tone.subtle}
              color={tone.fg}
              fontSize="sm"
              px={3}
              py={1}
              borderRadius="md"
            >
              {labelKey ? t(labelKey) : insight.type}
            </Badge>
          </HStack>
          <Text
            fontSize="sm"
            color="fg.muted"
            fontWeight="normal"
            mt={2}
            lineHeight="base"
          >
            {localizedDescription}
          </Text>
        </ModalHeader>

        <ModalCloseButton
          size="lg"
          top={4}
          right={4}
          aria-label={tCommon('close')}
        />

        <ModalBody pb={6}>
          <InsightErrorBoundary>
            <InsightMetadata insight={insight} />
          </InsightErrorBoundary>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
