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

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { toLocalISODate } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import { fingerprintFor, toUpsertRow } from '@/lib/ai/insightFingerprint';
import { DEFAULT_CURRENCY } from '@/lib/utils/constants';
import {
  detectSpendingIncrease,
  recommendBudgetLimit,
  flagUnusualExpense,
  generatePositiveReinforcement,
} from '@/lib/ai/insightRules';
import {
  detectSpendingAnomalies,
  detectNewHighSpendCategories,
} from '@/lib/ai/patternDetection';
import type { Insight, InsightInsert } from '@/types/database.types';

/**
 * When insight generation last RAN for this user, or null if it never has.
 *
 * hp-8. This was a module-level `Map`. On a serverless cold start the Map is
 * empty, so every user looked "never generated", the 10-transaction gate was
 * skipped, and insights regenerated on essentially every transaction POST. The
 * defect was three states — not loaded / never / generated-at-T — squeezed into
 * two, with the missing one collapsing into the expensive answer.
 *
 * It is read from `user_profiles.insights_last_generated_at` rather than derived
 * from the insight rows. See the migration for the full reasoning; briefly:
 * MAX(created_at) is correct only while generation deletes and reinserts every
 * row, which hp-10 is about to stop doing, and no row-derived value can
 * represent a run that produced ZERO insights — a case this service explicitly
 * supports.
 *
 * Errors are NOT swallowed into a boolean. Per the degradation policy a failed
 * core input is a 500, because answering "never generated" on a read failure
 * would regenerate for every user on every write.
 */
async function readLastGeneratedAt(userId: string): Promise<Date | null> {
  // Cast for the same reason as achievementService/comebackService: the typed
  // `Database` is GENERATED from the live schema, and this column arrives with
  // the hp-8 migration, so it is absent from the checked-in types until they are
  // regenerated. The cast is scoped to this one access, not the whole module.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from('user_profiles')
    .select('insights_last_generated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    // DEPLOY-WINDOW ESCAPE HATCH, and deliberately the only one.
    //
    // The migration adding this column applies when main merges; Vercel deploys
    // on the same merge. The order is not guaranteed, so there is a window where
    // this code runs against a schema without the column. Postgres reports that
    // as 42703 (undefined_column).
    //
    // Throwing there would 500 `/api/insights/generate` and the cron for the
    // length of that window. Degrading to "never generated" is exactly the
    // PRE-hp-8 behaviour — an extra generation, no worse than yesterday — and it
    // self-heals the moment the column exists.
    //
    // Scoped to that ONE error code on purpose. Every other failure still
    // throws, per the degradation policy: answering "never generated" on a
    // connection error would regenerate for every user on every write, which is
    // the bug this story exists to remove.
    if ((error as { code?: string }).code === '42703') {
      logger.error(
        'Insight Service',
        'insights_last_generated_at is missing — migration not applied yet. ' +
          'Falling back to pre-hp-8 behaviour until it lands.',
        error
      );
      return null;
    }
    throw error;
  }

  const raw = (data as { insights_last_generated_at?: string | null } | null)
    ?.insights_last_generated_at;
  return raw ? new Date(raw) : null;
}

/**
 * Record that generation RAN, whatever it produced.
 *
 * Service-role, because the column is not writable by the user — it would
 * otherwise be forgeable through PostgREST, letting anyone suppress their own
 * insights indefinitely or force constant regeneration.
 *
 * Best-effort by design: a failure here must not fail a generation that already
 * succeeded. The cost of a missed marker is one extra generation; throwing would
 * surface a 500 for work that actually completed.
 */
