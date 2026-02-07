# Epic 10: Internationalization, Multi-Currency & Mobile Production

**Epic**: Epic 10 - Internationalization, Multi-Currency & Mobile Production
**Date**: 2026-02-07
**Author**: Niki (Project Lead), Bob (Scrum Master)
**Source**: Epic 9 Retrospective Action Items & Project Lead Feature Requests
**Status**: Draft - Awaiting Dev Agent Assignment for Story 10-1

---

## Executive Summary

Epic 10 transitions the Smart Budget Application from a single-language, single-currency tool to an internationally-ready, multi-currency application with production-grade mobile experience. This epic delivers three major user-facing capabilities: multi-currency support (Euro default, USD), Bulgarian language UI, and enhanced mobile experience for production readiness. Per the 20% infrastructure policy (Story 9-10), 2 of 10 stories are reserved for infrastructure work addressing critical technical debt.

**Key Deliverables:**
- Multi-currency support with Euro as default, USD as secondary, user-selectable
- Bulgarian language UI with i18n framework (extensible for future languages)
- Production-grade mobile PWA experience
- Integration tests (CRITICAL - overdue since Epic 6)
- CI/CD pipeline integration for deployment scripts

**Infrastructure Allocation:** 2/10 stories (20%) - meets target per infrastructure policy

---

## Epic Goal

**User Value Statement:** After Epic 10, users can track finances in their preferred currency (Euro or USD), use the app entirely in Bulgarian or English, and have a polished mobile experience suitable for daily use as an installed app.

---

## Use Cases

### UC-10.1: Multi-Currency Transaction Entry
**Actor:** Budget-conscious user who earns in Euro but travels/shops in USD

