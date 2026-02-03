# Analytics Data Retention Policy

**Story:** 9-4 Add Insight Engagement Analytics (AC-9.4.10)
**Created:** 2026-01-27

## Overview

This document describes the data retention policy for the `analytics_events` table in the Smart Budget Application.

## Retention Period

**90 days** - Analytics events older than 90 days are eligible for deletion.

### Rationale

- **Privacy:** Minimizes stored user behavior data
- **Storage:** Prevents unbounded database growth
- **Compliance:** Aligns with GDPR data minimization principles
- **Utility:** 90 days provides sufficient data for trend analysis

## GDPR Compliance

### Automatic Deletion on Account Removal

The `analytics_events` table uses `ON DELETE CASCADE` for the `user_id` foreign key:

```sql
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
```

When a user deletes their account, all their analytics events are automatically deleted.

### No PII Storage

Analytics events do NOT contain personally identifiable information (PII):
- No names, emails, or contact info
- No transaction amounts or financial data
- No category names (only IDs)
- Only event metadata (timestamps, event types, insight IDs)

## Manual Cleanup Script

Run this SQL to delete events older than 90 days:

```sql
-- Delete analytics events older than 90 days
DELETE FROM analytics_events
WHERE timestamp < NOW() - INTERVAL '90 days';
```

### Running the Cleanup

**Via Supabase Dashboard:**
1. Go to Supabase Dashboard → SQL Editor
2. Paste the DELETE query above
3. Click "Run"

**Via Supabase CLI:**
```bash
supabase db execute --sql "DELETE FROM analytics_events WHERE timestamp < NOW() - INTERVAL '90 days';"
```

## Automated Cleanup (Optional)

For production environments, consider setting up automated cleanup using one of these methods:

### Option 1: Supabase Edge Function with Cron

Create `supabase/functions/cleanup-analytics/index.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { error } = await supabase.rpc('cleanup_old_analytics_events');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

Create database function:

```sql
CREATE OR REPLACE FUNCTION cleanup_old_analytics_events()
RETURNS void AS $$
BEGIN
  DELETE FROM analytics_events
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Schedule with pg_cron (if available):

```sql
SELECT cron.schedule(
  'cleanup-analytics',
  '0 3 * * *',  -- Daily at 3 AM UTC
  'SELECT cleanup_old_analytics_events()'
);
```

### Option 2: External Cron Job

Set up a GitHub Actions workflow or external cron service to call the cleanup endpoint weekly.

## Monitoring

### Check Analytics Volume

```sql
-- Count events by age bracket
SELECT
  CASE
    WHEN timestamp > NOW() - INTERVAL '7 days' THEN 'Last 7 days'
    WHEN timestamp > NOW() - INTERVAL '30 days' THEN '7-30 days'
    WHEN timestamp > NOW() - INTERVAL '90 days' THEN '30-90 days'
    ELSE 'Older than 90 days'
  END AS age_bracket,
  COUNT(*) AS event_count
FROM analytics_events
GROUP BY 1
ORDER BY 1;
```

### Check Table Size

```sql
SELECT pg_size_pretty(pg_total_relation_size('analytics_events'));
```

## Event Types Tracked

| Event Name | Description | Properties |
|------------|-------------|------------|
| `insights_page_viewed` | User visited /insights page | `filter`, `page` |
| `insight_viewed` | User expanded insight details | `insight_id`, `insight_type` |
| `insight_dismissed` | User dismissed an insight | `insight_id`, `insight_type` |

## Future Considerations

- **Analytics Dashboard:** Build admin UI to visualize engagement metrics
- **Aggregation:** Pre-aggregate old data before deletion for long-term trends
- **Export:** Provide data export option before deletion for compliance requests
