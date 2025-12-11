# Story 8.5: Offline Data Caching for Viewing (Phase 1)

Status: drafted

## Story

As a user,
I want to view my previously loaded transactions and dashboard when offline,
So that I can check my budget even without internet connection.

## Acceptance Criteria

**AC-8.5.1:** Offline Data Access
✅ Previously loaded dashboard, transactions, and categories available offline

**AC-8.5.2:** Offline Indicator
✅ Banner displays: "You're offline. Viewing cached data from [timestamp]"
✅ Offline indicator in header (red badge or icon)

**AC-8.5.3:** Read-Only Mode
✅ Add/edit/delete buttons disabled offline (grayed out)
✅ Charts render from cached data

**AC-8.5.4:** Reconnection Behavior
✅ Banner updates: "Back online! Syncing latest data..." when connection restored
✅ Data automatically refreshes on reconnection

**AC-8.5.5:** Service Worker Caching
✅ Service Worker caches static assets (HTML, CSS, JS) for offline app shell

**AC-8.5.6:** SWR Cache Persistence
✅ SWR cache persists data across page refreshes using localStorage

**AC-8.5.7:** PWA Installability
✅ App installable as PWA on mobile (Add to Home Screen)
✅ `manifest.json` configured with app metadata

**AC-8.5.8:** Performance
✅ Offline page load from cache: <500ms
✅ SWR cache retrieval: <100ms

## Tasks / Subtasks

- [ ] Install dependencies (AC: 8.5.5, 8.5.7)
  - [ ] Install next-pwa: `npm install next-pwa`
  - [ ] Configure next-pwa in `next.config.js`

- [ ] Configure Service Worker (AC: 8.5.5, 8.5.7)
  - [ ] Update `next.config.js` with next-pwa settings
  - [ ] Configure Service Worker to cache app shell (HTML, CSS, JS, fonts, icons)
  - [ ] Set cache strategy: NetworkFirst for API, CacheFirst for static assets
  - [ ] Configure offline fallback page (optional)

- [ ] Create PWA manifest (AC: 8.5.7)
  - [ ] Create `public/manifest.json`
  - [ ] Add app metadata: name, short_name, description, theme_color, background_color
  - [ ] Add icon paths (192x192, 512x512)
  - [ ] Set display: "standalone", start_url: "/"
  - [ ] Link manifest in app HTML head

- [ ] Configure SWR cache persistence (AC: 8.5.6)
  - [ ] Create `src/lib/swr/localStorageProvider.ts`
  - [ ] Implement SWR provider with localStorage persistence
  - [ ] Wrap app in SWRConfig with localStorageProvider
  - [ ] Configure cache size limits (max 50MB)
  - [ ] Add cache expiration (optional: 7 days)

- [ ] Create offlineService (AC: 8.5.1, 8.5.2)
  - [ ] Create `src/lib/services/offlineService.ts`
  - [ ] Implement `getOfflineState()` function
  - [ ] Implement `getCachedDataTimestamp()` function
  - [ ] Implement `clearOfflineCache()` function (called on logout)

- [ ] Enhance useOnlineStatus hook (AC: 8.5.2, 8.5.4)
  - [ ] Extend `src/lib/hooks/useOnlineStatus.ts` from Story 8.4
  - [ ] Add cached data timestamp tracking
  - [ ] Listen to online/offline events
  - [ ] Trigger SWR revalidation on reconnection

- [ ] Create OfflineBanner component (AC: 8.5.2, 8.5.4)
  - [ ] Create `src/components/shared/OfflineBanner.tsx`
  - [ ] Use useOnlineStatus hook
  - [ ] Display banner when offline: "You're offline. Viewing cached data from [timestamp]"
  - [ ] Display banner on reconnection: "Back online! Syncing latest data..."
  - [ ] Auto-hide reconnection banner after 3 seconds
  - [ ] Use Chakra UI Alert component (orange for offline, green for back online)

- [ ] Add OfflineBanner to app layout (AC: 8.5.2)
  - [ ] Import OfflineBanner in Dashboard layout
  - [ ] Position at top of page (sticky or fixed)
  - [ ] Ensure visible on all pages

- [ ] Disable mutations when offline (AC: 8.5.3)
  - [ ] Create `useOfflineMutations` hook to check online status before mutations
  - [ ] Disable "Add Transaction" button when offline
  - [ ] Disable "Edit" and "Delete" buttons when offline
  - [ ] Gray out disabled buttons with tooltip: "Available when online"
  - [ ] Update transaction forms to prevent submission when offline

