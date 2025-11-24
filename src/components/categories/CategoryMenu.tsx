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
    <Menu>
      <MenuButton
        as={Button}
        rightIcon={<ChevronDownIcon />}
        size={size}
        w="full"
        textAlign="left"
        fontWeight="normal"
        isDisabled={isDisabled}
        borderColor={isInvalid ? 'red.500' : 'gray.200'}
        borderWidth="1px"
        _hover={{
          borderColor: isInvalid ? 'red.500' : '#2b6cb0',
        }}
        _focus={{
          borderColor: '#2b6cb0',
          boxShadow: '0 0 0 1px #2b6cb0',
        }}
        bg="white"
      >
        {selectedCategory ? (
          <CategoryBadge category={selectedCategory} variant="dot" size="sm" />
        ) : (
          <Text color="gray.500">{placeholder}</Text>
        )}
      </MenuButton>

      <MenuList maxH="400px" overflowY="auto" zIndex={10}>
        {/* Recently-Used Categories Section */}
        {hasRecentCategories && (
          <>
            <MenuGroup title="Recently Used" fontSize="xs" color="gray.600">
              {recentCategories.map((category) => (
                <MenuItem
                  key={category.id}
                  onClick={() => onChange(category.id)}
                  _hover={{ bg: 'blue.50' }}
                  _focus={{ bg: 'blue.100' }}
                  bg={value === category.id ? 'blue.50' : 'transparent'}
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
          title={hasRecentCategories ? 'All Categories' : 'Categories'}
          fontSize="xs"
          color="gray.600"
        >
          {sortedCategories.map((category) => (
            <MenuItem
              key={category.id}
              onClick={() => onChange(category.id)}
              _hover={{ bg: 'blue.50' }}
              _focus={{ bg: 'blue.100' }}
              bg={value === category.id ? 'blue.50' : 'transparent'}
              minH="44px" // Touch-friendly height
            >
              <CategoryBadge category={category} variant="dot" size="sm" />
            </MenuItem>
          ))}
        </MenuGroup>

        {/* Empty State */}
        {categories.length === 0 && (
          <Box p={4} textAlign="center">
            <Text fontSize="sm" color="gray.500">
              No categories available
            </Text>
          </Box>
        )}
      </MenuList>
    </Menu>
  );
}