**Steps:**
1. User opens transaction entry modal
2. Amount field shows Euro (EUR) symbol by default (user's preferred currency)
3. User can toggle currency selector to switch to USD for this transaction
4. User enters $45.00 for a purchase made in USD
5. System stores the transaction in USD with exchange rate at time of entry
6. Dashboard shows all amounts converted to user's preferred currency (EUR)
7. Transaction list shows original currency with converted equivalent

**Postconditions:**
- Transaction stored with original currency and exchange rate
- Dashboard totals reflect converted amounts in preferred currency
- User can see both original and converted amounts

### UC-10.2: Language Switching
**Actor:** Bulgarian-speaking user

**Steps:**
1. User navigates to Settings page
2. User finds "Language" option under Preferences
3. User selects "Български" from language dropdown
4. UI immediately switches to Bulgarian
5. All navigation labels, buttons, form labels, error messages display in Bulgarian
6. Numbers and dates format per Bulgarian locale (dd.MM.yyyy, comma decimal separator)
7. Setting persists across sessions

**Postconditions:**
- Entire UI displays in Bulgarian
- Date/number formatting follows Bulgarian conventions
- Language preference stored in user profile

### UC-10.3: Mobile App Experience
**Actor:** User who installs the PWA on their phone

**Steps:**
1. User visits the app on mobile Chrome/Safari
2. User sees "Add to Home Screen" prompt (or installs from browser menu)
3. App opens in standalone mode (no browser chrome)
4. Splash screen displays app branding during load
5. Bottom navigation provides thumb-friendly access to Dashboard, Transactions, Insights, Settings
6. Swipe gestures work for common actions (swipe to delete transaction)
7. App works offline with cached data

**Postconditions:**
- App feels native with proper splash screen and standalone mode
- Navigation is optimized for one-handed mobile use
- Touch gestures enhance mobile productivity

---

## Story Breakdown

### Story 10-1: i18n Framework Setup & Language Switcher
**Priority:** HIGH (Foundation for all localization)
**Type:** Feature
**Acceptance Criteria:**
- AC-10.1.1: Install and configure `next-intl` (or equivalent i18n library) with Next.js App Router
- AC-10.1.2: Create translation file structure: `messages/en.json` and `messages/bg.json`
- AC-10.1.3: Extract all hardcoded English strings from components into translation keys
- AC-10.1.4: Add language switcher component in Settings page (dropdown: English / Български)
- AC-10.1.5: Language preference persisted in user profile (Supabase `user_preferences` table or localStorage)
- AC-10.1.6: Default language detection from browser `navigator.language` on first visit
- AC-10.1.7: All date formatting uses locale-aware formatters (en-US: MM/DD/YYYY, bg: DD.MM.YYYY)
- AC-10.1.8: All number formatting uses locale-aware formatters (en: 1,234.56, bg: 1 234,56)
- AC-10.1.9: Unit tests for language switching, locale detection, and format helpers
- AC-10.1.10: Existing tests remain passing (559+ tests)

### Story 10-2: Bulgarian Language Translations
**Priority:** HIGH
**Type:** Feature
**Prerequisites:** Story 10-1
**Acceptance Criteria:**
- AC-10.2.1: Complete `messages/bg.json` with all UI strings translated to Bulgarian
- AC-10.2.2: Navigation labels translated: Dashboard (Табло), Transactions (Транзакции), Categories (Категории), Insights (Прегледи), Settings (Настройки)
- AC-10.2.3: All form labels, placeholders, and validation messages translated
- AC-10.2.4: All error messages and toast notifications translated
- AC-10.2.5: AI insight text templates translated (coaching tone preserved in Bulgarian)
- AC-10.2.6: Onboarding modal content translated
- AC-10.2.7: Pre-defined category names translated (Rent/Наем, Food/Храна, Transport/Транспорт, etc.)
- AC-10.2.8: Date picker and calendar components display Bulgarian month/day names
- AC-10.2.9: Visual verification: no text overflow or layout breaks with Bulgarian strings (Cyrillic is often wider)
- AC-10.2.10: Unit tests verifying all translation keys exist in both en.json and bg.json (no missing keys)

### Story 10-3: Multi-Currency User Settings & Configuration
**Priority:** HIGH (Foundation for currency features)
**Type:** Feature
**Acceptance Criteria:**
- AC-10.3.1: Add `preferred_currency` column to user preferences (default: 'EUR')
- AC-10.3.2: Create currency configuration: supported currencies array with code, symbol, name, locale
- AC-10.3.3: Initial supported currencies: EUR (Euro, default), USD (US Dollar)
- AC-10.3.4: Currency selector in Settings page under Preferences section
- AC-10.3.5: Currency symbol displayed correctly: EUR (€), USD ($)
- AC-10.3.6: Currency formatting respects locale: EUR €1.234,56 / USD $1,234.56
- AC-10.3.7: Changing preferred currency updates all dashboard displays immediately (SWR revalidation)
- AC-10.3.8: Currency preference syncs across devices via Supabase
- AC-10.3.9: Migration script for existing users (set default to EUR)
- AC-10.3.10: Unit tests for currency configuration, formatting, and preference persistence

### Story 10-4: Currency Formatting & Display Throughout App
**Priority:** HIGH
**Type:** Feature
**Prerequisites:** Story 10-3
**Acceptance Criteria:**
- AC-10.4.1: Create `formatCurrency(amount, currencyCode, locale)` utility function
- AC-10.4.2: All monetary displays use `formatCurrency` (dashboard StatCards, charts, transaction list, insights)
- AC-10.4.3: Dashboard summary cards show amounts in user's preferred currency
- AC-10.4.4: Transaction list shows amounts with correct currency symbol
- AC-10.4.5: Chart tooltips and axis labels display formatted currency
- AC-10.4.6: Export (CSV/PDF) includes currency symbol and formatting per user preference
- AC-10.4.7: AI insight recommendations display amounts in user's preferred currency
- AC-10.4.8: Category spending chart legend shows formatted currency amounts
- AC-10.4.9: Month-over-month comparison shows formatted currency with +/- indicators
- AC-10.4.10: No hardcoded "$" or "USD" strings remain in the codebase
- AC-10.4.11: Unit tests for formatCurrency with edge cases (0, negative, very large numbers, different locales)

### Story 10-5: Exchange Rate Integration & Currency Conversion
**Priority:** HIGH
**Type:** Feature
**Prerequisites:** Story 10-3, Story 10-4
**Acceptance Criteria:**
- AC-10.5.1: Integrate free exchange rate API (ECB rates or Open Exchange Rates free tier)
- AC-10.5.2: Daily rate fetching with server-side caching (rates update once per day)
- AC-10.5.3: `convertCurrency(amount, fromCurrency, toCurrency, date?)` utility function
- AC-10.5.4: Fallback to last known rate if API is unavailable (graceful degradation)
- AC-10.5.5: Exchange rate stored with each transaction when currency differs from preferred
- AC-10.5.6: Dashboard aggregations convert all transactions to preferred currency using stored rates
- AC-10.5.7: Rate display: "1 EUR = 1.08 USD" shown in Settings currency section
- AC-10.5.8: Historical rates used for past transactions (rate at time of entry, not current rate)
- AC-10.5.9: API rate limiting: max 1 request per hour to exchange rate service
- AC-10.5.10: Unit tests for conversion logic, caching, fallback behavior, and rate staleness

### Story 10-6: Transaction Multi-Currency Support
**Priority:** HIGH
**Type:** Feature
**Prerequisites:** Story 10-3, Story 10-4, Story 10-5
**Acceptance Criteria:**
- AC-10.6.1: Add `currency` column to transactions table (default: user's preferred currency)
- AC-10.6.2: Add `exchange_rate` column to transactions table (rate at time of entry, nullable)
- AC-10.6.3: Transaction entry modal includes currency selector (small toggle next to amount field)
- AC-10.6.4: Default currency in entry modal matches user's preferred currency
- AC-10.6.5: When transaction currency differs from preferred, exchange rate auto-populated
- AC-10.6.6: Transaction list shows original amount and currency, with converted equivalent in parentheses
- AC-10.6.7: Filter transactions by currency (all, EUR only, USD only)
- AC-10.6.8: Edit transaction preserves original currency and exchange rate
- AC-10.6.9: CSV export includes columns: amount, currency, exchange_rate, converted_amount
- AC-10.6.10: Database migration with backward compatibility (existing transactions default to EUR)
- AC-10.6.11: Unit and component tests for multi-currency transaction flow

### Story 10-7: Enhanced PWA for Mobile Production
**Priority:** HIGH
**Type:** Feature
**Acceptance Criteria:**
- AC-10.7.1: Optimize Web App Manifest: name, short_name, icons (192px, 512px, maskable), theme_color, background_color
- AC-10.7.2: Add custom splash screens for iOS (apple-touch-startup-image) and Android
- AC-10.7.3: App opens in `standalone` display mode (no browser chrome)
- AC-10.7.4: Smart install banner: prompt after 3rd visit or 2 minutes engagement (not immediately)
- AC-10.7.5: iOS-specific meta tags: apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style
- AC-10.7.6: Service Worker caches critical app shell for instant repeat loads (<500ms)
- AC-10.7.7: Offline fallback page with clear messaging when data is unavailable
- AC-10.7.8: App icon badge showing unread insights count (where supported)
- AC-10.7.9: Lighthouse PWA audit score: 90+ on all categories
- AC-10.7.10: Test on physical devices: iPhone (Safari), Android (Chrome), iPad
- AC-10.7.11: Unit tests for manifest configuration and install prompt logic

### Story 10-8: Mobile-Optimized Touch UI & Navigation
**Priority:** MEDIUM
**Type:** Feature
**Prerequisites:** Story 10-7
**Acceptance Criteria:**
- AC-10.8.1: Bottom navigation bar for mobile viewport (Dashboard, Transactions, Add, Insights, Settings)
- AC-10.8.2: "Add" button is prominent floating action button (FAB) or center nav item
- AC-10.8.3: Swipe-to-delete on transaction list items with confirmation
- AC-10.8.4: Pull-to-refresh on transaction list and dashboard
- AC-10.8.5: Touch targets minimum 48x48px (exceeds WCAG 44px requirement)
- AC-10.8.6: Haptic feedback on transaction save (where supported via Vibration API)
- AC-10.8.7: Mobile keyboard optimization: numeric keyboard for amount input, date picker for dates
- AC-10.8.8: Bottom sheet pattern for transaction entry on mobile (slides up from bottom)
- AC-10.8.9: Smooth 60fps scroll performance on transaction list (virtualization if >100 items)
- AC-10.8.10: Responsive breakpoints: mobile (<768px), tablet (768-1024px), desktop (>1024px)
- AC-10.8.11: Unit and component tests for mobile navigation, gestures, and responsive behavior

### Story 10-9: Write Integration Tests Using Test Utilities
**Priority:** CRITICAL (Infrastructure - 3 epics overdue)
**Type:** Infrastructure
**Acceptance Criteria:**
- AC-10.9.1: Write integration tests for authentication flow (register, login, logout, session persistence)
- AC-10.9.2: Write integration tests for transaction CRUD (create, read, update, delete with database)
- AC-10.9.3: Write integration tests for category management (create custom, edit, delete, prevent system delete)
- AC-10.9.4: Write integration tests for dashboard data aggregation (correct totals, chart data)
- AC-10.9.5: Write integration tests for AI insights generation (rules engine, caching, refresh)
- AC-10.9.6: Write integration tests for export flow (CSV generation, PDF generation)
- AC-10.9.7: Use `renderWithProviders()` from test utilities library (Story 9-2) for all tests
- AC-10.9.8: Mock Supabase at service boundary level (not individual function level)
- AC-10.9.9: Minimum 30 integration tests covering critical user paths
- AC-10.9.10: All integration tests pass in CI (Jest with extended timeout for integration)
- AC-10.9.11: Document integration test patterns in README or testing guide
- AC-10.9.12: All existing 559+ unit tests continue passing

### Story 10-10: CI/CD Pipeline Integration & Code Quality Hardening
**Priority:** MEDIUM (Infrastructure)
**Type:** Infrastructure
**Prerequisites:** Story 10-9
**Acceptance Criteria:**
- AC-10.10.1: Integrate `check-env-vars.js` into CI pipeline (GitHub Actions or Vercel build)
- AC-10.10.2: Integrate `pre-deployment-check.js` into CI pipeline
- AC-10.10.3: CI runs: lint, type-check, unit tests, integration tests, build validation on every PR
- AC-10.10.4: CI fails if any check fails (blocking merge)
- AC-10.10.5: Replace ~15 non-null assertion (`!`) shortcuts in source files with proper null handling
- AC-10.10.6: Add Lighthouse CI for performance regression detection (budget: 90+ performance, 90+ accessibility)
- AC-10.10.7: Add pre-review checklist to story template (epic8-medium-2 action item)
- AC-10.10.8: CI status badge in README.md
- AC-10.10.9: Deployment preview URLs for PR reviews (Vercel preview deployments)
- AC-10.10.10: All tests passing (unit + integration), zero TypeScript errors, zero lint warnings
- AC-10.10.11: Document CI/CD pipeline in deployment checklist (update docs/deployment-checklist.md)

---

## Technical Dependencies

**New NPM Dependencies:**
```json
{
  "dependencies": {
    "next-intl": "^3.x",
    "@formatjs/intl-numberformat": "^8.x"
  }
}
```

**No additional infrastructure dependencies** - uses existing Supabase, Vercel, and Redis stack.

**Environment Variables:**
```bash
# Exchange Rate API (Story 10-5)
EXCHANGE_RATE_API_URL=https://api.exchangerate-api.com/v4/latest/EUR
# or ECB: https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A

# No API key needed for ECB free rates
```

**Supabase Migrations:**
- `007_user_currency_preference.sql` - Add preferred_currency to user preferences (Story 10-3)
- `008_transaction_currency.sql` - Add currency, exchange_rate columns to transactions (Story 10-6)
- `009_exchange_rates_cache.sql` - Create exchange_rates table for caching (Story 10-5)

---

## Testing Strategy

**Story-Level Testing:**
- **Story 10-1 (i18n):** Locale detection, language switching, date/number formatting
- **Story 10-2 (Translations):** Translation key completeness, no missing keys, no layout overflow
- **Story 10-3 (Currency Config):** Currency formatting, preference persistence, default behavior
- **Story 10-4 (Currency Display):** formatCurrency function, all UI surfaces updated
- **Story 10-5 (Exchange Rates):** API integration, caching, fallback, staleness handling
- **Story 10-6 (Multi-Currency TX):** Transaction CRUD with currency, conversion, filtering
- **Story 10-7 (PWA):** Manifest validation, install prompt, offline fallback
- **Story 10-8 (Mobile UI):** Touch targets, swipe gestures, responsive breakpoints
- **Story 10-9 (Integration Tests):** 30+ integration tests across all critical flows
- **Story 10-10 (CI/CD):** Pipeline execution, blocking on failures, Lighthouse budgets

**Epic-Level Quality Gates:**
- All 559+ existing unit tests passing
- 30+ new integration tests passing
- Lighthouse PWA audit: 90+ on all categories
- Zero TypeScript errors, zero lint warnings
- All translations complete (no missing keys in bg.json)
- Currency formatting verified for EUR and USD locales

---

## Infrastructure Tracking

**Epic 10 Infrastructure Allocation:**
- Total Stories: 10
- Infrastructure Stories: 2 (20%) - Stories 10-9, 10-10
- Feature Stories: 8 (80%) - Stories 10-1 through 10-8
- Status: on_target (exactly 20%)

**Retrospective Action Items Addressed:**
- epic9-critical-1: Write integration tests (Story 10-9)
- epic9-high-1: Multi-currency support (Stories 10-3, 10-4, 10-5, 10-6)
- epic9-high-2: Bulgarian language UI (Stories 10-1, 10-2)
- epic9-high-3: Mobile app production preparation (Stories 10-7, 10-8)
- epic9-medium-1: CI/CD pipeline integration (Story 10-10)
- epic9-medium-2: Replace non-null assertions (Story 10-10)
- epic8-medium-2: Pre-review checklist (Story 10-10)

---

## Rollout and Deployment Plan

**Story 10-1, 10-2 (i18n + Translations):**
1. Deploy i18n framework with English as default
2. Enable Bulgarian language option in Settings
3. Test with Bulgarian-speaking users for translation quality

**Story 10-3 through 10-6 (Currency):**
1. Deploy currency preference (EUR default) - backward compatible
2. Deploy exchange rate service with caching
3. Deploy transaction currency support with migration (existing TX → EUR)
4. Monitor exchange rate API availability and fallback behavior

**Story 10-7, 10-8 (Mobile):**
1. Deploy enhanced PWA manifest and splash screens
2. Deploy mobile navigation and touch gestures
3. Run Lighthouse audit and address any issues
4. Test on physical iOS and Android devices

**Story 10-9, 10-10 (Infrastructure):**
1. Integration tests run in CI on every PR
2. Deployment scripts integrated into pipeline
3. Non-null assertions replaced gradually (no user-facing impact)

---

## Success Criteria

**Epic 10 Completion Criteria:**
- All 10 stories marked "done" in sprint-status.yaml
- App fully usable in Bulgarian language (100% of UI strings translated)
- Multi-currency working: EUR ↔ USD with daily exchange rates
- Lighthouse PWA score: 90+ on all categories
- 30+ integration tests passing in CI
- CI pipeline blocks broken PRs automatically
- Zero non-null assertion shortcuts in source files
- Mobile experience tested on physical devices (iPhone + Android)

**Metrics to Track:**
- Bulgarian language adoption rate (% of users switching to bg)
- Multi-currency usage (% of transactions in non-default currency)
- PWA install rate (new installs after Epic 10 enhancements)
- Integration test coverage (% of critical paths covered)
- CI pipeline reliability (% of builds completing successfully)

---

## References

**Retrospective Documents:**
- [Epic 9 Retrospective](epic-9-retro-2026-02-07.md) - Source of all Epic 10 action items
- [Epic 8 Retrospective](epic-8-retrospective.md) - Carry-forward items (pre-review checklist)

**Architecture Documents:**
- [Architecture](../../docs/architecture.md) - Technology stack and patterns
- [PRD](../../docs/PRD.md) - Functional requirements and growth phases

**Policy Documents:**
- [Infrastructure Policy](../../docs/process/infrastructure-policy.md) - 20% rule governing Story 10-9, 10-10

**External References:**
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [ECB Exchange Rates API](https://data-api.ecb.europa.eu/)
- [Web App Manifest Spec](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

---

**Next Steps:**
1. Review tech spec with team
2. Create 10 story markdown files in `docs/sprint-artifacts/stories/`
3. Update `sprint-status.yaml` with Epic 10 entries
4. Execute Story 10-1 (i18n Framework Setup) as first priority
