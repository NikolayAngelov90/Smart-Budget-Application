# Story 12.3: Real-Time Smart Nudges

Status: done

## Story

As a user making spending decisions,
I want to receive timely nudges connecting my spending to goal impact,
So that I can make more informed choices in the moment — both while using the app and when I'm away from it.

## Acceptance Criteria

1. **Given** a user saves a transaction that pushes their category's current-month spend to ≥80% of that category's 3-month historical average, **When** the save completes, **Then** a non-blocking toast nudge appears in the dashboard/transactions UI with the specific category name, amount, and a coaching-tone message (e.g., "You've reached 80% of your usual Dining spend this month").

2. **Given** a user's category spend reaches or exceeds 100% of historical average (full overshoot), **When** any transaction in that category is saved, **Then** the toast nudge escalates in tone — still coaching, never shaming — and mentions the category total vs average.

3. **Given** a user has active savings goals with deadlines AND their spending is tracking above historical average overall, **When** a nudge fires, **Then** the nudge optionally mentions goal impact ("This pace may affect your [Goal Name] goal").

4. **Given** a user has granted push notification permission and has a valid push subscription, **When** a nudge-triggering transaction is saved while the user is NOT in an active browser session, **Then** a Web Push notification is delivered to their device with a one-line summary and a deep link to `/dashboard`.

5. **Given** a user has configured push notification preferences in Settings, **When** they toggle "Spending nudges" off, **Then** no push notifications are sent for nudge events (in-session toasts still fire — push is opt-in only).

6. **Given** push notifications are enabled, **When** the current time falls within the user's configured quiet hours (default: 22:00–08:00 local time), **Then** no push notification is dispatched (in-session toast still fires regardless of quiet hours).

7. **Given** a user visits Settings, **When** they view the Notifications section, **Then** they see toggles for "Spending nudges" push notifications and a quiet hours configuration (start/end time), all properly saved to their preferences.

## Tasks / Subtasks

