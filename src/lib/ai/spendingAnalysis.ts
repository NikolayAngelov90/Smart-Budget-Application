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
 * @param value - Value to check
 * @param mean - Mean of the dataset
 * @param stdDev - Standard deviation of the dataset
 * @param threshold - Number of standard deviations to consider as outlier (default: 2)
 * @returns True if value is an outlier, false otherwise
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
