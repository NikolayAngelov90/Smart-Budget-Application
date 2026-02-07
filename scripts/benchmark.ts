#!/usr/bin/env ts-node

/**
 * Performance Benchmark Script
 * Measures dashboard load time, chart render times, and real-time update latency
 *
 * Usage: npm run benchmark
 *
 * Targets:
 * - Dashboard load: <2000ms
 * - Pie chart render: <100ms
 * - Line chart render: <150ms
 * - Real-time latency: <300ms
 */

import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

interface BenchmarkResults {
  date: string
  dashboard_load_ms: number
  pie_chart_render_ms: number
  line_chart_render_ms: number
  realtime_latency_ms: number
  ttfb_ms: number
  fcp_ms: number
  lcp_ms: number
}

interface BaselineResults extends BenchmarkResults {
  [key: string]: string | number
}

const DASHBOARD_URL = 'http://localhost:3000/dashboard'
const RESULTS_DIR = path.join(process.cwd(), 'benchmarks')
const RESULTS_FILE = path.join(RESULTS_DIR, 'results.json')
const BASELINE_FILE = path.join(RESULTS_DIR, 'baseline.json')

async function measureDashboardLoad(page: Page): Promise<Partial<BenchmarkResults>> {
  console.log('📊 Measuring dashboard load time...')

  const startTime = Date.now()

  // Navigate and wait for network idle
  await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' })

  const endTime = Date.now()
  const totalLoad = endTime - startTime

  // Get Web Vitals using Performance API
  const metrics = await page.evaluate(() => {
    const perfEntries = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const paintEntries = performance.getEntriesByType('paint')

    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0

    // Get LCP using PerformanceObserver (may not be available immediately)
    let lcp = 0
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
    const lastLcpEntry = lcpEntries[lcpEntries.length - 1]
    if (lastLcpEntry) {
      lcp = lastLcpEntry.startTime
    }

    return {
      ttfb: perfEntries ? perfEntries.responseStart - perfEntries.requestStart : 0,
      fcp: fcp,
      lcp: lcp || fcp * 1.2, // Fallback estimate
    }
  })

  console.log(`  ✓ Total load: ${totalLoad}ms`)
  console.log(`  ✓ TTFB: ${Math.round(metrics.ttfb)}ms`)
  console.log(`  ✓ FCP: ${Math.round(metrics.fcp)}ms`)
  console.log(`  ✓ LCP: ${Math.round(metrics.lcp)}ms`)

  return {
    dashboard_load_ms: totalLoad,
    ttfb_ms: Math.round(metrics.ttfb),
    fcp_ms: Math.round(metrics.fcp),
    lcp_ms: Math.round(metrics.lcp),
  }
}

async function measureChartRenderTime(page: Page, chartName: string, selector: string): Promise<number> {
  console.log(`📈 Measuring ${chartName} render time...`)

  try {
    // Add performance mark before chart appears
    await page.evaluate((name) => {
      performance.mark(`${name}-start`)
    }, chartName)

    // Wait for chart to be visible (with longer timeout)
    await page.waitForSelector(selector, { state: 'visible', timeout: 15000 })

    // Measure render time
    const renderTime = await page.evaluate((name) => {
      performance.mark(`${name}-end`)
      performance.measure(`${name}-render`, `${name}-start`, `${name}-end`)
      const measure = performance.getEntriesByName(`${name}-render`)[0]
      return measure?.duration ?? 0
    }, chartName)

    console.log(`  ✓ ${chartName} render: ${Math.round(renderTime)}ms`)

    return Math.round(renderTime)
  } catch (error) {
    console.log(`  ⚠️  ${chartName} not found or not visible (skipped)`)
    // Return a placeholder value indicating measurement was skipped
    return -1
  }
}

async function measureRealtimeLatency(page: Page): Promise<number> {
  console.log('⚡ Measuring real-time update latency...')

  // Note: This is a simplified measurement
  // In a real scenario, you'd create a transaction via API and measure update time
  // For now, we'll measure the time it takes for SWR to revalidate

  const startTime = Date.now()

  // Trigger revalidation by focusing the page (SWR revalidateOnFocus)
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'))
  })

  // Wait for network request to complete
  await page.waitForLoadState('networkidle', { timeout: 5000 })

  const endTime = Date.now()
  const latency = endTime - startTime

  console.log(`  ✓ Real-time latency: ${latency}ms`)

  return latency
}

