'use client';

/**
 * CategoryBadge Component
 * Story 4.4: Category Color-Coding and Visual Display
 *
 * Reusable component for displaying categories with color coding throughout the app.
 * Supports multiple variants for different use cases:
 * - 'dot': Color circle + category name (for dropdowns, transaction lists)
 * - 'badge': Colored background badge (for category management page)
 * - 'border': Left border accent (alternative styling)
 *
 * Features:
 * - WCAG AA compliant contrast (3:1 minimum)
 * - Mobile responsive (minimum 8px color indicators)
 * - Consistent visual treatment across all components
 * - TypeScript strict mode compatible
 *
 * Usage:
 * <CategoryBadge category={category} variant="dot" size="md" />
 */

import { Box, HStack, Text, Badge } from '@chakra-ui/react';

export type CategoryBadgeVariant = 'dot' | 'badge' | 'border';
export type CategoryBadgeSize = 'sm' | 'md' | 'lg';

interface Category {
  id: string;
  name: string;
  color: string; // Hex format: #RRGGBB
  type: 'income' | 'expense';
}

interface CategoryBadgeProps {
  category: Category;
  variant?: CategoryBadgeVariant;
  size?: CategoryBadgeSize;
  showType?: boolean; // Optional: display category type
}

/**
 * Calculate text color for badge variant based on background color
 * Ensures WCAG AA contrast compliance (3:1 minimum)
 */
function getContrastTextColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance (simplified formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, dark gray for light backgrounds
  return luminance > 0.5 ? '#2D3748' : '#FFFFFF';
}

/**
 * Get size dimensions based on variant and size prop
 */
function getDotDimensions(size: CategoryBadgeSize) {
  const sizes = {
    sm: { dotSize: 2, fontSize: 'xs' as const }, // 8px dot
    md: { dotSize: 3, fontSize: 'sm' as const }, // 12px dot
    lg: { dotSize: 4, fontSize: 'md' as const }, // 16px dot
  };
  return sizes[size];
}

function getBadgeDimensions(size: CategoryBadgeSize) {
  const sizes = {
    sm: { fontSize: 'xs' as const, px: 2, py: 0.5 },
    md: { fontSize: 'sm' as const, px: 3, py: 1 },
    lg: { fontSize: 'md' as const, px: 4, py: 1.5 },
  };
  return sizes[size];
}

function getBorderDimensions(size: CategoryBadgeSize) {
  const sizes = {
    sm: { borderWidth: '3px', fontSize: 'xs' as const, px: 2, py: 1 },
    md: { borderWidth: '4px', fontSize: 'sm' as const, px: 3, py: 1.5 },
    lg: { borderWidth: '5px', fontSize: 'md' as const, px: 4, py: 2 },
  };
  return sizes[size];
}

export function CategoryBadge({
  category,
  variant = 'dot',
  size = 'md',
  showType = false,
}: CategoryBadgeProps) {
  // Variant: Dot (color circle + name)
  if (variant === 'dot') {
    const dimensions = getDotDimensions(size);

    return (
      <HStack spacing={2} align="center">
        <Box
          w={dimensions.dotSize}
          h={dimensions.dotSize}
          borderRadius="full"
          bg={category.color}
          flexShrink={0}
          // Add border for better visibility of light colors
          border="1px solid"
          borderColor="gray.200"
          aria-label={`${category.name} color indicator`}
        />
        <Text fontSize={dimensions.fontSize} fontWeight="normal" lineHeight="short">
          {category.name}
        </Text>
        {showType && (
          <Text
            fontSize="xs"
            color="gray.500"
            fontStyle="italic"
          >
            ({category.type})
          </Text>
        )}
      </HStack>
    );
  }

  // Variant: Badge (colored background)
  if (variant === 'badge') {
    const dimensions = getBadgeDimensions(size);
    const textColor = getContrastTextColor(category.color);

    return (
      <Badge
        bg={category.color}
        color={textColor}
        fontSize={dimensions.fontSize}
        px={dimensions.px}
        py={dimensions.py}
        borderRadius="md"
        fontWeight="medium"
        // Add border for light colors to improve contrast
        border="1px solid"
        borderColor="gray.200"
      >
        {category.name}
        {showType && ` (${category.type})`}
      </Badge>
    );
  }

  // Variant: Border (left border accent)
  if (variant === 'border') {
    const dimensions = getBorderDimensions(size);

    return (
      <Box
        borderLeft={dimensions.borderWidth}
        borderColor={category.color}
        pl={dimensions.px}
        py={dimensions.py}
      >
        <Text fontSize={dimensions.fontSize} fontWeight="medium">
          {category.name}
        </Text>
        {showType && (
          <Text fontSize="xs" color="gray.600" mt={0.5}>
            {category.type}
          </Text>
        )}
      </Box>
    );
  }

  return null;
}
