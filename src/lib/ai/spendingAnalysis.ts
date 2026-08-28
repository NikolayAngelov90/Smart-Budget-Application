/**
 * Spending Analysis Utilities
 *
 * Statistical functions for analyzing transaction patterns and spending behavior.
 * Used by the insights generation engine to detect anomalies and trends.
 */

/**
 * Analysis result interfaces
 */
export interface AnalysisResult {
  mean: number;
  stdDev: number;
  count: number;
}

export interface MonthlyComparison {
  current: number;
  previous: number;
  percentChange: number;
  absoluteChange: number;
}

/**
 * Calculate the arithmetic mean (average) of an array of numbers
 *
 * @param amounts - Array of numerical values
 * @returns The mean value, or 0 if array is empty
 *
 * @example
 * calculateMean([100, 200, 300]) // returns 200
 * calculateMean([]) // returns 0
 */
export function calculateMean(amounts: number[]): number {
  if (!amounts || amounts.length === 0) {
    return 0;
  }

  const sum = amounts.reduce((acc, amount) => acc + amount, 0);
  return sum / amounts.length;
}

/**
 * Fixed averaging window for budget baselines (nudges, forecasts, recovery,
 * what-if). Callers MUST use this constant for their history-fetch lookback
 * too, so the divisor and the query window can never drift apart.
 */
export const AVERAGE_WINDOW_MONTHS = 3;

/**
 * Fixed-window monthly average: total spend ÷ the WINDOW SIZE, not ÷ months
 * present (epic-14 retro decision, 2026-07-02). A single spike month inside a
 * 3-month window reads as spike/3 — not as the user's "usual" monthly spend,
 * which inflated nudge/forecast/simulator baselines.
 *
 * Defensive divisor: if a caller ever supplies MORE buckets than the window
 * (a wider fetch), we divide by the bucket count instead — a fixed ÷window
 * on an over-long input would EXCEED the true mean and reintroduce exactly
 * the inflation this helper exists to kill.
 *
 * Trade-off (accepted in the retro): users with fewer than `windowMonths` of
 * history get smaller baselines — which means nudges/at-risk flags fire
 * EARLIER for them, not later. Only a fully-empty input returns 0 and takes
 * the "no baseline → no signal" guard paths.
 *
 * @param monthTotals - Per-month spend totals for the months that HAD spend
 * @param windowMonths - Window size in months (default AVERAGE_WINDOW_MONTHS)
 */
export function fixedWindowMonthlyAverage(
  monthTotals: number[],
  windowMonths: number = AVERAGE_WINDOW_MONTHS
): number {
  if (!monthTotals || monthTotals.length === 0) {
    return 0;
  }
  if (!Number.isFinite(windowMonths) || windowMonths <= 0) {
    return 0;
  }

  const sum = monthTotals.reduce((acc, total) => acc + total, 0);
  return sum / Math.max(windowMonths, monthTotals.length);
}

/**
 * Calculate the standard deviation of an array of numbers
 *
 * Uses population standard deviation formula: sqrt(sum((x - mean)^2) / n)
 *
 * @param amounts - Array of numerical values
 * @param mean - Pre-calculated mean (optional, will calculate if not provided)
 * @returns The standard deviation, or 0 if array has fewer than 2 elements
 *
 * @example
 * calculateStdDev([100, 200, 300], 200) // returns ~81.65
 * calculateStdDev([100]) // returns 0
 */
export function calculateStdDev(amounts: number[], mean?: number): number {
  if (!amounts || amounts.length < 2) {
    return 0;
  }

  const calculatedMean = mean !== undefined ? mean : calculateMean(amounts);

  const squaredDifferences = amounts.map(amount =>
    Math.pow(amount - calculatedMean, 2)
  );

  const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / amounts.length;

  return Math.sqrt(variance);
}

