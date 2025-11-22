/**
 * Category Type Definitions
 * Story 4.1: Seed Default Categories on User Signup
 *
 * Type definitions for category management system including:
 * - Category entity types
 * - Seed operation types
 * - Input/output types for category APIs
 */

/**
 * Transaction type enum
 */
export type TransactionType = 'income' | 'expense';

/**
 * Category entity from database
 *
 * Represents a transaction category with visual identification (color) and metadata.
 * Categories can be predefined (seeded on signup) or custom (user-created).
 */
export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string; // Hex format: #RRGGBB
  type: TransactionType;
  is_predefined: boolean;
  created_at: string;
}

/**
 * Input for seeding a single category
 *
 * Used by SeedCategoriesService to create predefined categories.
 * Does not include user_id or is_predefined (set by service).
 */
export interface SeedCategoryInput {
  name: string;
  color: string; // Hex format: #RRGGBB
  type: TransactionType;
}

/**
 * Result of category seeding operation
 *
 * Returned by seedDefaultCategories service function.
 * Contains success status, count of seeded categories, and optional category data.
 */
export interface SeedResult {
  success: boolean;
  count: number;
  categories?: Category[];
}

/**
 * Input for creating a new custom category
 *
 * Used by POST /api/categories endpoint for user-created categories.
 */
export interface CreateCategoryInput {
  name: string;
  color: string; // Hex format: #RRGGBB
  type: TransactionType;
}

/**
 * Input for updating an existing category
 *
 * Used by PUT /api/categories/:id endpoint.
 * All fields optional for partial updates.
 * Only applies to custom categories (is_predefined=false).
 */
export interface UpdateCategoryInput {
  name?: string;
  color?: string; // Hex format: #RRGGBB
}

/**
 * Category with usage statistics
 *
 * Extended category type including transaction usage data.
 * Used by GET /api/categories to provide recently-used sorting.
 */
export interface CategoryWithUsage extends Category {
  last_used_at?: string | null; // ISO timestamp from most recent transaction
  usage_count?: number; // Total transaction count for this category
}