- [x] Task 1: Install `web-push` package and add VAPID env vars (AC: #4)
  - [x] 1.1 Install dependencies: `npm install web-push` and `npm install --save-dev @types/web-push`
  - [x] 1.2 Generate VAPID keys (run once): `npx web-push generate-vapid-keys` → copy output
  - [x] 1.3 Add to `.env.local`:
    ```
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your_generated_public_key>
    VAPID_PRIVATE_KEY=<your_generated_private_key>
    VAPID_SUBJECT=mailto:you@example.com
    ```
  - [x] 1.4 Add placeholder entries to `.env.example` (no actual values):
    ```
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
    VAPID_PRIVATE_KEY=your_vapid_private_key
    VAPID_SUBJECT=mailto:your_email@example.com
    ```
  - [x] 1.5 Add to Vercel Environment Variables (all three, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` as public)

- [x] Task 2: DB migration — `push_subscriptions` table (AC: #4, #5)
  - [x] 2.1 Create `supabase/migrations/017_push_subscriptions.sql`:
    ```sql
    -- Migration 017: Push subscription storage for Web Push API (Story 12.3)
    CREATE TABLE push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,   -- public key for payload encryption
      auth TEXT NOT NULL,      -- auth secret for payload encryption
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, endpoint)  -- one row per device per user
    );

    ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users manage own push subscriptions"
      ON push_subscriptions
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
    ```

- [x] Task 3: TypeScript types (AC: #1-7)
  - [x] 3.1 In `src/types/user.types.ts`, extend `UserPreferences` with push fields:
    ```typescript
    push_nudges_enabled?: boolean;  // default: false (opt-in)
    quiet_hours_start?: number;     // 0-23, default: 22
    quiet_hours_end?: number;       // 0-23, default: 8
    ```
  - [x] 3.2 In `src/types/database.types.ts`, add after `ForecastResponse`:
    ```typescript
    // ============================================================================
    // NUDGE TYPES (Story 12.3)
    // ============================================================================

    export type NudgeSeverity = 'approaching' | 'exceeded';

    export interface NudgePayload {
      categoryId: string;
      categoryName: string;
      severity: NudgeSeverity;
      /** Current month total AFTER new transaction */
      currentMonthTotal: number;
      /** 3-month historical average */
      historicalAvg: number;
      /** Percentage of historical avg (e.g., 85 = 85%) */
      pctOfAvg: number;
      /** Name of affected goal, if any */
      affectedGoalName: string | null;
      title: string;
      body: string;
    }

    export interface PushSubscriptionRecord {
      id: string;
      user_id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      created_at: string;
    }
    ```

- [x] Task 4: Create `src/lib/ai/nudgeEngine.ts` — pure computation (AC: #1, #2, #3)
  - [x] 4.1 Define `NudgeEngineInput`:
    ```typescript
    export interface NudgeEngineInput {
      userId: string;
      categoryId: string;
      categoryName: string;
      /** Current month total AFTER new transaction included */
      currentMonthTotal: number;
      /** 3-month rolling average (0 = no history) */
      historicalAvg: number;
      /** Name of any active goal with a deadline, or null */
      affectedGoalName: string | null;
    }
    ```
  - [x] 4.2 Implement `evaluateNudge(input: NudgeEngineInput): NudgePayload | null`:
    - Return `null` if `historicalAvg === 0` (no history to compare against — avoid false positives for new categories)
    - `pctOfAvg = Math.round((currentMonthTotal / historicalAvg) * 100)`
    - If `pctOfAvg >= 100`: severity = `'exceeded'`; title = `"${categoryName} spending exceeded your usual amount"`;
      body = `"You've spent $${currentMonthTotal.toFixed(0)} in ${categoryName} this month — your usual monthly average is $${historicalAvg.toFixed(0)}."`
    - Else if `pctOfAvg >= 80`: severity = `'approaching'`; title = `"${categoryName} spending at ${pctOfAvg}%"`;
      body = `"You've used ${pctOfAvg}% of your usual ${categoryName} budget for the month."`
    - Else: return `null` (below threshold)
    - If `affectedGoalName` is non-null, append to body: `" Keeping an eye on this may help with your ${affectedGoalName} goal."`
    - Return `NudgePayload` with all fields populated

- [x] Task 5: Extend `POST /api/transactions` route to trigger nudge (AC: #1, #2, #3, #4)
  - [x] 5.1 After the existing `checkAndTriggerForTransactionCount` call in `src/app/api/transactions/route.ts`, add a nudge evaluation call (non-blocking async):
    - Compute `currentMonthTotal` for the transaction's category in the current month (re-use the DB pattern from `budget-forecast/route.ts`)
    - Compute `historicalAvg` for the category (prior 3 months, same logic as `forecastEngine.ts`)
    - Fetch first active goal with deadline for the user (if any): `SELECT name FROM goals WHERE user_id = $userId AND deadline IS NOT NULL ORDER BY deadline ASC LIMIT 1`
    - Call `evaluateNudge({ userId, categoryId, categoryName, currentMonthTotal, historicalAvg, affectedGoalName })`
    - Include the nudge payload in the transaction POST response: `return NextResponse.json({ data: transaction, nudge: nudgePayload ?? null }, { status: 201 })`
  - [x] 5.2 Push dispatch (async, non-blocking): if nudge fires AND user has push subscriptions:
    - Check user's `push_nudges_enabled` preference and quiet hours
    - If allowed, import `sendPushToUser` from `pushService.ts` and call it asynchronously

- [x] Task 6: Create `src/lib/services/pushService.ts` (AC: #4, #6)
  - [x] 6.1 Import `webpush` from `web-push`; configure once with VAPID details on module init:
    ```typescript
    import webpush from 'web-push';
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    ```
  - [x] 6.2 Implement `sendPushToUser(supabase: SupabaseClient, userId: string, payload: { title: string; body: string; url?: string }): Promise<void>`:
    - Fetch all `push_subscriptions` for `userId` from DB (service-role client)
    - For each subscription: call `webpush.sendNotification(subscription, JSON.stringify({ type: 'nudge', title, body, data: { url: url ?? '/dashboard' } }))`
    - If endpoint returns 410 (Gone) or 404: delete the stale subscription from DB
    - Catch and log errors per subscription without throwing (best-effort delivery)
  - [x] 6.3 Implement `isWithinQuietHours(quietStart: number, quietEnd: number): boolean`:
    - Get `hour = new Date().getHours()` (server time — Vercel UTC)
    - Note: quiet hours use server UTC; users should be informed in Settings UI
    - If `quietStart > quietEnd` (e.g., 22–08): quiet if `hour >= quietStart || hour < quietEnd`
    - If `quietStart <= quietEnd` (e.g., 02–06): quiet if `hour >= quietStart && hour < quietEnd`

- [x] Task 7: Create push subscription API routes (AC: #4, #5)
  - [x] 7.1 Create `src/app/api/push/subscribe/route.ts` — `POST`:
    - Auth-gated (401 if no user)
    - Body: `{ endpoint: string, keys: { p256dh: string, auth: string } }`
    - Upsert into `push_subscriptions` (use `onConflict: 'user_id,endpoint'` for idempotency)
    - Return `{ success: true }`
  - [x] 7.2 Create `src/app/api/push/unsubscribe/route.ts` — `DELETE`:
    - Auth-gated
    - Body: `{ endpoint: string }`
    - Delete matching row from `push_subscriptions`
    - Return `{ success: true }`

- [x] Task 8: Create `src/lib/hooks/usePushNotifications.ts` (AC: #4, #5, #7)
  - [x] 8.1 Hook manages browser push subscription lifecycle:
    ```typescript
    export function usePushNotifications() {
      // subscribe(): requests permission → gets PushSubscription → POST /api/push/subscribe
      // unsubscribe(): gets existing PushSubscription → unsubscribes browser + DELETE /api/push/unsubscribe
      // isSupported: 'serviceWorker' in navigator && 'PushManager' in window
      // isSubscribed: boolean (check navigator.serviceWorker.ready → getSubscription())
    }
    ```
  - [x] 8.2 `subscribe()` function:
    - Check `Notification.permission`; if `'denied'`, return early with error
    - Call `Notification.requestPermission()`; if not `'granted'`, return early
    - Get service worker registration: `await navigator.serviceWorker.ready`
    - Call `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) })`
    - POST subscription to `/api/push/subscribe`
    - Include `urlBase64ToUint8Array` helper in the same file (converts base64 VAPID key to Uint8Array)
  - [x] 8.3 `unsubscribe()` function:
    - Get existing subscription, unsubscribe browser, DELETE from `/api/push/unsubscribe`
  - [x] 8.4 Return: `{ isSupported, isSubscribed, isLoading, subscribe, unsubscribe }`

- [x] Task 9: Extend service worker for push events (AC: #4)
  - [x] 9.1 Add `customWorkerDir: 'worker'` to the `withPWA({...})` config in `next.config.ts`:
    ```typescript
    export default withPWA({
      dest: 'public',
      disable: process.env.NODE_ENV === 'development',
      register: true,
      skipWaiting: true,
      customWorkerDir: 'worker',   // ← ADD THIS
      // ...rest unchanged
    })(withNextIntl(nextConfig));
    ```
  - [x] 9.2 Create `worker/index.ts` with push and notificationclick event handlers:
    ```typescript
    // Custom service worker extension — merged into sw.js by next-pwa
    // Handles Web Push API events for SmartNudge delivery

    declare let self: ServiceWorkerGlobalScope;

    self.addEventListener('push', (event: PushEvent) => {
      if (!event.data) return;
      const payload = event.data.json() as {
        type: string; title: string; body: string; data?: { url?: string };
      };
      event.waitUntil(
        self.registration.showNotification(payload.title, {
          body: payload.body,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          data: payload.data ?? {},
          tag: `nudge-${Date.now()}`,
        })
      );
    });

    self.addEventListener('notificationclick', (event: NotificationEvent) => {
      event.notification.close();
      const url: string = (event.notification.data as { url?: string })?.url ?? '/dashboard';
      event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          const existing = clients.find((c) => c.url.includes(url));
          if (existing) return existing.focus();
          return self.clients.openWindow(url);
        })
      );
    });
    ```
  - [x] 9.3 Note: After `next-pwa` merges this, the custom handler is included in the built `public/sw.js`. The service worker is disabled in development (`disable: process.env.NODE_ENV === 'development'`) so push won't work locally — test via browser DevTools → Application → Service Workers → push simulation.

- [x] Task 10: Create `src/components/ai/SmartNudge.tsx` and `useSmartNudge` hook (AC: #1, #2, #3)
  - [x] 10.1 Create `src/lib/hooks/useSmartNudge.ts`:
    ```typescript
    // Stores the current nudge payload to display; cleared when dismissed
    export function useSmartNudge() {
      const [nudge, setNudge] = useState<NudgePayload | null>(null);
      const showNudge = (payload: NudgePayload) => setNudge(payload);
      const dismissNudge = () => setNudge(null);
      return { nudge, showNudge, dismissNudge };
    }
    ```
  - [x] 10.2 Create `src/components/ai/SmartNudge.tsx`:
    - `'use client'` component — renders a Chakra `Alert` toast-style banner (non-modal)
    - Props: `{ nudge: NudgePayload | null; onDismiss: () => void }`
    - If `nudge === null`: render nothing
    - `severity === 'exceeded'`: `Alert status="warning"` (orange)
    - `severity === 'approaching'`: `Alert status="info"` (blue)
    - Dismiss button (×) calls `onDismiss`
    - No animation (respects `prefers-reduced-motion` by default with no CSS transitions)
    - Placed in `src/app/transactions/page.tsx` OR in the transaction modal — wherever transactions are created (see integration note below)
  - [x] 10.3 Integration: In `src/components/transactions/TransactionEntryModal.tsx`, after successful transaction save:
    - Check if response includes `nudge` field
    - If `nudge !== null`, call `showNudge(nudge)` from a shared `useSmartNudge` instance
    - The `SmartNudge` component is rendered in the transactions page or dashboard with the shared hook state

- [x] Task 11: Settings page — push notification preferences (AC: #5, #6, #7)
  - [x] 11.1 In `src/app/(dashboard)/settings/page.tsx`, add a "Notifications" section before the "Danger Zone":
    - "Push Notifications" heading
    - `Switch` toggle for "Spending nudges" bound to `preferences.push_nudges_enabled ?? false`
    - Time inputs for quiet hours start/end (use Chakra `Select` with hour options 0-23, or `Input type="time"`)
    - Save via `handleUpdatePreferences('push_nudges_enabled', value)` pattern
    - Show the `usePushNotifications` subscribe/unsubscribe button: "Enable browser notifications" if not subscribed, "Disable browser notifications" if subscribed
  - [x] 11.2 Extend `handleUpdatePreferences` field union type to include: `'push_nudges_enabled' | 'quiet_hours_start' | 'quiet_hours_end'`

- [x] Task 12: i18n strings (AC: #1-3, #7)
  - [x] 12.1 Add `"smartNudge"` namespace to `messages/en.json`:
    ```json
    "smartNudge": {
      "approaching": "{categoryName} spending at {pct}%",
      "exceeded": "{categoryName} spending exceeded your usual amount",
      "goalImpact": "Keeping an eye on this may help with your {goalName} goal.",
      "dismiss": "Dismiss"
    },
    "notifications": {
      "title": "Notifications",
      "pushSubtitle": "Push notifications are sent to your device when you're not in the app.",
      "spendingNudges": "Spending nudges",
      "spendingNudgesDescription": "Notify when a category reaches 80% of usual spending",
      "quietHoursStart": "Quiet hours start",
      "quietHoursEnd": "Quiet hours end",
      "enablePush": "Enable browser notifications",
      "disablePush": "Disable browser notifications",
      "pushNotSupported": "Push notifications are not supported on this browser"
    }
    ```
  - [x] 12.2 Add Bulgarian equivalents to `messages/bg.json` under same keys

- [x] Task 13: Tests (AC: all)
  - [x] 13.1 Create `src/lib/ai/__tests__/nudgeEngine.test.ts`:
    - `returns null when historicalAvg is 0 (new category)`
    - `returns null when pctOfAvg < 80`
    - `returns approaching nudge at exactly 80%`
    - `returns approaching nudge between 80-99%`
    - `returns exceeded nudge at 100%+`
    - `includes goal name in body when affectedGoalName is non-null`
    - `does NOT include goal text when affectedGoalName is null`
  - [x] 13.2 Create `src/lib/services/__tests__/pushService.test.ts`:
    - `isWithinQuietHours`: spanning midnight (22-08), non-spanning (02-06), edge cases at boundary hours
    - `sendPushToUser`: mock web-push, mock DB — verifies webpush.sendNotification called per subscription; deletes stale 410 subscriptions
  - [x] 13.3 Create `src/app/api/push/subscribe/__tests__/route.test.ts`:
    - `returns 401 when unauthenticated`
    - `returns 200 and upserts subscription on valid body`
  - [x] 13.4 Create `src/app/api/push/unsubscribe/__tests__/route.test.ts`:
    - `returns 401 when unauthenticated`
    - `returns 200 and deletes subscription`

## Dev Notes

### What Already Exists — Do NOT Re-Implement

- **`src/lib/ai/patternDetection.ts`** — `detectSpendingAnomalies` (monthly spike detection). `nudgeEngine.ts` is DIFFERENT: it operates per-transaction at save time, not as a batch job.
- **`src/lib/ai/forecastEngine.ts`** — `computeEndOfMonthForecasts`. The historical avg computation is the SAME algorithm. In the transaction route, reuse the same query pattern (prior 3 months, `tx.date.substring(0,7)` for month key) rather than importing `forecastEngine` (which requires the full category list). Compute `historicalAvg` inline for just the affected category.
- **`checkAndTriggerForTransactionCount`** — already called in transaction route. The nudge evaluation follows the SAME async non-blocking pattern (call, `.catch()` error).
- **`handleUpdatePreferences`** in settings page — already handles arbitrary preference key-value pairs. Just extend the union type.
- **`src/lib/utils/formatAmount.ts`** — Use for displaying amounts in nudge messages (though nudge body is server-computed, so format manually with `.toFixed(0)` for simplicity).
- **`src/lib/hooks/useUserPreferences.ts`** — `DEFAULT_PREFERENCES` needs updating to include `push_nudges_enabled: false`, `quiet_hours_start: 22`, `quiet_hours_end: 8`.

### Service Worker Critical Notes

- **DO NOT edit `public/sw.js` directly** — it is auto-generated by `next-pwa` on every build. Changes will be overwritten.
- **The `customWorkerDir: 'worker'` approach** bundles `worker/index.ts` into the final service worker. This only takes effect in production builds (`NODE_ENV=production`). In development, `disable: true` prevents the service worker from registering.
- **TypeScript in service worker**: `worker/index.ts` uses `ServiceWorkerGlobalScope` types which are in `lib.webworker.d.ts`. May need `"lib": ["ES2022", "WebWorker"]` added to a `tsconfig.worker.json` or the file can be a plain `.js` file to avoid TS issues.
- **next-pwa version compatibility**: Current `next.config.ts` uses `withPWA` from `next-pwa`. The `customWorkerDir` option is supported in `next-pwa` v5+. Verify: `npm ls next-pwa`.

### Nudge Threshold Logic

```
historicalAvg = avg of prior 3 months' totals for this category
newTotal = currentMonthTotal + newTransactionAmount