/**
 * Calculate month-over-month percentage change
 *
 * Formula: ((current - previous) / previous) * 100
 *
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Percentage change, or 0 if previous value is 0 or invalid
 *
 * @example
 * calculateMonthOverMonth(480, 340) // returns ~41.18 (41.18% increase)
 * calculateMonthOverMonth(300, 400) // returns -25 (25% decrease)
 * calculateMonthOverMonth(100, 0) // returns 0 (handles divide by zero)
 */
export function calculateMonthOverMonth(current: number, previous: number): number {
  // Handle edge cases
  if (previous === 0 || !isFinite(previous) || !isFinite(current)) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

/**
 * Perform comprehensive spending analysis on a set of amounts
 *
 * @param amounts - Array of transaction amounts
 * @returns Analysis result with mean, standard deviation, and count
 */
export function analyzeSpending(amounts: number[]): AnalysisResult {
  const mean = calculateMean(amounts);
  const stdDev = calculateStdDev(amounts, mean);

  return {
    mean,
    stdDev,
    count: amounts.length,
  };
}

/**
 * Compare spending between two periods
 *
 * @param currentAmount - Total spending in current period
 * @param previousAmount - Total spending in previous period
 * @returns Comparison result with percentage and absolute changes
 */
export function compareMonthlySpending(
  currentAmount: number,
  previousAmount: number
): MonthlyComparison {
  return {
    current: currentAmount,
    previous: previousAmount,
    percentChange: calculateMonthOverMonth(currentAmount, previousAmount),
    absoluteChange: currentAmount - previousAmount,
  };
}

/**
 * Check if a value is an outlier based on standard deviations from mean
 *
 * TWO-SIDED BY DESIGN: this measures |value - mean|, so a value far BELOW the
 * mean is just as much an outlier as one far above. It answers "is this
 * unusual", never "is this large".
 *
 * Callers that only care about one direction MUST filter on the sign
 * themselves — comparing against `mean` before calling — and callers that phrase
 * results in words ("higher than typical") are exactly those callers. Getting
 * this wrong shipped a critical-priority insight that told users a below-average
 * expense was alarmingly high; see flagUnusualExpense in insightRules.ts.
 *
 * KNOWN LIMITATION - MASKING. `mean` and `stdDev` are both computed over a set
 * that CONTAINS the outliers, so a large value inflates the bar it is then
 * measured against. Two equal large values in a set of ten are mathematically
 * unreportable: with a fraction p of the sample at value b, `mean + 2s` equals b
 * exactly when p = 0.2, and the comparison is strict `>`. Measured, not
 * theorised - eight EUR 30 charges plus two EUR 700 charges emit nothing, at
 * every magnitude tested up to EUR 5000. The asymmetric case is commoner:
 * 8x EUR 30 plus EUR 700 and EUR 400 reports only the EUR 700, because the
 * EUR 700 alone puts the bar at EUR 571.
 *
 * REAL OCCURRENCE (measured in production 2026-08-28). A EUR 213.00 Shopping
 * charge dated 2026-06-01, against a category median of EUR 30 - seven times the
 * median - was not reported, because a EUR 700 charge in the same window had
 * raised the bar to EUR 461.94. After hp-10 this compounds: dismiss the visible
 * EUR 700 and the category goes silent, masked EUR 213 included.
 *
 * WHY THE RULE IS STILL THIS ONE. Three alternatives were measured over the same
 * eight categories (every category with >= 10 expense transactions in the fetch
 * window, across all production accounts):
 *   - modified Z-score at 3.5: caught the EUR 213, dropped two legitimate flags.
 *   - modified Z-score at 2.0: caught six more, dropped one.
 *   - iterative trimmed sigma at the SAME 2s, minimum remainder 8: caught the
 *     EUR 213, but cascaded. Each pass removes the largest values, which are
 *     sigma's largest contributors, so the bar walks down until it reaches the
 *     dense core rather than converging on the outliers. Healthcare (n=11) went
 *     from 1 flag to 3, the third being EUR 48 against a EUR 29 median; one
 *     account went from 6 flags to 13, on a rule that emits at priority 5.
 * The first two move threshold AND estimator at once, and the spread across
 * thresholds (6 -> 12 flags) shows the THRESHOLD dominates the outcome - which
 * cannot be chosen from this data. The third holds the threshold fixed and fails
 * on its own terms.
 *
 * WHEN TO REVISIT - A TRIGGER, NOT AN INTENTION. Nothing measured here can
 * settle this: the sample is effectively one real account (the other is QA
 * fixtures), so one masking instance is not a frequency. "Revisit someday" decays
 * into never, so revisit when EITHER of these becomes true:
 *
 *   (1) several unrelated real accounts have a category with >= 10 expense
 *       transactions in the fetch window; or
 *   (2) roughly 50+ `unusual_expense` rows have accumulated across accounts,
 *       counting ONLY rows that survive the exclusion filter below -
 *       enough to compute a per-type DISMISSAL RATE, which is the only measure of
 *       flag quality that is not one person's judgement. A rule whose cards are
 *       dismissed at 90% is over-flagging whatever its statistics say.
 *
 * THE SECOND INSTRUMENT DID NOT EXIST BEFORE hp-10, WHICH IS WHY THIS QUESTION
 * WAS UNANSWERABLE RATHER THAN MERELY UNANSWERED. Until the fingerprint upsert,
 * every regeneration DELETED the user's rows and reinserted fresh ones, so
 * `is_dismissed` and `dismissed_at` were destroyed on each run: dismissal rate was
 * unmeasurable in principle, not just unmeasured.
 *
 * THE FIRST READING IS CONTAMINATED - DO NOT USE IT AS A BASELINE. The clock
 * starts at the hp-10 migration (2026-08-28), which cleared the table, so every
 * row created on that date is OUR OWN verification activity: the EUR 700
 * dismissal was hp-10's acceptance step, and the rest came from working through
 * the app while checking it. The raw counter for 2026-08-28 reads 7
 * `unusual_expense` rows, 7 of them dismissed. A 100% dismissal rate is the
 * strongest over-flagging signal this metric can produce, and here it means the
 * opposite of what it appears to: it records us proving that dismissal works, not
 * a user finding the cards useless. Anyone reading the unfiltered number later
 * would reach exactly the wrong conclusion, so the query below EXCLUDES rows
 * created before 2026-08-29:
 *
 *   SELECT type, count(*) AS total, count(*) FILTER (WHERE is_dismissed) AS
 *   dismissed FROM public.insights
 *   WHERE created_at >= DATE '2026-08-29'  -- exclude hp-10 verification rows
 *   GROUP BY type;
 *
 * The filter is on `created_at`, which the upsert preserves, so those seven rows
 * stay excluded permanently even after a later run refreshes their content. That
 * is deliberate - their dismissal state was set during testing and can never
 * become clean evidence.
 *
 * ALSO OBSERVED: MAD = 0 is not a hypothetical edge case. It occurred in 1 of the
 * 8 categories measured (Entertainment, n=27, over half the rows at EUR 20).
 * Subscription-shaped categories make a zero scale estimate the normal case, so
 * any future median-based variant must decide its zero-scale fallback up front
 * rather than discovering an Infinity in production.
 *
 * @param value - Value to check
 * @param mean - Mean of the dataset
 * @param stdDev - Standard deviation of the dataset
 * @param threshold - Number of standard deviations to consider as outlier (default: 2)
 * @returns True if value is an outlier in EITHER direction, false otherwise
 */
export function isOutlier(
  value: number,
  mean: number,
  stdDev: number,
  threshold: number = 2
): boolean {
  if (stdDev === 0) {
    return false; // All values are the same, nothing is an outlier
  }

  const deviationsFromMean = Math.abs(value - mean) / stdDev;
  return deviationsFromMean > threshold;
}
