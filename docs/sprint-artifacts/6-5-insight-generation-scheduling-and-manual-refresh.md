# Story 6.5: Insight Generation Scheduling and Manual Refresh

Status: drafted

## Story

As a developer,
I want insights generated automatically on schedule and manually on demand,
So that users always have fresh recommendations.

## Acceptance Criteria

**Given** The system is running
**When** Conditions trigger insight generation
**Then** New insights are created and users are notified

**AC1: Automatic Generation Triggers**
- Start of new month (scheduled job runs for all users)
- After user adds 10+ new transactions
- User manually clicks "Refresh insights" button

**AC2: Scheduled Job**
- Scheduled job runs daily at midnight UTC
- Checks if it's a new month, generates insights for all users if true

**AC3: Manual Refresh Button**
- "Refresh insights" button available on insights page
- Button triggers insight generation for current user only

**AC4: Generation Performance**
- Refresh completes in <2 seconds (as per NFR FR20)

**AC5: Loading Indicator**
- Loading indicator displayed while generating insights
- Uses Chakra UI Spinner or Progress component

**AC6: Success and Empty State Toasts**
- Success toast: "Insights updated! X new insights generated."
- If no new insights: "All caught up! No new insights at this time."

**AC7: Cache Invalidation**
- Manual refresh bypasses 1-hour cache (forceRegenerate=true)

**AC8: Rate Limiting**
- Max 1 manual refresh per 5 minutes per user
- Error message if rate limit exceeded: "Please wait before refreshing again. (X seconds remaining)"

## Tasks / Subtasks