pctOfAvg = (newTotal / historicalAvg) * 100

if pctOfAvg >= 100 → severity: 'exceeded' (orange)
if pctOfAvg >= 80  → severity: 'approaching' (blue)
else               → no nudge
if historicalAvg === 0 → no nudge (new category, no baseline)
```

This only fires for the specific category of the saved transaction. One nudge per transaction save at most.

### Push Notification Quiet Hours

Server-side UTC time is used (Vercel runs UTC). The quiet hours configuration in Settings should note this ("Times are in UTC" or adjust for user timezone). For MVP, UTC is acceptable — the architecture doesn't require timezone-accurate quiet hours.

### VAPID Key Setup (Developer Steps)

Before running tests or building, VAPID keys must exist in `.env.local`. To generate:
```bash
npx web-push generate-vapid-keys
```
Copy the output and add to `.env.local`. The public key goes in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (browser-accessible via `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`).

### Architecture Compliance

1. **`nudgeEngine.ts` = pure functions only** — no DB, no side effects. [Source: architecture.md AI Insight Flow]
2. **`pushService.ts` accepts supabase client** — service-layer pattern from Epic 11 retro M1. [Source: src/lib/services/projectionsService.ts:8]
3. **Coaching tone** — "exceeded your usual amount" not "overspent". [Source: UX spec — "Coaching, never judging"]
4. **Push is opt-in only** — `push_nudges_enabled: false` by default. In-session toast always shows regardless. [Source: epics.md#Story 12.4 AC]
5. **Non-blocking** — nudge evaluation and push dispatch are fire-and-forget after transaction save. [Source: existing `checkAndTriggerForTransactionCount` pattern]

### File Structure

```
worker/
└── index.ts                             ← CREATE (Task 9) — service worker push handler
supabase/migrations/
└── 017_push_subscriptions.sql           ← CREATE (Task 2)
src/
├── types/
│   ├── user.types.ts                    ← MODIFY (Task 3.1 — push preference fields)
│   └── database.types.ts               ← MODIFY (Task 3.2 — NudgePayload, PushSubscriptionRecord)
├── lib/
│   ├── ai/
│   │   ├── nudgeEngine.ts              ← CREATE (Task 4)
│   │   └── __tests__/nudgeEngine.test.ts ← CREATE (Task 13.1)
│   ├── services/
│   │   ├── pushService.ts              ← CREATE (Task 6)
│   │   └── __tests__/pushService.test.ts ← CREATE (Task 13.2)
│   └── hooks/
│       ├── usePushNotifications.ts     ← CREATE (Task 8)
│       └── useSmartNudge.ts            ← CREATE (Task 10.1)
├── components/
│   └── ai/
│       └── SmartNudge.tsx              ← CREATE (Task 10.2)
├── app/
│   ├── api/
│   │   ├── transactions/route.ts       ← MODIFY (Task 5 — nudge eval + push dispatch)
│   │   └── push/
│   │       ├── subscribe/route.ts      ← CREATE (Task 7.1)
│   │       ├── subscribe/__tests__/route.test.ts ← CREATE (Task 13.3)
│   │       ├── unsubscribe/route.ts    ← CREATE (Task 7.2)
│   │       └── unsubscribe/__tests__/route.test.ts ← CREATE (Task 13.4)
│   └── (dashboard)/settings/page.tsx  ← MODIFY (Task 11)
├── types/user.types.ts                 ← MODIFY (Task 3.1)
└── ...
next.config.ts                          ← MODIFY (Task 9.1 — customWorkerDir)
messages/
├── en.json                             ← MODIFY (Task 12)
└── bg.json                             ← MODIFY (Task 12)
.env.example                            ← MODIFY (Task 1.4)
```

### Previous Story Learnings (Stories 12.1 & 12.2)

- **`tx.date.substring(0, 7)`** for month keys — NOT `parseISO(tx.date).toISOString()` (timezone-safe fix from code review)
- **`calculateMean([])` returns 0** — safe to call with empty array; historicalAvg = 0 means "no nudge" (guard already in nudgeEngine)
- **Income filter**: always `.eq('type', 'expense')` in DB queries; also check `t.type !== 'expense'` in engine
- **Service layer**: functions accept Supabase client parameter (M1 from Epic 11 retro). `pushService.sendPushToUser` accepts `supabase` as first param.
- **Test doubles**: use `jest.mock('@/lib/supabase/server')` + chainable mock pattern from Story 12.2 tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.4] — AC (maps to sprint story 12-3)
- [Source: _bmad-output/planning-artifacts/prd.md — commit 01f4a8d] — Expanded scope: push notifications with quiet hours, deep links, per-type preferences
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-018] — Push Notification Architecture (VAPID, push_subscriptions, categories)
- [Source: _bmad-output/planning-artifacts/architecture.md:606] — `nudgeEngine.ts` in `src/lib/ai/`
- [Source: _bmad-output/planning-artifacts/architecture.md:364] — Push notification payload shape
- [Source: _bmad-output/planning-artifacts/architecture.md:635] — `usePushNotifications.ts` in hooks
- [Source: src/app/api/transactions/route.ts:352] — Existing async trigger pattern to follow
- [Source: src/lib/ai/forecastEngine.ts] — Historical avg computation pattern to replicate for nudge
- [Source: src/lib/hooks/useUserPreferences.ts] — DEFAULT_PREFERENCES to extend
- [Source: next.config.ts:58] — PWA config location for `customWorkerDir`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 13 tasks implemented; 37 new tests (13 nudgeEngine + 18 pushService + 6 push routes) — all 1254 tests green (1217 existing + 37 new).
- `nudgeEngine.ts`: pure evaluator — ≥80% = 'approaching', ≥100% = 'exceeded', historicalAvg=0 = no nudge. Coaching tone throughout, no blame language.
- `pushService.ts`: `sendPushToUser` dispatches to all devices, cleans up stale 410/404 subscriptions; `isWithinQuietHours` handles overnight and same-day ranges including degenerate start===end case.
- Transaction route extended: nudge evaluation runs post-insert (the new transaction is already in DB so the current-month total query includes it correctly). Non-blocking — wrapped in `.catch()`. `nudge` field included in POST /api/transactions response (null when no nudge fires).
- `worker/index.ts` excluded from main tsconfig.json — compiled separately by next-pwa's webpack. Added `customWorkerDir: 'worker'` to next.config.ts.
- `push_subscriptions` table added to `Database` type interface to resolve Supabase TypeScript overload errors.
- VAPID keys generated and added to `.env.local`; placeholder entries in `.env.example`.
- Settings NotificationsSection: push subscription toggle, spending nudges preference, quiet hours start/end selects. All bound to existing `handleUpdatePreferences` pattern.
- TypeScript: clean. ESLint: clean. No regressions.

### File List

- supabase/migrations/017_push_subscriptions.sql — CREATED
- src/types/database.types.ts — MODIFIED (push_subscriptions table type + NudgePayload + PushSubscriptionRecord)
- src/types/user.types.ts — MODIFIED (push_nudges_enabled, quiet_hours_start, quiet_hours_end fields)
- src/lib/ai/nudgeEngine.ts — CREATED (evaluateNudge pure function)
- src/lib/ai/__tests__/nudgeEngine.test.ts — CREATED (13 unit tests)
- src/lib/services/pushService.ts — CREATED (sendPushToUser, isWithinQuietHours)
- src/lib/services/__tests__/pushService.test.ts — CREATED (18 tests: quiet hours + dispatch)
- src/app/api/push/subscribe/route.ts — CREATED
- src/app/api/push/subscribe/__tests__/route.test.ts — CREATED (3 tests)
- src/app/api/push/unsubscribe/route.ts — CREATED
- src/app/api/push/unsubscribe/__tests__/route.test.ts — CREATED (3 tests)
- src/lib/hooks/usePushNotifications.ts — CREATED
- src/lib/hooks/useSmartNudge.ts — CREATED
- src/components/ai/SmartNudge.tsx — CREATED
- src/components/transactions/TransactionEntryModal.tsx — MODIFIED (imports SmartNudge + useSmartNudge; reads nudge from POST response; renders SmartNudge banner; keeps modal open when nudge fires)
- src/app/api/transactions/route.ts — MODIFIED (nudge evaluation + push dispatch post-insert)
- src/app/(dashboard)/settings/page.tsx — MODIFIED (NotificationsSection + import + field types)
- src/lib/hooks/useUserPreferences.ts — MODIFIED (DEFAULT_PREFERENCES push defaults)
- messages/en.json — MODIFIED (smartNudge + notifications namespaces)
- messages/bg.json — MODIFIED (smartNudge + notifications namespaces)
- next.config.ts — MODIFIED (customWorkerDir: 'worker')
- tsconfig.json — MODIFIED (exclude worker/ from main TS compilation)
- worker/index.ts — CREATED (push + notificationclick service worker handlers)
- .env.example — MODIFIED (VAPID placeholder entries)
