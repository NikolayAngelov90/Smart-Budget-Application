'use client';

/**
 * WishlistSection Component — Story 14.3 (FR15)
 *
 * Wishlist with budget-impact analysis on the goals page: add form (name,
 * price, optional expense category), active items with impact lines, and a
 * toggle to view purchased/removed history. Impact recomputes on every load
 * (auto-calculate on save falls out of POST → revalidate).
 */

import { useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Select,
  SimpleGrid,
  Skeleton,
  Text,
  useToast,
} from '@chakra-ui/react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { useWishlist } from '@/lib/hooks/useWishlist';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { WishlistItem } from './WishlistItem';
import type { WishlistItemWithImpact, WishlistStatus } from '@/types/database.types';

interface CategoryOption {
  id: string;
  name: string;
  isOwn?: boolean;
}

async function categoriesFetcher(url: string): Promise<{ data: CategoryOption[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

const PRICE_PATTERN = /^\d+([.,]\d{1,2})?$/;

export function WishlistSection() {
  const t = useTranslations('wishlist');
  const toast = useToast();
  const { data, error, isLoading, mutate } = useWishlist();
  const { preferences } = useUserPreferences();
  const currencyCode = preferences?.currency_format || 'EUR';

  const { data: categoriesData } = useSWR('/api/categories?type=expense', categoriesFetcher);
  const categories = (categoriesData?.data ?? []).filter((c) => c.isOwn !== false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const items = data?.items ?? [];
  const activeItems = items.filter((i) => i.status === 'active');
  const historyItems = items.filter((i) => i.status !== 'active');

  const handleAdd = async () => {
    if (isSaving) return;

    const trimmedName = name.trim();
    const normalizedPrice = price.trim().replace(',', '.');
    const parsedPrice = parseFloat(normalizedPrice);
    if (!trimmedName || trimmedName.length > 100) {
      setFormError(t('invalidName'));
      return;
    }
    if (!PRICE_PATTERN.test(price.trim()) || isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError(t('invalidPrice'));
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          price: Math.round(parsedPrice * 100) / 100,
          category_id: categoryId || null,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error?.message || 'Failed to save wishlist item');
      }
      setName('');
      setPrice('');
      setCategoryId('');
      setFormError('');
      mutate();
      toast({ title: t('addedSuccess', { name: trimmedName }), status: 'success', duration: 2500, isClosable: true });
    } catch (err) {
      toast({
        title: t('addFailed'),
        description: err instanceof Error ? err.message : undefined,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (item: WishlistItemWithImpact, status: WishlistStatus) => {
    setUpdatingId(item.id);
    try {
      const response = await fetch(`/api/wishlist/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update wishlist item');
      mutate();
    } catch {
      toast({ title: t('updateFailed'), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Box as="section" aria-label={t('title')} mt={{ base: 10, md: 12 }}>
      <Flex justify="space-between" align="baseline" mb={1} flexWrap="wrap" gap={2}>
        <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700">
          {t('title')}
        </Heading>
        {historyItems.length > 0 && (
          <Button size="sm" variant="link" colorScheme="blue" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? t('hideHistory') : t('showHistory', { count: historyItems.length })}
          </Button>
        )}
      </Flex>
      <Text fontSize="sm" color="gray.500" mb={4}>
        {t('subtitle')}
      </Text>

      {/* Add form */}
      <Card mb={4}>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3} alignItems="end">
            <FormControl isInvalid={!!formError && !name.trim()}>
              <FormLabel fontSize="sm" mb={1}>
                {t('itemName')}
              </FormLabel>
              <Input
                value={name}
                maxLength={100}
                placeholder={t('itemNamePlaceholder')}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError('');
                }}
              />
            </FormControl>
            <FormControl isInvalid={!!formError && !!name.trim()}>
              <FormLabel fontSize="sm" mb={1}>
                {t('price')}
              </FormLabel>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setFormError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                {t('categoryOptional')}
              </FormLabel>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                placeholder={t('noCategory')}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            <Button
              colorScheme="blue"
              onClick={handleAdd}
              isLoading={isSaving}
              minH={{ base: '44px', md: '40px' }}
            >
              {t('addItem')}
            </Button>
          </SimpleGrid>
          {formError && (
            <FormControl isInvalid mt={2}>
              <FormErrorMessage mt={0}>{formError}</FormErrorMessage>
            </FormControl>
          )}
        </CardBody>
      </Card>

      {/* List states */}
      {isLoading && !data && <Skeleton height="96px" borderRadius="md" data-testid="wishlist-skeleton" />}

      {!isLoading && error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {t('loadFailed')}
        </Alert>
      )}

      {!error && data && activeItems.length === 0 && !showHistory && (
        <Card>
          <CardBody>
            <Text color="gray.500" fontSize="sm" textAlign="center" py={2}>
              {t('emptyState')}
            </Text>
          </CardBody>
        </Card>
      )}

      {!error && activeItems.length > 0 && (
        <Card>
          <CardBody p={0}>
            {activeItems.map((item) => (
              <WishlistItem
                key={item.id}
                item={item}
                currencyCode={currencyCode}
                isUpdating={updatingId === item.id}
                onStatusChange={handleStatusChange}
              />
            ))}
          </CardBody>
        </Card>
      )}

      {showHistory && historyItems.length > 0 && (
        <Card mt={4}>
          <CardBody p={0}>
            {historyItems.map((item) => (
              <WishlistItem
                key={item.id}
                item={item}
                currencyCode={currencyCode}
                isUpdating={updatingId === item.id}
                onStatusChange={handleStatusChange}
              />
            ))}
          </CardBody>
        </Card>
      )}
    </Box>
  );
}
