'use client';

/**
 * CategoryMenu Component
 * Story 4.4: Category Color-Coding and Visual Display
 *
 * Custom dropdown menu for category selection with color indicators.
 * Replaces native HTML Select to show color dots before each category name.
 *
 * Features:
 * - Color dots (8px) before each category name
 * - Recently-used categories group at top (if provided)
 * - Alphabetically sorted categories
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Mobile responsive with proper touch targets
 * - Integrates with CategoryBadge component for consistency
 *
 * Usage:
 * <CategoryMenu
 *   categories={categories}
 *   value={selectedCategoryId}
 *   onChange={(id) => setValue('category_id', id)}
 *   placeholder="Select a category"
 *   isInvalid={!!errors.category_id}
 * />
 */

import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  MenuGroup,
  Button,
  Text,
  Box,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
import { CategoryBadge } from './CategoryBadge';

interface Category {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
}

interface CategoryMenuProps {
  categories: Category[];
  value?: string; // Selected category ID
  onChange: (categoryId: string) => void;
  placeholder?: string;
  isInvalid?: boolean;
  size?: 'sm' | 'md' | 'lg';
  recentCategories?: Category[]; // Optional: recently-used categories to show first
  isDisabled?: boolean;
}

export function CategoryMenu({
  categories,
  value,
  onChange,
  placeholder = 'Select a category',
  isInvalid = false,
  size = 'lg',
  recentCategories = [],
  isDisabled = false,
}: CategoryMenuProps) {
  const t = useTranslations('categories');

  // Find selected category
  const selectedCategory = categories.find((cat) => cat.id === value);

  // Filter out recent categories from all categories to avoid duplicates
  const recentCategoryIds = new Set(recentCategories.map((cat) => cat.id));
  const remainingCategories = categories.filter((cat) => !recentCategoryIds.has(cat.id));

  // Sort remaining categories alphabetically
  const sortedCategories = [...remainingCategories].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const hasRecentCategories = recentCategories.length > 0;

  return (
    <Menu matchWidth>
      <MenuButton
        as={Button}
        rightIcon={<ChevronDownIcon />}
        size={size}
        w="full"
        textAlign="left"
        fontWeight="normal"
        isDisabled={isDisabled}
        borderColor={isInvalid ? 'expense' : 'border'}
        borderWidth="1px"
        borderRadius="lg"
        _hover={{
          borderColor: isInvalid ? 'expense' : 'accent',
        }}
        _focus={{
          borderColor: 'accent',
          boxShadow: '0 0 0 1px var(--chakra-colors-accent)',
        }}
        bg="surface"
      >
        {selectedCategory ? (
          <CategoryBadge category={selectedCategory} variant="dot" size="sm" />
        ) : (
          <Text color="fg.subtle">{placeholder}</Text>
        )}
      </MenuButton>

      <MenuList maxH="300px" overflowY="auto" overscrollBehavior="contain" zIndex={10}>
        {/* Recently-Used Categories Section */}
        {hasRecentCategories && (
          <>
            <MenuGroup title={t('recentlyUsed')} fontSize="xs" color="fg.muted">
              {recentCategories.map((category) => (
                <MenuItem
                  key={category.id}
                  onClick={() => onChange(category.id)}
                  _hover={{ bg: 'accent.subtle' }}
                  _focus={{ bg: 'evergreen.100' }}
                  bg={value === category.id ? 'accent.subtle' : 'transparent'}
                  minH="44px" // Touch-friendly height (WCAG AAA)
                >
                  <CategoryBadge category={category} variant="dot" size="sm" />
                </MenuItem>
              ))}
            </MenuGroup>
            <MenuDivider />
          </>
        )}

        {/* All Categories Section */}
        <MenuGroup
          title={hasRecentCategories ? t('allCategories') : t('categories')}
          fontSize="xs"
          color="fg.muted"
        >
          {sortedCategories.map((category) => (
            <MenuItem
              key={category.id}
              onClick={() => onChange(category.id)}
              _hover={{ bg: 'accent.subtle' }}
              _focus={{ bg: 'evergreen.100' }}
              bg={value === category.id ? 'accent.subtle' : 'transparent'}
              minH="44px" // Touch-friendly height
            >
              <CategoryBadge category={category} variant="dot" size="sm" />
            </MenuItem>
          ))}
        </MenuGroup>

        {/* Empty State */}
        {categories.length === 0 && (
          <Box p={4} textAlign="center">
            <Text fontSize="sm" color="fg.subtle">
              {t('noCategoriesAvailable')}
            </Text>
          </Box>
        )}
      </MenuList>
    </Menu>
  );
}