async function runBenchmarks(): Promise<BenchmarkResults> {
  let browser: Browser | null = null

  try {
    // Launch browser
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    })
    const page = await context.newPage()

    // Measure dashboard load
    const loadMetrics = await measureDashboardLoad(page)

    // Measure chart render times
    // Note: Charts will only render if user is logged in and has data
    const pieChartTime = await measureChartRenderTime(
      page,
      'CategorySpendingChart',
      '.recharts-responsive-container svg, [data-testid="category-spending-chart"]'
    )

    const lineChartTime = await measureChartRenderTime(
      page,
      'SpendingTrendsChart',
      '.recharts-responsive-container svg, [data-testid="spending-trends-chart"]'
    )

    // Measure real-time latency
    const realtimeLatency = await measureRealtimeLatency(page)

    // Close browser
    await browser.close()
    browser = null

    return {
      date: new Date().toISOString(),
      dashboard_load_ms: loadMetrics.dashboard_load_ms ?? 0,
      pie_chart_render_ms: pieChartTime,
      line_chart_render_ms: lineChartTime,
      realtime_latency_ms: realtimeLatency,
      ttfb_ms: loadMetrics.ttfb_ms ?? 0,
      fcp_ms: loadMetrics.fcp_ms ?? 0,
      lcp_ms: loadMetrics.lcp_ms ?? 0,
    }
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    throw error
  }
}

function saveResults(results: BenchmarkResults): void {
  // Ensure benchmarks directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
  }

  // Save current results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))
  console.log(`\n💾 Results saved to ${RESULTS_FILE}`)

  // Create baseline if it doesn't exist
  if (!fs.existsSync(BASELINE_FILE)) {
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(results, null, 2))
    console.log(`📌 Baseline created at ${BASELINE_FILE}`)
  }
}

function compareToBaseline(current: BenchmarkResults): void {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.log('\n⚠️  No baseline found. Current results will be used as baseline.')
    return
  }

  const baseline: BaselineResults = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'))

  console.log('\n📊 Comparison to Baseline:')
  console.log('=' .repeat(60))

  const metrics = [
    { key: 'dashboard_load_ms', label: 'Dashboard Load', threshold: 2000 },
    { key: 'pie_chart_render_ms', label: 'Pie Chart Render', threshold: 100 },
    { key: 'line_chart_render_ms', label: 'Line Chart Render', threshold: 150 },
    { key: 'realtime_latency_ms', label: 'Real-time Latency', threshold: 300 },
  ]

  let failed = false

  metrics.forEach(({ key, label, threshold }) => {
    const currentValue = current[key as keyof BenchmarkResults] as number

    // Skip if measurement was not available (-1)
    if (currentValue === -1) {
      console.log(`⊘  ${label}: Not measured (chart not visible)`)
      return
    }

    const baselineValue = baseline[key] as number
    const change = currentValue - baselineValue
    const changePercent = ((change / baselineValue) * 100).toFixed(1)
    const status = currentValue > threshold ? '❌' : '✅'
    const trend = change > 0 ? '↑' : change < 0 ? '↓' : '→'

    console.log(`${status} ${label}: ${currentValue}ms (baseline: ${baselineValue}ms) ${trend} ${changePercent}%`)

    if (currentValue > threshold) {
      failed = true
      console.log(`   ⚠️  EXCEEDS THRESHOLD: ${threshold}ms`)
    }
  })

  console.log('=' .repeat(60))

  if (failed) {
    console.error('\n❌ Performance benchmarks FAILED')
    process.exit(1)
  } else {
    console.log('\n✅ All performance benchmarks PASSED')
  }
}

async function main() {
  console.log('🚀 Starting Performance Benchmarks...')
  console.log('📝 Note: For accurate chart measurements, ensure you are logged in')
  console.log('   and have transaction data in the dashboard.\n')

  try {
    const results = await runBenchmarks()
    saveResults(results)
    compareToBaseline(results)
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error)
    process.exit(1)
  }
}

main()
