'use client';

/**
 * ValuesPlanSection — Story 14.1: Values-Based Spending Plan
 *
 * Settings section for a personal values-based spending plan: a priority-ordered list
 * of values, each with assigned budget categories. Create / rename / reorder / reassign
 * categories / delete. Purely personal (owner-only API).
 */

import { useState } from 'react';
import {
  Card,
  CardBody,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Button,
  IconButton,
  Badge,
  Wrap,
  WrapItem,
  Tag,
  TagLabel,
  TagCloseButton,
  Box,
  Divider,
  Spinner,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useToast,
} from '@chakra-ui/react';
import { ChevronUpIcon, ChevronDownIcon, AddIcon, CheckIcon, CloseIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { useValues } from '@/lib/hooks/useValues';
import type { ValueWithCategories } from '@/types/database.types';
import type { Category } from '@/types/category.types';

const categoriesFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
};

export function ValuesPlanSection() {
  const t = useTranslations('values');
  const toast = useToast();
  const { values, isLoading, mutate } = useValues();
  const { data: categoriesData } = useSWR('/api/categories', categoriesFetcher);
  const categories: Category[] = categoriesData?.data ?? [];
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fail = (msg?: string) =>
    toast({ title: msg || t('saveFailed'), status: 'error', duration: 5000, isClosable: true });
  const ok = (msg: string) => toast({ title: msg, status: 'success', duration: 2500, isClosable: true });

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setIsAdding(true);
    try {
      const res = await fetch('/api/values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(res.status === 409 ? t('duplicateName') : json?.error?.message);
      setNewName('');
      await mutate();
      ok(t('created'));
    } catch (e) {
      fail(e instanceof Error ? e.message : undefined);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/values/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(res.status === 409 ? t('duplicateName') : json?.error?.message);
      await mutate();
      ok(t('updated'));
    } catch (e) {
      fail(e instanceof Error ? e.message : undefined);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/values/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await mutate();
      ok(t('deleted'));
    } catch {
      fail();
    }
  };

  const handleReorder = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= values.length) return;
    const orderedIds = values.map((v) => v.id);
    const a = orderedIds[index];
    const b = orderedIds[target];
    if (a === undefined || b === undefined) return;
    orderedIds[index] = b;
    orderedIds[target] = a;
    // Optimistic
    const byId = new Map(values.map((v) => [v.id, v]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter((v): v is ValueWithCategories => v !== undefined);
    await mutate({ data: reordered }, false);
    try {
      const res = await fetch('/api/values/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) throw new Error();
      await mutate();
    } catch {
      await mutate();
      fail();
    }
  };

  const handleSetCategories = async (id: string, categoryIds: string[]) => {
    try {
      const res = await fetch(`/api/values/${id}/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryIds }),
      });
      if (!res.ok) throw new Error();
      await mutate();
    } catch {
      fail();
    }
  };

  return (
    <Card>
      <CardBody>
        <VStack spacing={6} align="stretch">
          <Box>
            <Heading as="h2" size="md" color="gray.700">
              {t('heading')}
            </Heading>
            <Text fontSize="sm" color="gray.600" mt={1}>
              {t('subtitle')}
            </Text>
          </Box>

          {/* Add value */}
          <HStack>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder={t('namePlaceholder')}
              maxLength={50}
            />
            <Button
              leftIcon={<AddIcon />}
              colorScheme="blue"
              onClick={handleAdd}
              isLoading={isAdding}
              isDisabled={!newName.trim()}
              flexShrink={0}
            >
              {t('addValue')}
            </Button>
          </HStack>

          <Divider />

          {isLoading ? (
            <HStack justify="center" py={4}>
              <Spinner size="sm" />
              <Text color="gray.500">{t('loading')}</Text>
            </HStack>
          ) : values.length === 0 ? (
            <Text color="gray.500" fontSize="sm" textAlign="center" py={4}>
              {t('empty')}
            </Text>
          ) : (
            <VStack spacing={4} align="stretch">
              {values.map((value, index) => (
                <ValueRow
                  key={value.id}
                  value={value}
                  index={index}
                  total={values.length}
                  categories={categories}
                  categoryById={categoryById}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onReorder={handleReorder}
                  onSetCategories={handleSetCategories}
                />
              ))}
            </VStack>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}

interface ValueRowProps {
  value: ValueWithCategories;
  index: number;
  total: number;
  categories: Category[];
  categoryById: Map<string, Category>;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReorder: (index: number, direction: -1 | 1) => void;
  onSetCategories: (id: string, categoryIds: string[]) => void;
}

function ValueRow({
  value,
  index,
  total,
  categories,
  categoryById,
  onRename,
  onDelete,
  onReorder,
  onSetCategories,
}: ValueRowProps) {
  const t = useTranslations('values');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(value.name);

  const assigned = new Set(value.category_ids);
  const unassigned = categories.filter((c) => !assigned.has(c.id));

  const removeCategory = (categoryId: string) =>
    onSetCategories(value.id, value.category_ids.filter((id) => id !== categoryId));
  const addCategory = (categoryId: string) =>
    onSetCategories(value.id, [...value.category_ids, categoryId]);

  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" p={4}>
      <HStack justify="space-between" align="flex-start">
        <HStack flex={1} minW={0}>
          <Badge colorScheme="blue" borderRadius="full" px={2}>
            #{index + 1}
          </Badge>
          {isEditing ? (
            <HStack flex={1}>
              <Input
                size="sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
                autoFocus
              />
              <IconButton
                aria-label={t('save')}
                icon={<CheckIcon />}
                size="sm"
                colorScheme="green"
                onClick={() => {
                  if (editName.trim() && editName.trim() !== value.name) onRename(value.id, editName.trim());
                  setIsEditing(false);
                }}
              />
              <IconButton
                aria-label={t('cancel')}
                icon={<CloseIcon />}
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditName(value.name);
                  setIsEditing(false);
                }}
              />
            </HStack>
          ) : (
            <Text fontWeight="semibold" color="gray.800" noOfLines={1}>
              {value.name}
            </Text>
          )}
        </HStack>

        {!isEditing && (
          <HStack spacing={1} flexShrink={0}>
            <IconButton
              aria-label={t('moveUp')}
              icon={<ChevronUpIcon />}
              size="sm"
              variant="ghost"
              isDisabled={index === 0}
              onClick={() => onReorder(index, -1)}
            />
            <IconButton
              aria-label={t('moveDown')}
              icon={<ChevronDownIcon />}
              size="sm"
              variant="ghost"
              isDisabled={index === total - 1}
              onClick={() => onReorder(index, 1)}
            />
            <IconButton
              aria-label={t('edit')}
              icon={<EditIcon />}
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditName(value.name);
                setIsEditing(true);
              }}
            />
            <IconButton
              aria-label={t('delete')}
              icon={<DeleteIcon />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={() => onDelete(value.id)}
            />
          </HStack>
        )}
      </HStack>

      {/* Assigned categories */}
      <Box mt={3}>
        <Text fontSize="xs" color="gray.500" mb={2}>
          {t('assignCategories')}
        </Text>
        <Wrap spacing={2}>
          {value.category_ids.map((categoryId) => {
            const cat = categoryById.get(categoryId);
            return (
              <WrapItem key={categoryId}>
                <Tag borderRadius="full" variant="subtle" colorScheme="gray">
                  {cat && <Box w={2} h={2} borderRadius="full" bg={cat.color} mr={2} />}
                  <TagLabel>{cat?.name ?? '—'}</TagLabel>
                  <TagCloseButton onClick={() => removeCategory(categoryId)} />
                </Tag>
              </WrapItem>
            );
          })}
          <WrapItem>
            <Menu>
              <MenuButton
                as={Button}
                size="xs"
                variant="outline"
                leftIcon={<AddIcon />}
                isDisabled={unassigned.length === 0}
              >
                {value.category_ids.length === 0 ? t('assignFirst') : t('addCategory')}
              </MenuButton>
              <MenuList maxH="240px" overflowY="auto">
                {unassigned.map((cat) => (
                  <MenuItem key={cat.id} onClick={() => addCategory(cat.id)}>
                    <Box w={2.5} h={2.5} borderRadius="full" bg={cat.color} mr={2} />
                    {cat.name}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          </WrapItem>
        </Wrap>
        {value.category_ids.length === 0 && (
          <Text fontSize="xs" color="gray.400" mt={2}>
            {t('none')}
          </Text>
        )}
      </Box>
    </Box>
  );
}