- [ ] Test offline chart rendering (AC: 8.5.3)
  - [ ] Verify dashboard charts render from SWR cache when offline
  - [ ] Verify transaction list displays cached data
  - [ ] Verify category list displays cached data

- [ ] Implement reconnection sync (AC: 8.5.4)
  - [ ] Listen to `online` event in useOnlineStatus hook
  - [ ] Trigger SWR global revalidation: `mutate(() => true)`
  - [ ] Update banner to "Back online! Syncing latest data..."
  - [ ] Re-enable mutation buttons

- [ ] Add cache management (AC: 8.5.6, 8.5.8)
  - [ ] Implement cache size monitoring
  - [ ] Clear SWR cache on logout
  - [ ] Optional: Add "Clear cached data" button in Settings

- [ ] Add responsive styling (AC: 8.5.2)
  - [ ] Mobile: full-width banner
  - [ ] Desktop: full-width banner at top
  - [ ] Ensure banner doesn't obstruct content

- [ ] Write unit tests
  - [ ] Test offlineService functions
  - [ ] Test useOnlineStatus hook (online/offline transitions)
  - [ ] Test OfflineBanner component (all states)
  - [ ] Test mutation disabling when offline

- [ ] Write integration tests
  - [ ] Test SWR cache persistence across page refreshes
  - [ ] Test offline data loading (dashboard, transactions, categories)
  - [ ] Test reconnection sync workflow

- [ ] Write E2E tests
  - [ ] Test full offline workflow: load online → go offline → reload page → view cached data
  - [ ] Test reconnection: go back online → sync latest data
  - [ ] Test mutation disabling: verify buttons disabled offline
  - [ ] Test PWA installation on mobile

## Dev Notes

- **Phase 1 scope:** Read-only offline access. Users can view cached data but cannot add/edit/delete transactions offline. Phase 2 will add offline write queue with conflict resolution.
- **Service Worker scope:** Caches app shell (HTML, CSS, JS, fonts, icons) only. Data is cached by SWR in localStorage, not Service Worker cache.
- **Cache size:** Monitor localStorage usage. Implement cache size limits (max 50MB) to prevent exceeding browser storage quotas.
- **Cache invalidation:** Clear SWR cache on logout to prevent data leakage if device is shared.
- **PWA installability:** manifest.json enables "Add to Home Screen" on mobile. Test on iOS Safari and Android Chrome.
- **Performance:** Service Worker cache retrieval is fast (<100ms). SWR cache from localStorage should be <100ms.

### Project Structure Notes

**New Files:**
- `public/manifest.json` - PWA manifest
- `src/lib/swr/localStorageProvider.ts` - SWR localStorage persistence provider
- `src/lib/services/offlineService.ts` - Offline state and cache management
- `src/components/shared/OfflineBanner.tsx` - Offline indicator banner

**Modified Files:**
- `next.config.js` - Add next-pwa configuration
- `src/lib/hooks/useOnlineStatus.ts` - Extend with cached data timestamp (from Story 8.4)
- `src/app/(dashboard)/layout.tsx` - Add OfflineBanner component
- `src/app/layout.tsx` - Wrap in SWRConfig with localStorageProvider
- `src/components/transactions/*` - Disable mutation buttons when offline
- `src/app/(dashboard)/dashboard/page.tsx` - Ensure charts render from cache offline

**Generated Files (by next-pwa):**
- `public/sw.js` - Service Worker (auto-generated)
- `public/workbox-*.js` - Workbox libraries (auto-generated)

**Alignment with Architecture:**
- Uses next-pwa plugin for Service Worker generation
- Uses SWR cache with localStorage for data persistence
- Uses Chakra UI Alert for offline banner
- Uses existing useOnlineStatus hook (Story 8.4)
- Follows PWA best practices (manifest.json, service worker, offline fallback)

### References

- [Tech Spec: Epic 8 - Story 8.5 Acceptance Criteria](../tech-spec-epic-8.md#story-85-offline-data-caching-for-viewing-phase-1)
- [Tech Spec: User Flow 6 - Offline Data Viewing](../tech-spec-epic-8.md#user-flow-6-offline-data-viewing-story-85)
- [Tech Spec: Offline Cache State Data Models](../tech-spec-epic-8.md#data-models-and-contracts)
- [PRD: FR47 - Cache data for offline viewing](../../PRD.md#functional-requirements)
- [Architecture: PWA Configuration](../../architecture.md#pwa)
- [Architecture: SWR Data Fetching](../../architecture.md#state-management)
- [Epics: Story 7.5 Technical Notes](../../epics.md#story-75-offline-data-caching-for-viewing-phase-1)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List
