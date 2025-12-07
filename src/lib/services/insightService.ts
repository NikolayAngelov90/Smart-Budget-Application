/**
 * Insight Orchestration Service
 *
 * This service orchestrates the generation of AI-powered budget insights by:
 * 1. Querying user transactions and categories
 * 2. Executing all insight rules for each category
 * 3. Filtering, deduplicating, and sorting insights
 * 4. Persisting insights to the database
 * 5. Managing cache to avoid redundant generation
 */

import { createClient } from '@/lib/supabase/server';
import { endOfMonth, subMonths } from 'date-fns';
import {
  detectSpendingIncrease,
  recommendBudgetLimit,
  flagUnusualExpense,
  generatePositiveReinforcement,
} from '@/lib/ai/insightRules';
import type { Insight, InsightInsert } from '@/types/database.types';

/**
 * Cache entry structure for tracking last generation timestamp
 */
interface CacheEntry {
  userId: string;
  lastGenerated: Date;
}

// Simple in-memory cache (in production, use Redis)
const generationCache = new Map<string, CacheEntry>();

/**
 * Check if insights were recently generated for a user
 * @param userId - User ID to check
 * @param cacheTTL - Cache time-to-live in milliseconds (default: 1 hour)
 */
function isCacheValid(userId: string, cacheTTL: number = 3600000): boolean {
  const entry = generationCache.get(userId);
  if (!entry) return false;

  const now = new Date();
  const elapsed = now.getTime() - entry.lastGenerated.getTime();
  return elapsed < cacheTTL;
}

/**
 * Update cache with new generation timestamp
 */
function updateCache(userId: string): void {
  generationCache.set(userId, {
    userId,
    lastGenerated: new Date(),
  });
}

/**
 * Main insight generation function
 *
 * Generates AI-powered budget insights for a user by analyzing their
 * transactions and applying rule-based logic. Supports caching to avoid
 * redundant generation within 1 hour.
 *
 * @param userId - User ID to generate insights for
 * @param forceRegenerate - If true, bypasses cache and regenerates insights
 * @returns Array of generated insights
 */
export async function generateInsights(
  userId: string,
  forceRegenerate: boolean = false
): Promise<Insight[]> {
  // Check cache unless forcing regeneration
  if (!forceRegenerate && isCacheValid(userId)) {
    // Return existing insights from database
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Query user data
  const supabase = await createClient();
  const currentMonth = new Date();
  const threeMonthsAgo = subMonths(currentMonth, 3);

  // Fetch transactions for the last 3 months (including current month)
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', threeMonthsAgo.toISOString().split('T')[0])
    .lte('date', endOfMonth(currentMonth).toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (txError) throw txError;

  // Fetch user categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId);

  if (catError) throw catError;

  // If no transactions or categories, return empty array
  if (!transactions || transactions.length === 0 || !categories || categories.length === 0) {
    return [];
  }

  // TODO: Fetch existing budgets when budget table is implemented
  // For now, use undefined budget (rules will handle gracefully)
  const budgetMap = new Map<string, number>();

  // Generate insights for each category
  const allInsights: InsightInsert[] = [];

  for (const category of categories) {
    // Filter transactions for this category
    const categoryTransactions = transactions.filter((t) => t.category_id === category.id);

    // Skip if no transactions for this category
    if (categoryTransactions.length === 0) continue;

    // Execute all 4 rule functions
    const currentBudget = budgetMap.get(category.id);

    const spendingIncrease = detectSpendingIncrease({
      userId,
      categoryId: category.id,
      categoryName: category.name,
      transactions: categoryTransactions,
      currentMonth,
    });

    const budgetRecommendation = recommendBudgetLimit({
      userId,
      categoryId: category.id,
      categoryName: category.name,
      transactions: categoryTransactions,
      currentMonth,
      currentBudget,
    });

    const unusualExpense = flagUnusualExpense({
      userId,
      categoryId: category.id,
      categoryName: category.name,
      transactions: categoryTransactions,
    });

    const positiveReinforcement = generatePositiveReinforcement({
      userId,
      categoryId: category.id,
      categoryName: category.name,
      transactions: categoryTransactions,
      currentMonth,
      currentBudget,
    });

    // Collect non-null insights
    if (spendingIncrease) allInsights.push(spendingIncrease);
    if (budgetRecommendation) allInsights.push(budgetRecommendation);
    if (unusualExpense) allInsights.push(unusualExpense);
    if (positiveReinforcement) allInsights.push(positiveReinforcement);
  }

  // Sort by priority (5 = highest, 1 = lowest)
  allInsights.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Delete old insights for this user (to avoid accumulation)
  const { error: deleteError } = await supabase
    .from('insights')
    .delete()
    .eq('user_id', userId);

  if (deleteError) throw deleteError;

  // Insert new insights into database
  if (allInsights.length > 0) {
    const { data: insertedInsights, error: insertError } = await supabase
      .from('insights')
      .insert(allInsights)
      .select();

    if (insertError) throw insertError;

    // Update cache
    updateCache(userId);

    return insertedInsights || [];
  }

  // Update cache even if no insights generated
  updateCache(userId);

  return [];
}

/**
 * Check if insight generation should be triggered based on transaction count
 *
 * According to AC #5, insights should be regenerated when user adds 10+ transactions
 * since last generation.
 *
 * @param userId - User ID to check
 * @returns True if generation should be triggered
 */
export async function shouldTriggerGeneration(userId: string): Promise<boolean> {
  const entry = generationCache.get(userId);
  if (!entry) return true; // Never generated before

  const supabase = await createClient();

  // Count transactions added since last generation
  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', entry.lastGenerated.toISOString());

  if (error) throw error;

  return (count || 0) >= 10;
}

/**
 * Check transaction count and trigger insight generation if threshold reached
 *
 * Story 6.5: Insight Generation Scheduling and Manual Refresh
 * AC1: After user adds 10+ new transactions, insights should be auto-generated
 *
 * This function should be called asynchronously after transaction creation to avoid
 * blocking the transaction response. It checks if 10+ transactions have been added
 * since last insight generation and triggers generation if threshold is met.
 *
 * Rate limiting: Only triggers if at least 1 hour has passed since last generation
 *
 * @param userId - User ID to check and potentially trigger generation for
 */
export async function checkAndTriggerForTransactionCount(userId: string): Promise<void> {
  try {
    // Check if cache is still valid (1-hour TTL)
    if (isCacheValid(userId)) {
      // Don't trigger if insights were generated less than 1 hour ago
      return;
    }

    // Check if transaction count threshold is met
    const shouldTrigger = await shouldTriggerGeneration(userId);

    if (shouldTrigger) {
      console.log(`[Insight Trigger] User ${userId}: 10+ transactions detected, generating insights`);

      // Trigger insight generation (non-blocking)
      generateInsights(userId, false).catch((error) => {
        console.error(`[Insight Trigger] Error generating insights for user ${userId}:`, error);
      });
    }
  } catch (error) {
    // Log error but don't throw - this is a background operation
    console.error(`[Insight Trigger] Error checking transaction count for user ${userId}:`, error);
  }
}