export async function markGenerated(userId: string): Promise<void> {
  try {
    const adminClient = createServiceRoleClient() as unknown as SupabaseClient;
    const { error } = await adminClient
      .from('user_profiles')
      .update({ insights_last_generated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  } catch (markError) {
    logger.error(
      'Insight Service',
      `Failed to record generation marker for user ${userId}:`,
      markError
    );
  }
}

/**
 * Whether insights were generated within the TTL window.
 * @param cacheTTL - window in milliseconds (default: 1 hour)
 */
async function isCacheValid(userId: string, cacheTTL: number = 3600000): Promise<boolean> {
  const lastGenerated = await readLastGeneratedAt(userId);
  if (!lastGenerated) return false;

  return Date.now() - lastGenerated.getTime() < cacheTTL;
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
  if (!forceRegenerate && (await isCacheValid(userId))) {
    logger.info('Insight Service', `Using cached insights for user ${userId}`);

    // Return existing insights from database
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Insight Service', 'Error fetching cached insights:', error);
      // If cache fetch fails, fall through to regenerate
      logger.info('Insight Service', 'Cache fetch failed, regenerating insights');
    } else {
      return data || [];
    }
  }

  // Query user data
  const supabase = await createClient();
  const currentMonth = new Date();
  // START OF the month three back, not the same day three months back.
  //
  // `subMonths(2026-07-15, 3)` is 2026-04-15, so the oldest month arrived
  // half-missing. `recommendBudgetLimit` now averages the three COMPLETE months
  // before this one (D1), and a half-fetched April would understate that
  // average — the same defect in a different place.
  //
  // Knock-on, stated rather than hidden: `flagUnusualExpense` computes its mean
  // and standard deviation over this whole set with no date filter of its own,
  // so its sample also becomes month-aligned instead of ragged. That shifts its
  // outlier threshold slightly. It is a more defensible baseline than half a
  // month, but it IS a behaviour change to a rule D1 did not set out to touch.
  const threeMonthsAgo = startOfMonth(subMonths(currentMonth, 3));

  // Fetch transactions for the last 3 months (including current month)
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', toLocalISODate(threeMonthsAgo))
    .lte('date', toLocalISODate(endOfMonth(currentMonth)))
    .order('date', { ascending: false });

  if (txError) {
    logger.error('Insight Service', 'Error fetching transactions:', txError);
    throw new Error(`Failed to fetch transactions: ${txError.message}`);
  }

  // Fetch user categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId);

  if (catError) {
    logger.error('Insight Service', 'Error fetching categories:', catError);
    throw new Error(`Failed to fetch categories: ${catError.message}`);
  }

  // If no transactions or categories, return empty array
  if (!transactions || transactions.length === 0 || !categories || categories.length === 0) {
    logger.info('Insight Service', `No data to generate insights - Transactions: ${transactions?.length || 0}, Categories: ${categories?.length || 0}`);

    // Update cache even if no data
    await markGenerated(userId);

    return [];
  }

  // Resolve the user's display currency so all insight messages format amounts
  // with the right symbol (never hardcode — see ESLint no-restricted-syntax guard).
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle();
  const prefs = (profile?.preferences as Record<string, unknown> | null) ?? {};
  const currency = typeof prefs.currency_format === 'string' ? prefs.currency_format : DEFAULT_CURRENCY;

  // Budget table is not part of the current MVP scope.
  // Rules handle the absence of budgets gracefully by skipping budget-based insights.
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
      currency,
    });

    const budgetRecommendation = recommendBudgetLimit({
      userId,
      categoryId: category.id,
      categoryName: category.name,
      transactions: categoryTransactions,
      currentMonth,
      currentBudget,
      currency,
    });

    const unusualExpense = flagUnusualExpense({
      userId,
      categoryId: category.id,
      categoryName: category.name,
      transactions: categoryTransactions,
      currency,
    });

    const positiveReinforcement = generatePositiveReinforcement({
      userId,
      categoryId: category.id,
      categoryName: category.name,
      transactions: categoryTransactions,
      currentMonth,
      currentBudget,
      currency,
    });

    // Collect non-null insights
    if (spendingIncrease) allInsights.push(spendingIncrease);
    if (budgetRecommendation) allInsights.push(budgetRecommendation);
    if (unusualExpense) allInsights.push(unusualExpense);
    if (positiveReinforcement) allInsights.push(positiveReinforcement);
  }

  // Pattern detection (cross-category analysis requiring 2+ months of data)
  const anomalyInsights = detectSpendingAnomalies({
    userId,
    transactions: transactions ?? [],
    categories: categories ?? [],
    currentMonth,
    currency,
  });
  const newHighSpendInsights = detectNewHighSpendCategories({
    userId,
    transactions: transactions ?? [],
    categories: categories ?? [],
    currentMonth,
    currency,
  });
  allInsights.push(...anomalyInsights, ...newHighSpendInsights);

  // Sort by priority (5 = highest, 1 = lowest)
  allInsights.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  logger.info('Insight Service', `Generated ${allInsights.length} insights for user ${userId}`);

  // Use service role client for database mutations (bypasses RLS)
  const adminClient = createServiceRoleClient() as unknown as SupabaseClient;

  // THE SWEEP CUTOFF, TAKEN FROM THE DATABASE CLOCK — read BEFORE writing.
  //
  // The sweep must remove rows this run did not produce without touching rows it
  // just wrote, or rows a CONCURRENT run is writing (the cron at 00:00 on the
  // 1st and a transaction trigger seconds earlier compute different month
  // buckets). Every row written from here on gets `updated_at` from the same
  // Postgres clock, so anything at or before this high-water mark predates the
  // run and anything after it belongs to this run or a newer one.
  //
  // DELIBERATELY NOT `new Date()`. `updated_at` carries the DATABASE clock; if
  // the cutoff carried the app server's and that clock ran even milliseconds
  // ahead, rows this run just wrote would satisfy the predicate and the sweep
  // would delete the insights it had just created. The dashboard would empty,
  // the next run would refill it, and the symptom would be intermittent
  // disappearance reproducible on nobody's machine. Reading the high-water mark
  // from the rows themselves removes the skew rather than tolerating it.
  const { data: watermarkRow, error: watermarkError } = await adminClient
    .from('insights')
    .select('updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (watermarkError) {
    logger.error('Insight Service', 'Error reading sweep watermark:', watermarkError);
    throw new Error(`Failed to read sweep watermark: ${watermarkError.message}`);
  }
  const sweepCutoff =
    (watermarkRow as { updated_at?: string } | null)?.updated_at ?? null;

  // UPSERT on (user_id, fingerprint). Rows keep their identity, so a dismissal
  // survives; only the presentation fields are refreshed.
  const keptFingerprints: string[] = [];
  if (allInsights.length > 0) {
    const rows = allInsights
      .map((insight) => {
        const fingerprint = fingerprintFor(insight, currentMonth);
        if (!fingerprint) {
          // Should be unreachable: every type carries either a transaction_id or
          // a category_id. Logged at ERROR rather than dropped quietly, because
          // a silently discarded insight is the same "collapse an unknown into a
          // confident answer" failure this story exists to remove — and the
          // column is NOT NULL, so it cannot be written without one.
          logger.error(
            'Insight Service',
            `No fingerprint for a ${insight.type} insight; not written`,
            { userId, type: insight.type }
          );
          return null;
        }
        keptFingerprints.push(fingerprint);
        return toUpsertRow(insight, fingerprint);
      })
      .filter((row): row is Record<string, unknown> => row !== null);

    if (rows.length > 0) {
      const { error: upsertError } = await adminClient
        .from('insights')
        .upsert(rows, { onConflict: 'user_id,fingerprint' });

      if (upsertError) {
        logger.error('Insight Service', 'Error upserting insights:', upsertError);
        throw new Error(`Failed to upsert insights: ${upsertError.message}`);
      }
    }
  }

  // THE SWEEP. Delete-and-reinsert had exactly one virtue — it garbage-collected
  // — and UPSERT alone would leave a stale "groceries up 40%" card on the
  // dashboard in November. This restores expiry without restoring the bug.
  //
  // It runs only HERE, on the success path after every rule has completed.
  // "Successful" means the INPUTS LOADED, not that output was produced: both the
  // transaction and category fetches throw on error above, and the engines are
  // pure functions over that one array — so if the array loaded, every engine
  // ran. A run that produced ZERO insights is therefore a legitimate "nothing to
  // say", and emptying the dashboard is the correct result rather than a bug.
  if (sweepCutoff) {
    let sweep = adminClient
      .from('insights')
      .delete()
      .eq('user_id', userId)
      // WITHOUT THIS LINE hp-10 SHIPS THE ORIGINAL BUG ON A LONGER CYCLE. A
      // dismissed row the rule no longer produces would be deleted here, and the
      // run after that would recreate it undismissed. This single predicate is
      // what makes a dismissal permanent.
      .eq('is_dismissed', false)
      .lte('updated_at', sweepCutoff);

    if (keptFingerprints.length > 0) {
      sweep = sweep.not(
        'fingerprint',
        'in',
        `(${keptFingerprints.map((f) => `"${f}"`).join(',')})`
      );
    }

    const { error: sweepError } = await sweep;
    if (sweepError) {
      logger.error('Insight Service', 'Error sweeping stale insights:', sweepError);
      throw new Error(`Failed to sweep stale insights: ${sweepError.message}`);
    }
  }

  await markGenerated(userId);

  const { data: currentInsights } = await adminClient
    .from('insights')
    .select('*')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .order('priority', { ascending: false });

  logger.info(
    'Insight Service',
    `Upserted ${keptFingerprints.length} insights for user ${userId}`
  );

  // Re-read rather than returning the upsert payload: the caller wants the
  // stored rows (ids, created_at, and crucially is_dismissed as it now stands),
  // not the values this run proposed. The generic client loses the row type, so
  // narrow back to the declared return type here.
  return (currentInsights ?? []) as unknown as Insight[];
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
  const lastGenerated = await readLastGeneratedAt(userId);

  // NULL now genuinely means "never generated", because the marker is durable.
  // Generating once for such a user is the right answer — the bug was that a
  // cold start made EVERY user look like this one.
  if (!lastGenerated) return true;

  const supabase = await createClient();

  // Count transactions added since last generation
  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', lastGenerated.toISOString());

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
    if (await isCacheValid(userId)) {
      // Don't trigger if insights were generated less than 1 hour ago
      return;
    }

    // Check if transaction count threshold is met
    const shouldTrigger = await shouldTriggerGeneration(userId);

    if (shouldTrigger) {
      logger.info('Insight Service', `User ${userId}: 10+ transactions detected, generating insights`);

      // Trigger insight generation (non-blocking)
      generateInsights(userId, false).catch((error) => {
        logger.error('Insight Service', `Error generating insights for user ${userId}:`, error);
      });
    }
  } catch (error) {
    // Log error but don't throw - this is a background operation
    logger.error('Insight Service', `Error checking transaction count for user ${userId}:`, error);
  }
}

/**
 * Test seam for `markGenerated`.
 *
 * Exported under an explicit name so the hp-8 suite can pin the marker behaviour
 * under UPSERT semantics without reaching into module internals or standing up a
 * whole generation run. Production code calls `markGenerated`.
 */
export const markGeneratedForTest = markGenerated;
