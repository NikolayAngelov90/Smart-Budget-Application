# Story 10.7: Enhanced PWA for Mobile Production

Status: done

## Story

As a mobile user who wants to use Smart Budget as an installed app on my phone,
I want the app to feel native with proper branding, offline access, and production-ready PWA features,
so that I can use it as a standalone application without the browser chrome.

## Acceptance Criteria

- **AC-10.7.1**: Optimize Web App Manifest — name, short_name, icons (192px, 512px, maskable), theme_color, background_color, lang, scope, id
- **AC-10.7.2**: Add custom splash screen support — iOS apple-touch-startup-image meta tags; Android uses manifest + maskable icon
- **AC-10.7.3**: App opens in standalone display mode (no browser chrome)
- **AC-10.7.4**: Smart install banner — prompt after 3rd visit or 2 minutes engagement, using BeforeInstallPromptEvent
- **AC-10.7.5**: iOS-specific meta tags — apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style: black-translucent, viewport-fit=cover
- **AC-10.7.6**: Service Worker caches critical app shell — repeat loads < 500ms, offline-first
- **AC-10.7.7**: Offline fallback page — clear messaging when data unavailable, graceful degradation
- **AC-10.7.8**: App icon badge — shows unread insights count using Badges API (where supported)
- **AC-10.7.9**: Lighthouse PWA audit score 90+ (verification)
- **AC-10.7.10**: Physical device testing on iOS/Android (manual verification)
- **AC-10.7.11**: Unit tests for manifest configuration, install prompt logic, and badge utility

## Implementation Notes

### Architecture
- Manifest optimization: `public/manifest.json`
- iOS meta tags: `src/app/layout.tsx` metadata export
- Offline fallback: `public/offline.html` + next-pwa `fallbacks` config
- Install prompt: `src/components/pwa/PWAInstallPrompt.tsx` — client component
- Badge utility: `src/lib/utils/appBadge.ts` — thin wrapper around navigator.setAppBadge
- Integration: Install prompt in `AppLayout`, badge updated from insights page

### Dependencies
- Stories 10-1 through 10-6 (completed) — i18n, currency, translations
- Existing `next-pwa` plugin configuration
- Existing manifest.json, service worker, layout metadata

### Key Files
- `public/manifest.json` — Enhanced with lang, scope, id, separated icon purposes
- `public/offline.html` — Standalone offline fallback page
- `src/app/layout.tsx` — iOS meta tags (black-translucent, viewport-fit)
- `next.config.ts` — PWA fallbacks configuration
- `src/components/pwa/PWAInstallPrompt.tsx` — Smart install banner
- `src/lib/utils/appBadge.ts` — Badge API utility
- `src/components/layout/AppLayout.tsx` — Install prompt integration