- [ ] **Task 1: Create Vercel Cron Job Endpoint** (AC: #2)
  - [ ] Create `src/app/api/cron/generate-insights/route.ts` file
  - [ ] Implement GET handler for cron job
  - [ ] Verify cron secret token (Vercel provides CRON_SECRET env var for security)
  - [ ] Check authorization header: `Authorization: Bearer ${process.env.CRON_SECRET}`
  - [ ] Query all active users from Supabase
  - [ ] For each user: call `insightService.generateInsights(userId, false)`
  - [ ] Track success/failure counts
  - [ ] Return JSON: `{ success: true, usersProcessed: X, insightsGenerated: Y, errors: [...] }`
  - [ ] Handle errors gracefully, continue processing other users if one fails
  - [ ] Add logging for monitoring and debugging

- [ ] **Task 2: Configure Vercel Cron Job** (AC: #2)
  - [ ] Create or update `vercel.json` in project root
  - [ ] Add cron configuration:
    ```json
    {
      "crons": [{
        "path": "/api/cron/generate-insights",
        "schedule": "0 0 * * *"
      }]
    }
    ```
  - [ ] Schedule: "0 0 * * *" = every day at midnight UTC
  - [ ] Set CRON_SECRET environment variable in Vercel dashboard
  - [ ] Test cron job locally using curl with correct auth header
  - [ ] Deploy and verify cron job runs on schedule (check Vercel logs)

- [ ] **Task 3: Implement 10-Transaction Trigger** (AC: #1)
  - [ ] Open `src/lib/services/insightService.ts` from Story 6.1
  - [ ] Add function: `checkAndTriggerForTransactionCount(userId)`
  - [ ] Query count of transactions created since last insight generation
  - [ ] Store last generation timestamp in cache or insights table (new column or metadata)
  - [ ] If count >= 10 and last generation > 1 hour ago: call `generateInsights(userId, false)`
  - [ ] Integrate into transaction creation flow (Story 3.1)
  - [ ] In transaction API endpoint `POST /api/transactions`, after successful insert:
    - Call `checkAndTriggerForTransactionCount(userId)` asynchronously
    - Don't block transaction response on insight generation
  - [ ] Add unit tests

- [ ] **Task 4: Create Manual Refresh Button Component** (AC: #3, #5, #7, #8)
  - [ ] Create `src/components/insights/RefreshInsightsButton.tsx` component
  - [ ] Use Chakra UI Button with icon (RefreshIcon or RepeatIcon)
  - [ ] Button text: "Refresh Insights"
  - [ ] On click: call `POST /api/insights/generate?forceRegenerate=true`
  - [ ] Show loading state: replace text with Spinner, disable button
  - [ ] Handle success: show toast, mutate SWR cache to reload insights
  - [ ] Handle rate limit error (429 status): show toast with remaining time
  - [ ] Handle other errors: show error toast
  - [ ] Track last refresh time in component state (prevent double-clicks)
  - [ ] Write component tests

- [ ] **Task 5: Add Rate Limiting to Insight Generation Endpoint** (AC: #8)
  - [ ] Open `src/app/api/insights/generate/route.ts` from Story 6.1
  - [ ] Implement rate limiting logic:
    - Check last manual refresh timestamp for user (store in cache or database)
    - If last refresh < 5 minutes ago: return 429 error
    - Calculate remaining seconds: `remainingSeconds = 300 - (now - lastRefresh)`
    - Return error response: `{ error: 'Rate limit exceeded', remainingSeconds }`
  - [ ] Use Redis/KV cache for rate limit tracking (key: `refresh_limit_${userId}`)
  - [ ] Set TTL on cache entry: 5 minutes (300 seconds)
  - [ ] On successful generation: update last refresh timestamp
  - [ ] Add tests for rate limiting behavior

- [ ] **Task 6: Integrate Refresh Button into Insights Page** (AC: #3)
  - [ ] Open `src/app/(dashboard)/insights/page.tsx` from Story 6.3
  - [ ] Import RefreshInsightsButton component
  - [ ] Add button to page header, next to page title
  - [ ] Position: Top-right corner or below filters
  - [ ] On mobile: Full-width button at bottom of filters
  - [ ] On desktop: Compact button in header

- [ ] **Task 7: Implement Toast Notifications** (AC: #6)
  - [ ] Use Chakra UI `useToast` hook
  - [ ] On successful generation: show success toast with count
  - [ ] Toast message: `Insights updated! ${count} new insights generated.`
  - [ ] If no new insights: `All caught up! No new insights at this time.`
  - [ ] Toast duration: 5 seconds
  - [ ] Toast position: top-right (desktop) or top (mobile)
  - [ ] On error: show error toast with message
  - [ ] On rate limit: show warning toast with remaining time

- [ ] **Task 8: Optimize Cron Job for New Month Detection** (AC: #2)
  - [ ] In cron endpoint, check if it's start of new month before processing
  - [ ] Get current date: `new Date()`
  - [ ] Check if today is 1st day of month: `date.getDate() === 1`
  - [ ] If not 1st of month: skip processing, return early
  - [ ] If 1st of month: proceed with generating insights for all users
  - [ ] Add logic to handle timezone differences (users in different timezones)
  - [ ] Alternative: Store last run month in cache, compare to current month

- [ ] **Task 9: Performance Optimization** (AC: #4)
  - [ ] Ensure `generateInsights()` completes in <2 seconds for single user
  - [ ] Profile slow database queries, add indexes if needed
  - [ ] Use database query optimization (SELECT only needed columns)
  - [ ] Implement batch processing for cron job (process users in batches of 10-20)
  - [ ] Add timeout handling: if generation takes >2 seconds, log warning
  - [ ] Test with realistic data volume (100+ transactions per user)

- [ ] **Task 10: Monitoring and Logging** (AC: All)
  - [ ] Add logging to cron job endpoint (success/failure counts, duration)
  - [ ] Log errors with user ID and error message
  - [ ] Add performance logging: track generation time per user
  - [ ] Set up alerts for cron job failures (Vercel monitoring or external service)
  - [ ] Add metrics: insights generated per day, average generation time
  - [ ] Test logging in production environment

- [ ] **Task 11: Integration Testing** (AC: All)
  - [ ] Test scheduled generation: Mock cron job call → verify insights generated
  - [ ] Test 10-transaction trigger: Add 10 transactions → verify insights auto-generated
  - [ ] Test manual refresh: Click button → verify loading state → verify success toast → verify new insights
  - [ ] Test rate limiting: Refresh twice within 5 minutes → verify 429 error → verify remaining time message
  - [ ] Test cache bypass: Refresh immediately after previous generation → verify forceRegenerate=true bypasses cache
  - [ ] Test performance: Measure generation time, ensure <2 seconds
  - [ ] Test new month detection: Mock date to 1st of month → verify cron processes all users
  - [ ] Test empty result: User with no new pattern changes → verify "All caught up" toast

## Dev Notes

### Project Structure Notes

**New Files to Create:**
- `src/app/api/cron/generate-insights/route.ts` - Vercel Cron job endpoint
- `src/components/insights/RefreshInsightsButton.tsx` - Manual refresh button component
- `vercel.json` - Cron job configuration (or update existing)

**Files to Modify:**
- `src/lib/services/insightService.ts` - Add transaction count trigger logic
- `src/app/api/insights/generate/route.ts` - Add rate limiting
- `src/app/(dashboard)/insights/page.tsx` - Add refresh button
- `src/app/api/transactions/route.ts` (Story 3.1) - Integrate 10-transaction trigger

**Environment Variables:**
- `CRON_SECRET` - Secret token for authenticating cron job requests (set in Vercel dashboard)

**Testing Files:**
- `__tests__/app/api/cron/generate-insights.test.ts` - Cron endpoint tests
- `__tests__/components/insights/RefreshInsightsButton.test.tsx` - Button component tests
- `__tests__/lib/services/insightService.test.ts` - Update with transaction trigger tests

### Learnings from Previous Stories

**From Story 6-1-ai-insights-rules-engine-implementation (Status: drafted)**

**Insight Service Available:**
- `insightService.generateInsights(userId, forceRegenerate)` function implemented
- Located at `src/lib/services/insightService.ts`
- Handles caching with 1-hour TTL
- `forceRegenerate=true` bypasses cache

**API Endpoint Available:**
- `POST /api/insights/generate` at `src/app/api/insights/generate/route.ts`
- Accepts `forceRegenerate` query parameter
- Returns array of generated insights and count

[Source: docs/sprint-artifacts/6-1-ai-insights-rules-engine-implementation.md#Tasks]

**From Story 6-3-full-ai-insights-page-with-filtering (Status: drafted)**

**SWR Cache Management:**
- Use `mutate('/api/insights?...')` to invalidate cache after generation
- Triggers automatic refetch of insights
- Updates UI immediately with new data

[Source: docs/sprint-artifacts/6-3-full-ai-insights-page-with-filtering.md#Dev-Notes]

**From Story 3-1 (Transaction Entry):**

**Transaction Creation Flow:**
- `POST /api/transactions` endpoint creates new transactions
- Can integrate 10-transaction trigger into this endpoint
- Use asynchronous call to avoid blocking transaction response

### Architecture and Technical Constraints

**From Epic 6 Tech Spec:**

**Vercel Cron Jobs:**
- Configured in `vercel.json` file
- Cron expression format: `"schedule": "0 0 * * *"` (minute hour day month weekday)
- Endpoint must return within 10 seconds (Vercel limit for serverless functions)
- Authentication via CRON_SECRET environment variable

**Cron Job Endpoint Authentication:**
```typescript
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Proceed with insight generation...
}
```

**Rate Limiting Implementation:**
```typescript
// In /api/insights/generate
const rateLimitKey = `refresh_limit_${userId}`;
const lastRefresh = await redis.get(rateLimitKey);

if (lastRefresh) {
  const elapsed = Date.now() - parseInt(lastRefresh);
  const remaining = 300000 - elapsed; // 5 minutes in ms

  if (remaining > 0) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remainingSeconds: Math.ceil(remaining / 1000) },
      { status: 429 }
    );
  }
}

// After successful generation
await redis.set(rateLimitKey, Date.now().toString(), { ex: 300 }); // 5 min TTL
```

**Transaction Count Trigger:**
```typescript
// In insightService.ts
export async function checkAndTriggerForTransactionCount(userId: string) {
  const lastGeneration = await getLastGenerationTime(userId);
  const transactionsSince = await supabase
    .from('transactions')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .gte('created_at', lastGeneration);

  if (transactionsSince.count >= 10) {
    const hoursSinceLastGen = (Date.now() - lastGeneration) / (1000 * 60 * 60);
    if (hoursSinceLastGen >= 1) {
      await generateInsights(userId, false);
    }
  }
}
```

**Toast Notification Examples:**
```typescript
const toast = useToast();

// Success
toast({
  title: 'Insights updated!',
  description: `${count} new insights generated.`,
  status: 'success',
  duration: 5000,
  isClosable: true,
});

// No new insights
toast({
  title: 'All caught up!',
  description: 'No new insights at this time.',
  status: 'info',
  duration: 5000,
  isClosable: true,
});

// Rate limit
toast({
  title: 'Please wait',
  description: `Please wait before refreshing again. (${remainingSeconds}s remaining)`,
  status: 'warning',
  duration: 5000,
  isClosable: true,
});
```

**Performance Targets:**
- Single user generation: <2 seconds (NFR FR20)
- Cron job batch: Process 100 users in <10 seconds (Vercel limit)
- Use batch processing and Promise.all() for parallel execution

**New Month Detection:**
```typescript
const today = new Date();
const isFirstOfMonth = today.getUTCDate() === 1;

if (!isFirstOfMonth) {
  return NextResponse.json({ skipped: true, reason: 'Not start of month' });
}
```

### Prerequisites

- ✅ Story 6.1: Insight generation service implemented
- ✅ Story 6.3: Insights page exists for refresh button
- ✅ Vercel project configured for cron jobs

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-6.md#Workflows-and-Sequencing]
- [Source: docs/sprint-artifacts/tech-spec-epic-6.md#Acceptance-Criteria]
- [Source: docs/epics.md#Story-6.5]
- [Source: Vercel docs: Cron Jobs configuration]
- [Source: Next.js docs: API Routes, environment variables]
- [Source: Chakra UI docs: useToast, Button, Spinner]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- Agent model will be recorded during implementation -->

### Debug Log References

<!-- Debug logs will be added during implementation -->

### Completion Notes List

<!-- Completion notes will be added during implementation -->

### File List

<!-- File list will be added during implementation -->

---

**Change Log:**
- 2025-12-03: Story drafted by SM Agent (Niki)
