'use client';

/**
 * HouseholdSection — Story 13.1
 *
 * Settings entry point for household creation. When the user has no household it
 * shows a name input + "Create household"; otherwise it shows the household name
 * and the user's role. Full household management arrives in later Epic 13 stories.
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Button,
  Badge,
  Skeleton,
  Select,
  Divider,
  useToast,
} from '@chakra-ui/react';
import { mutate as globalMutate } from 'swr';
import { useTranslations } from 'next-intl';
import { useHousehold } from '@/lib/hooks/useHousehold';
import { HouseholdInvites } from '@/components/household/HouseholdInvites';
import type { HouseholdPreset } from '@/types/database.types';

export function HouseholdSection() {
  const t = useTranslations('household');
  const toast = useToast();
  const { household, isLoading, error, mutate } = useHousehold();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);

  const handlePreset = async (preset: HouseholdPreset) => {
    setIsApplyingPreset(true);
    try {
      const response = await fetch('/api/households/preset', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      if (!response.ok) throw new Error(t('presetFailed'));
      await globalMutate('/api/categories'); // visibility of the caller's shared categories changed
      toast({ title: t('presetApplied'), status: 'success', duration: 3000, isClosable: true });
    } catch (presetError) {
      toast({
        title: presetError instanceof Error ? presetError.message : t('presetFailed'),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsApplyingPreset(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) {
        const status = response.status;
        throw new Error(status === 409 ? t('alreadyMember') : t('createFailed'));
      }
      const { data } = await response.json();
      await mutate({ data }, { revalidate: false });
      setName('');
      toast({ title: t('createdSuccess'), status: 'success', duration: 3000, isClosable: true });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t('createFailed'),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <VStack spacing={4} align="stretch">
          <Heading as="h2" size="md" color="gray.700">
            {t('heading')}
          </Heading>

          {isLoading ? (
            <Skeleton height="40px" borderRadius="md" />
          ) : error ? (
            <Text fontSize="sm" color="red.500">
              {t('loadError')}
            </Text>
          ) : household ? (
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between" align="center">
                <VStack align="flex-start" spacing={0}>
                  <Text fontWeight="semibold" color="gray.800">
                    {household.name}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {t('memberSince')}
                  </Text>
                </VStack>
                <Badge colorScheme={household.role === 'admin' ? 'blue' : 'gray'} borderRadius="full" px={3} py={1}>
                  {household.role === 'admin' ? t('roleAdmin') : t('roleMember')}
                </Badge>
              </HStack>
              {household.role === 'admin' && <HouseholdInvites />}

              {/* Story 13.4: transparency preset (applies defaults to your shared categories) */}
              <Box>
                <Divider my={2} />
                <Heading as="h3" size="sm" color="gray.700" mb={1}>
                  {t('presetHeading')}
                </Heading>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  {t('presetHint')}
                </Text>
                <Select
                  placeholder={t('presetChoose')}
                  isDisabled={isApplyingPreset}
                  onChange={(e) => {
                    if (e.target.value) handlePreset(e.target.value as HouseholdPreset);
                  }}
                  aria-label={t('presetHeading')}
                >
                  <option value="newlyweds">{t('presetNewlyweds')}</option>
                  <option value="roommates">{t('presetRoommates')}</option>
                  <option value="partners">{t('presetPartners')}</option>
                </Select>
              </Box>
            </VStack>
          ) : (
            <VStack align="stretch" spacing={3}>
              <Text fontSize="sm" color="gray.600">
                {t('emptyPrompt')}
              </Text>
              <HStack>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  maxLength={100}
                  aria-label={t('namePlaceholder')}
                />
                <Button
                  colorScheme="blue"
                  onClick={handleCreate}
                  isLoading={isSubmitting}
                  loadingText={t('creating')}
                  isDisabled={!name.trim()}
                  flexShrink={0}
                >
                  {t('create')}
                </Button>
              </HStack>
            </VStack>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
