# Performance Testing Guide

## Overview

This document describes the performance testing infrastructure for the Smart Budget Application, including how to run benchmarks locally, interpret results, and understand performance budgets.

## Performance Targets

The application has the following performance targets:

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **Dashboard Load Time** | <2000ms | <2500ms |
| **Pie Chart Render** | <100ms | <150ms |
| **Line Chart Render** | <150ms | <200ms |
| **Real-time Update Latency** | <300ms | <400ms |
| **Lighthouse Performance Score** | >90 | >85 |
| **Lighthouse Accessibility Score** | >95 | >90 |
| **Lighthouse Best Practices Score** | >90 | >85 |

## Running Performance Benchmarks Locally

### Prerequisites

1. **Build the production app:**
   ```bash
   npm run build
   ```

2. **Start the production server:**
   ```bash
   npm run start
   ```
   (The server will start on `http://localhost:3000`)

3. **In a new terminal, run benchmarks:**
   ```bash
   npm run benchmark
   ```

### Benchmark Output

The benchmark script will:
1. Measure dashboard load time (TTFB, FCP, LCP)
2. Measure chart render times (pie chart, line chart)
3. Measure real-time update latency
4. Compare results to baseline
5. Fail if any metric exceeds critical thresholds

Example output:
```
🚀 Starting Performance Benchmarks...

📊 Measuring dashboard load time...
  ✓ Total load: 1850ms
  ✓ TTFB: 120ms
  ✓ FCP: 450ms
  ✓ LCP: 1200ms

📈 Measuring CategorySpendingChart render time...
  ✓ CategorySpendingChart render: 95ms

📈 Measuring SpendingTrendsChart render time...
  ✓ SpendingTrendsChart render: 140ms

⚡ Measuring real-time update latency...
  ✓ Real-time latency: 280ms

💾 Results saved to benchmarks/results.json

📊 Comparison to Baseline:
============================================================
✅ Dashboard Load: 1850ms (baseline: 1920ms) ↓ -3.6%
✅ Pie Chart Render: 95ms (baseline: 102ms) ↓ -6.9%
✅ Line Chart Render: 140ms (baseline: 135ms) ↑ +3.7%
✅ Real-time Latency: 280ms (baseline: 290ms) ↓ -3.4%
============================================================

✅ All performance benchmarks PASSED
```

### Baseline Management

**Creating a baseline:**
- The first time you run benchmarks, `benchmarks/baseline.json` is automatically created
- This baseline is used for future comparisons

**Updating the baseline:**
- If you make intentional optimizations, update the baseline:
  ```bash
  cp benchmarks/results.json benchmarks/baseline.json
  ```
- Commit the new baseline to Git:
  ```bash
  git add benchmarks/baseline.json
  git commit -m "Update performance baseline after optimizations"
  ```

## Running Lighthouse Audits Locally

### Prerequisites

Install Lighthouse CLI globally:
```bash
npm install -g @lhci/cli
```

### Run Lighthouse

1. **Build and start the production server:**
   ```bash
   npm run build
   npm run start
   ```

2. **In a new terminal, run Lighthouse:**
   ```bash
   npx lhci autorun --config=lighthouserc.json
   ```

### Lighthouse Configuration

The `lighthouserc.json` file configures:
- **Target page:** `/dashboard` (most performance-critical page)
- **Number of runs:** 3 (average is reported)
- **Thresholds:**
  - Performance: >90
  - Accessibility: >95
  - Best Practices: >90
  - SEO: >80 (warning only)

### Interpreting Lighthouse Results

Lighthouse scores each category from 0-100:
- **90-100:** Green (Excellent)
- **50-89:** Orange (Needs Improvement)
- **0-49:** Red (Poor)

Key metrics to watch:
- **LCP (Largest Contentful Paint):** <1.5s (target: main content visible quickly)
- **FID (First Input Delay):** <100ms (target: interactive quickly)
- **CLS (Cumulative Layout Shift):** <0.1 (target: no layout shifts)

## Continuous Integration

### Automated Testing on PRs

Every pull request triggers:

1. **Test Workflow** (`.github/workflows/test.yml`):
   - Type checking
   - Linting
   - Unit tests with coverage
   - **Performance benchmarks** (runs after tests)
   - Posts benchmark results as PR comment

2. **Lighthouse Workflow** (`.github/workflows/lighthouse.yml`):
   - Runs Lighthouse on desktop and mobile
   - Uploads results to temporary public storage
   - Fails PR if scores below thresholds

### Daily Coverage Reports

Every day at 2 AM UTC:
- Coverage workflow runs (`github/workflows/coverage.yml`)
- Generates coverage summary in GitHub
- Uploads to Codecov for tracking trends

## Performance Monitoring in Production

### Vercel Analytics

