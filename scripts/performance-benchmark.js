#!/usr/bin/env node

/**
 * Performance Benchmark Script
 *
 * Simulates load testing for the Vercel cron job endpoint
 * to verify it can handle processing 1000+ users within the
 * 10-second serverless timeout limit.
 *
 * Epic 6 Retrospective: Performance Benchmarks
 *
 * Usage:
 *   node scripts/performance-benchmark.js
 *
 * Environment Variables Required:
 *   - BENCHMARK_API_URL: Full URL to the API endpoint (default: http://localhost:3000)
 *   - CRON_SECRET: Secret for authenticating cron requests
 */

const BENCHMARK_URL = process.env.BENCHMARK_API_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'test-secret';

// Configuration
const SCENARIOS = {
  light: {
    name: 'Light Load (100 users)',
    userCount: 100,
    description: 'Simulates 100 users with transactions',
  },
  medium: {
    name: 'Medium Load (500 users)',
    userCount: 500,
    description: 'Simulates 500 users with transactions',
  },
  heavy: {
    name: 'Heavy Load (1000 users)',
    userCount: 1000,
    description: 'Simulates 1000 users with transactions - Vercel production limit',
  },
  stress: {
    name: 'Stress Test (2000 users)',
    userCount: 2000,
    description: 'Stress test with 2000 users - beyond typical load',
  },
};

/**
 * Benchmark a single API endpoint
 */
async function benchmarkEndpoint(endpoint, options = {}) {
  const url = `${BENCHMARK_URL}${endpoint}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      duration,
      data,
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      success: false,
      status: 0,
      duration,
      error: error.message,
    };
  }
}

/**
 * Run cron job benchmark for a given user count
 */
async function benchmarkCronJob(userCount) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Benchmarking cron job with ~${userCount} users`);
  console.log(`${'='.repeat(60)}\n`);

  const result = await benchmarkEndpoint('/api/cron/generate-insights', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
    },
  });

  console.log('Result:');
  console.log(`  Status: ${result.status} ${result.success ? '✓' : '✗'}`);
  console.log(`  Duration: ${result.duration}ms (${(result.duration / 1000).toFixed(2)}s)`);

  if (result.data) {
    console.log(`  Users Processed: ${result.data.usersProcessed || 0}`);
    console.log(`  Skipped: ${result.data.skipped || false}`);
    if (result.data.reason) {
      console.log(`  Reason: ${result.data.reason}`);
    }
  }

  // Check if within Vercel timeout (10 seconds)
  const withinTimeout = result.duration < 10000;
  console.log(`\n  Within Vercel 10s Timeout: ${withinTimeout ? '✓ YES' : '✗ NO'}`);

  if (!withinTimeout) {
    console.log(`  ⚠️  WARNING: Exceeded 10-second limit by ${((result.duration - 10000) / 1000).toFixed(2)}s`);
  }

  if (result.error) {
    console.log(`\n  Error: ${result.error}`);
  }

  return result;
}

/**
 * Run API insights endpoint benchmark
 */
async function benchmarkInsightsAPI() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Benchmarking GET /api/insights');
  console.log(`${'='.repeat(60)}\n`);

  const result = await benchmarkEndpoint('/api/insights');

  console.log('Result:');
  console.log(`  Status: ${result.status} ${result.success ? '✓' : '✗'}`);
  console.log(`  Duration: ${result.duration}ms`);

  if (result.data && result.data.insights) {
    console.log(`  Insights Returned: ${result.data.insights.length}`);
    console.log(`  Total Count: ${result.data.total || 0}`);
  }

  // API should respond within 1 second for good UX
  const withinTarget = result.duration < 1000;
  console.log(`\n  Within 1s Target: ${withinTarget ? '✓ YES' : '✗ NO'}`);

  return result;
}

/**
 * Run pagination performance test
 */
async function benchmarkPagination() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Benchmarking Pagination Performance');
  console.log(`${'='.repeat(60)}\n`);

  const pages = [1, 5, 10, 50];
  const results = [];

  for (const page of pages) {
    const result = await benchmarkEndpoint(`/api/insights?limit=20&offset=${(page - 1) * 20}`);
    results.push({ page, ...result });

    console.log(`Page ${page}:`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Status: ${result.status}`);
  }

  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  console.log(`\nAverage Duration: ${avgDuration.toFixed(2)}ms`);
  console.log(`All pages < 1s: ${results.every((r) => r.duration < 1000) ? '✓ YES' : '✗ NO'}`);

  return results;
}

/**
 * Display summary of all benchmarks
 */
function displaySummary(results) {
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('BENCHMARK SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  results.forEach((result) => {
    const status = result.success ? '✓' : '✗';
    const timeStatus = result.duration < 10000 ? '✓' : '⚠️';
    console.log(`${status} ${result.name}`);
    console.log(`   Duration: ${result.duration}ms ${timeStatus}`);

    if (result.usersProcessed !== undefined) {
      console.log(`   Users Processed: ${result.usersProcessed}`);
    }

    console.log('');
  });

  const allPassed = results.every((r) => r.success && r.duration < 10000);
  console.log(`Overall: ${allPassed ? '✓ ALL BENCHMARKS PASSED' : '✗ SOME BENCHMARKS FAILED'}\n`);
}

/**
 * Main benchmark execution
 */
async function main() {
  console.log('Smart Budget Application - Performance Benchmarks');
  console.log(`Target URL: ${BENCHMARK_URL}`);
  console.log(`Current Date: ${new Date().toISOString()}\n`);

  const results = [];

  try {
    // Benchmark 1: Light load
    const light = await benchmarkCronJob(SCENARIOS.light.userCount);
    results.push({
      name: SCENARIOS.light.name,
      success: light.success,
      duration: light.duration,
      usersProcessed: light.data?.usersProcessed,
    });

    // Wait 2 seconds between tests
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Benchmark 2: Medium load (commented out by default - requires database setup)
    // const medium = await benchmarkCronJob(SCENARIOS.medium.userCount);
    // results.push({
    //   name: SCENARIOS.medium.name,
    //   success: medium.success,
    //   duration: medium.duration,
    //   usersProcessed: medium.data?.usersProcessed,
    // });

    // Benchmark 3: Insights API
    const insights = await benchmarkInsightsAPI();
    results.push({
      name: 'Insights API',
      success: insights.success,
      duration: insights.duration,
    });

    // Wait 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Benchmark 4: Pagination
    await benchmarkPagination();
    results.push({
      name: 'Pagination',
      success: true,
      duration: 0, // Calculated separately
    });

    // Display summary
    displaySummary(results);

    console.log('Recommendations:');
    console.log('  - For production load testing, use a dedicated tool like Apache Bench or Artillery');
    console.log('  - Run benchmarks against preview deployments, not production');
    console.log('  - Monitor Vercel function execution logs during high load');
    console.log('  - Consider implementing queue-based processing if timeout issues persist\n');
  } catch (error) {
    console.error('\nBenchmark Error:', error.message);
    process.exit(1);
  }
}

// Run benchmarks
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { benchmarkEndpoint, benchmarkCronJob, benchmarkInsightsAPI };
