/**
 * Unit tests for Spending Analysis Utilities
 */

import {
  calculateMean,
  calculateStdDev,
  calculateMonthOverMonth,
  analyzeSpending,
  compareMonthlySpending,
  isOutlier,
} from '@/lib/ai/spendingAnalysis';

describe('calculateMean', () => {
  it('should calculate mean of positive numbers', () => {
    expect(calculateMean([100, 200, 300])).toBe(200);
    expect(calculateMean([10, 20, 30, 40, 50])).toBe(30);
  });

  it('should handle empty array gracefully', () => {
    expect(calculateMean([])).toBe(0);
  });

  it('should handle single value', () => {
    expect(calculateMean([100])).toBe(100);
  });

  it('should handle negative numbers', () => {
    expect(calculateMean([-10, -20, -30])).toBe(-20);
    expect(calculateMean([-10, 10])).toBe(0);
  });

  it('should handle decimal values', () => {
    expect(calculateMean([1.5, 2.5, 3.5])).toBeCloseTo(2.5, 5);
  });

  it('should handle null or undefined input', () => {
    expect(calculateMean(null as any)).toBe(0);
    expect(calculateMean(undefined as any)).toBe(0);
  });
});

describe('calculateStdDev', () => {
  it('should calculate standard deviation correctly', () => {
    // For values [100, 200, 300], mean=200, stdDev ≈ 81.65
    const result = calculateStdDev([100, 200, 300]);
    expect(result).toBeCloseTo(81.65, 1);
  });

  it('should use provided mean when given', () => {
    const result = calculateStdDev([100, 200, 300], 200);
    expect(result).toBeCloseTo(81.65, 1);
  });

  it('should handle zero variance (all same values)', () => {
    expect(calculateStdDev([50, 50, 50])).toBe(0);
  });

  it('should return 0 for single value', () => {
    expect(calculateStdDev([100])).toBe(0);
  });

  it('should return 0 for empty array', () => {
    expect(calculateStdDev([])).toBe(0);
  });

  it('should handle high variance', () => {
    const result = calculateStdDev([1, 100, 1000]);
    expect(result).toBeGreaterThan(0);
  });

  it('should handle negative numbers', () => {
    const result = calculateStdDev([-100, -200, -300]);
    expect(result).toBeCloseTo(81.65, 1);
  });

  it('should handle mixed positive and negative', () => {
    const result = calculateStdDev([-100, 0, 100]);
    expect(result).toBeCloseTo(81.65, 1);
  });

  it('should handle null or undefined input', () => {
    expect(calculateStdDev(null as any)).toBe(0);
    expect(calculateStdDev(undefined as any)).toBe(0);
  });
});

describe('calculateMonthOverMonth', () => {
  it('should calculate positive percentage increase', () => {
    // From 340 to 480 is ~41.18% increase
    expect(calculateMonthOverMonth(480, 340)).toBeCloseTo(41.18, 1);
  });

  it('should calculate percentage decrease', () => {
    // From 400 to 300 is -25% decrease
    expect(calculateMonthOverMonth(300, 400)).toBe(-25);
  });

  it('should handle zero previous value (divide by zero)', () => {
    expect(calculateMonthOverMonth(100, 0)).toBe(0);
  });

  it('should handle 100% increase (doubling)', () => {
    expect(calculateMonthOverMonth(200, 100)).toBe(100);
  });

  it('should handle exact 20% increase threshold', () => {
    expect(calculateMonthOverMonth(120, 100)).toBe(20);
  });

  it('should handle negative values', () => {
    // From -100 to -150 is +50% (becomes more negative, but percentage is positive)
    // Formula: ((-150) - (-100)) / (-100) * 100 = (-50) / (-100) * 100 = 50
    expect(calculateMonthOverMonth(-150, -100)).toBe(50);
  });

  it('should handle current value of zero', () => {
    expect(calculateMonthOverMonth(0, 100)).toBe(-100);
  });

  it('should handle both values equal', () => {
    expect(calculateMonthOverMonth(100, 100)).toBe(0);
  });

  it('should handle infinite or NaN values', () => {
    expect(calculateMonthOverMonth(Infinity, 100)).toBe(0);
    expect(calculateMonthOverMonth(100, Infinity)).toBe(0);
    expect(calculateMonthOverMonth(NaN, 100)).toBe(0);
  });

  it('should handle small decimal differences', () => {
    const result = calculateMonthOverMonth(100.5, 100);
    expect(result).toBeCloseTo(0.5, 1);
  });
});

describe('analyzeSpending', () => {
  it('should return comprehensive analysis', () => {
    const result = analyzeSpending([100, 200, 300]);

    expect(result.mean).toBe(200);
    expect(result.stdDev).toBeCloseTo(81.65, 1);
    expect(result.count).toBe(3);
  });

  it('should handle empty array', () => {
    const result = analyzeSpending([]);

    expect(result.mean).toBe(0);
    expect(result.stdDev).toBe(0);
    expect(result.count).toBe(0);
  });

  it('should handle single value', () => {
    const result = analyzeSpending([500]);

    expect(result.mean).toBe(500);
    expect(result.stdDev).toBe(0);
    expect(result.count).toBe(1);
  });
});

describe('compareMonthlySpending', () => {
  it('should return complete comparison', () => {
    const result = compareMonthlySpending(480, 340);

    expect(result.current).toBe(480);
    expect(result.previous).toBe(340);
    expect(result.percentChange).toBeCloseTo(41.18, 1);
    expect(result.absoluteChange).toBe(140);
  });

  it('should handle decrease', () => {
    const result = compareMonthlySpending(300, 400);

    expect(result.current).toBe(300);
    expect(result.previous).toBe(400);
    expect(result.percentChange).toBe(-25);
    expect(result.absoluteChange).toBe(-100);
  });

  it('should handle zero previous value', () => {
    const result = compareMonthlySpending(100, 0);

    expect(result.percentChange).toBe(0);
    expect(result.absoluteChange).toBe(100);
  });
});

describe('isOutlier', () => {
  it('should detect outlier beyond 2 standard deviations', () => {
    // Mean: 50, StdDev: 10, Value: 100 is 5 stdDevs away
    expect(isOutlier(100, 50, 10, 2)).toBe(true);
  });

  it('should not detect value within threshold', () => {
    // Mean: 50, StdDev: 10, Value: 65 is 1.5 stdDevs away
    expect(isOutlier(65, 50, 10, 2)).toBe(false);
  });

  it('should handle exact threshold boundary', () => {
    // Mean: 50, StdDev: 10, Value: 70 is exactly 2 stdDevs away
    expect(isOutlier(70, 50, 10, 2)).toBe(false);
    expect(isOutlier(70.01, 50, 10, 2)).toBe(true);
  });

  it('should use default threshold of 2', () => {
    expect(isOutlier(100, 50, 10)).toBe(true);
  });

  it('should handle custom threshold', () => {
    // 3 stdDevs threshold is more strict
    expect(isOutlier(70, 50, 10, 3)).toBe(false);
    expect(isOutlier(100, 50, 10, 3)).toBe(true);
  });

  it('should handle zero standard deviation', () => {
    // When all values are the same, nothing is an outlier
    expect(isOutlier(100, 50, 0, 2)).toBe(false);
  });

  it('should detect negative outliers', () => {
    // Mean: 50, StdDev: 10, Value: 0 is 5 stdDevs below mean
    expect(isOutlier(0, 50, 10, 2)).toBe(true);
  });
});