The application uses **Vercel Analytics** and **Speed Insights** for real-time monitoring:

**Metrics tracked:**
- Page load times (P50, P75, P95, P99)
- Core Web Vitals (LCP, FID, CLS)
- Geographic distribution
- Device breakdown (mobile, desktop, tablet)

**Access Vercel Analytics:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the `smart-budget-application` project
3. Navigate to **Analytics** tab

### Performance Alerts (Vercel Dashboard)

**Recommended alert setup:**

1. **Dashboard Performance Degradation:**
   - **Condition:** P75 dashboard load time > 2.2s (10% above target)
   - **Notification:** Email to team
   - **Frequency:** Immediate

2. **Core Web Vitals:**
   - **Condition:** LCP > 2.5s OR FID > 100ms OR CLS > 0.1
   - **Notification:** Email + Slack
   - **Frequency:** Daily digest

3. **Weekly Performance Report:**
   - **Summary:** Page load times, Core Web Vitals, week-over-week comparison
   - **Recipients:** Product owner + engineering team
   - **Frequency:** Every Monday morning

### Custom Performance Marks

The dashboard page includes custom performance marks:
- `dashboard-render-start` - When component mounts
- `dashboard-render-end` - When component fully renders
- `dashboard-render` - Measure of total render time

These marks are automatically captured by Vercel Analytics and can be viewed in the Performance Insights dashboard.

## Performance Debugging

### Slow Dashboard Load (>2s)

**Potential causes:**
1. **Supabase query slow:**
   - Check query execution time in Supabase dashboard
   - Add database indexes if needed
   - Optimize query filters

2. **Too many API calls:**
   - Review SWR deduplication intervals
   - Check for redundant fetches
   - Consider data aggregation

3. **Large bundle size:**
   - Run `npm run build` and check `.next/analyze` output
   - Lazy load charts with dynamic imports
   - Tree-shake unused dependencies

### Slow Chart Rendering (>300ms)

**Potential causes:**
1. **Too many data points:**
   - Limit transactions to relevant date range
   - Aggregate data server-side
   - Implement pagination

2. **Recharts performance:**
   - Reduce number of chart elements
   - Use `animationDuration={0}` for faster render
   - Consider canvas-based charting library for large datasets

3. **React re-renders:**
   - Memoize chart components with `React.memo()`
   - Use `useMemo` for expensive calculations
   - Optimize SWR refresh intervals

### High Real-time Latency (>300ms)

**Potential causes:**
1. **Supabase Realtime overhead:**
   - Check subscription payload size
   - Optimize Realtime filters
   - Consider debouncing updates

2. **Network latency:**
   - Check geographic distance to Supabase region
   - Consider CDN for static assets
   - Optimize payload sizes

3. **React state updates:**
   - Batch state updates with `startTransition`
   - Use optimistic UI updates
   - Debounce rapid state changes

## Performance Optimization Checklist

When optimizing performance:

- [ ] Run benchmarks before and after changes
- [ ] Verify Lighthouse scores remain above thresholds
- [ ] Test on mobile devices (3G connection simulation)
- [ ] Check bundle size with `npm run build`
- [ ] Profile with React DevTools Profiler
- [ ] Update baseline if improvements are significant
- [ ] Document optimization in Git commit message
- [ ] Monitor production metrics for 24-48 hours after deployment

## Resources

- **Web Vitals:** https://web.dev/vitals/
- **Lighthouse Documentation:** https://developers.google.com/web/tools/lighthouse
- **Vercel Analytics:** https://vercel.com/docs/analytics
- **Next.js Performance:** https://nextjs.org/docs/advanced-features/measuring-performance
- **React Profiler:** https://react.dev/reference/react/Profiler

## Troubleshooting

### Benchmark script fails with "Cannot connect to server"

**Solution:**
1. Ensure production server is running: `npm run start`
2. Verify server is accessible: `curl http://localhost:3000/dashboard`
3. Check for port conflicts (should be port 3000)

### Lighthouse fails with "Protocol error"

**Solution:**
1. Close other Chrome instances
2. Run with `--chrome-flags="--headless=new"`
3. Increase timeout in `lighthouserc.json`

### Benchmark results inconsistent

**Solution:**
1. Close other applications (reduce CPU load)
2. Run multiple times and average results
3. Ensure production build (not development mode)
4. Check for background processes consuming resources

### CI benchmarks pass locally but fail in CI

**Solution:**
1. CI has different hardware specs (usually slower)
2. Adjust thresholds for CI environment
3. Use `continue-on-error: true` for non-critical benchmarks
4. Monitor trends instead of absolute values

## Contact

For questions or issues with performance testing:
- **Project Owner:** Niki
- **Documentation:** This file (`docs/performance-testing.md`)
- **Issues:** Create a GitHub issue with label `performance`
