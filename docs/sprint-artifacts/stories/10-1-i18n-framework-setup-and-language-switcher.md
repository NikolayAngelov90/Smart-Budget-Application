# Story 10.1: i18n Framework Setup & Language Switcher

Status: ready-for-dev

## Story

As a user who speaks Bulgarian,
I want the application to support multiple languages with a language switcher,
so that I can use the budget application entirely in my native language.

## Acceptance Criteria

**AC-10.1.1:** Install and configure `next-intl` with Next.js App Router
- Install `next-intl` package
- Configure Next.js middleware for locale routing
- Set up `next-intl` provider in the app layout
- Default locale: `en`, supported locales: `en`, `bg`

**AC-10.1.2:** Create translation file structure: `messages/en.json` and `messages/bg.json`
- Create `messages/en.json` with all extracted English strings organized by namespace
- Create `messages/bg.json` as a skeleton with identical keys (values can be English placeholders for now - full translation is Story 10-2)
- Namespace structure: `common`, `navigation`, `dashboard`, `transactions`, `categories`, `insights`, `settings`, `onboarding`, `validation`, `toast`

**AC-10.1.3:** Extract all hardcoded English strings from components into translation keys
- Extract ~200+ hardcoded strings from all components (Settings page, TransactionEntryModal, OnboardingModal, Sidebar, DashboardStats, OfflineBanner, SyncStatusIndicator, ActiveDevicesSection, ProfilePictureUpload, CategoryModal, Insights components, Header)
- Replace string literals with `useTranslations()` hook calls
- Extract default category names from `src/lib/utils/constants.ts` into translation keys
- Extract all Zod validation messages into translation keys

**AC-10.1.4:** Add language switcher component in Settings page
- Create `LanguageSwitcher` component (dropdown: English / Български)
- Place in Settings page under Preferences section (alongside existing Currency Format and Date Format dropdowns)
- Language change takes effect immediately without page reload

**AC-10.1.5:** Language preference persisted in user profile
- Add `language` field to `UserPreferences` interface (`'en' | 'bg'`)
- Update Supabase `user_profiles` table default preferences JSON to include `"language": "en"`
- Persist language selection via existing `useUserPreferences` hook and PATCH `/api/user/preferences` endpoint
- Language preference syncs across devices via Supabase

**AC-10.1.6:** Default language detection from browser `navigator.language` on first visit
- On first visit (before user has set preference), detect browser language
- If browser language starts with `bg`, default to Bulgarian; otherwise default to English
- Once user explicitly sets a preference, browser detection is overridden

**AC-10.1.7:** All date formatting uses locale-aware formatters
- Update `src/lib/utils/dateFormatter.ts` to accept locale parameter
- `en` locale: MM/DD/YYYY format (existing behavior)
- `bg` locale: DD.MM.YYYY format with Bulgarian month/day names
- Integrate `date-fns` locale imports (`date-fns/locale/bg`, `date-fns/locale/enUS`)

**AC-10.1.8:** All number formatting uses locale-aware formatters
- Update `src/lib/utils/currency.ts` `formatCurrency()` to accept locale parameter
- `en` locale: 1,234.56 (existing behavior)
- `bg` locale: 1 234,56 (space as thousands separator, comma as decimal)
- Use `Intl.NumberFormat` with locale parameter instead of hardcoded `'en-US'`

**AC-10.1.9:** Unit tests for language switching, locale detection, and format helpers
- Test `next-intl` provider renders with correct locale
- Test language switcher component changes locale
- Test browser language detection logic
- Test `formatCurrency()` with both `en` and `bg` locales
- Test `dateFormatter` with both `en` and `bg` locales
- Test translation key lookup returns correct strings per locale

**AC-10.1.10:** Existing tests remain passing (585+ tests)
- All existing unit tests pass without modification (or with minimal i18n wrapper updates)
- Provide `renderWithIntl()` test helper or update existing `renderWithProviders()` to include i18n context

## Tasks / Subtasks

- [ ] Task 1: Install and configure next-intl (AC: 10.1.1)
  - [ ] Install `next-intl` package via npm
  - [ ] Create `src/i18n/` directory structure
  - [ ] Create `src/i18n/request.ts` for server-side locale configuration
  - [ ] Create `src/i18n/routing.ts` for locale routing configuration
  - [ ] Create or update `src/middleware.ts` to add next-intl middleware for locale detection
  - [ ] Update `src/app/layout.tsx` to wrap with `NextIntlClientProvider`
  - [ ] Update `src/app/providers.tsx` to include i18n provider if needed
  - [ ] Verify app still builds and runs correctly with next-intl configured

- [ ] Task 2: Create translation file structure (AC: 10.1.2)
  - [ ] Create `messages/en.json` with namespaced structure
  - [ ] Organize keys by namespace: `common`, `navigation`, `dashboard`, `transactions`, `categories`, `insights`, `settings`, `onboarding`, `validation`, `toast`
  - [ ] Create `messages/bg.json` as skeleton with same keys (English placeholder values for now)
  - [ ] Verify translation files load correctly via next-intl

- [ ] Task 3: Extract hardcoded strings from components (AC: 10.1.3)
  - [ ] Extract strings from `src/components/layout/Sidebar.tsx` (navigation labels: Dashboard, Transactions, Categories, Insights, Settings)
  - [ ] Extract strings from `src/components/layout/Header.tsx` (logout error)
  - [ ] Extract strings from `src/components/dashboard/DashboardStats.tsx` (stat card labels, trend text)
  - [ ] Extract strings from `src/components/transactions/TransactionEntryModal.tsx` (form labels, validation, toast messages)
  - [ ] Extract strings from `src/app/(dashboard)/settings/page.tsx` (section headings, labels, descriptions, buttons)
  - [ ] Extract strings from `src/components/common/OnboardingModal.tsx` (step titles, descriptions, buttons)
  - [ ] Extract strings from `src/components/categories/CategoryModal.tsx` (validation messages)
  - [ ] Extract strings from `src/components/shared/OfflineBanner.tsx` (offline/online messages)
  - [ ] Extract strings from `src/components/shared/SyncStatusIndicator.tsx` (sync status labels)
  - [ ] Extract strings from `src/components/settings/ActiveDevicesSection.tsx` (device management labels)
  - [ ] Extract strings from `src/components/settings/ProfilePictureUpload.tsx` (upload messages)
  - [ ] Extract strings from insights components (dismiss/restore, refresh messages)
  - [ ] Extract default category names from `src/lib/utils/constants.ts`
  - [ ] Extract Zod validation messages from form schemas

- [ ] Task 4: Create language switcher component (AC: 10.1.4)
  - [ ] Create `src/components/settings/LanguageSwitcher.tsx` component
  - [ ] Implement as Chakra UI `Select` dropdown matching existing Settings page style
  - [ ] Options: English (en), Български (bg)
  - [ ] Wire up locale change via next-intl's `useRouter` and `usePathname`
  - [ ] Add to Settings page Preferences section between existing dropdowns

- [ ] Task 5: Persist language preference in user profile (AC: 10.1.5)
  - [ ] Add `language: 'en' | 'bg'` to `UserPreferences` interface in `src/types/user.types.ts`
  - [ ] Update default preferences in Supabase migration or seed data to include `"language": "en"`
  - [ ] Update `useUserPreferences` hook to expose `language` field
  - [ ] Wire LanguageSwitcher to save preference via existing preferences PATCH endpoint
  - [ ] Load saved language preference on app initialization and set next-intl locale

- [ ] Task 6: Implement browser language detection (AC: 10.1.6)
  - [ ] Create `src/i18n/detectLocale.ts` utility function
  - [ ] Check `navigator.language` for `bg` prefix
  - [ ] Only apply detection when no saved user preference exists
  - [ ] Integrate detection into app initialization flow (middleware or client-side)

- [ ] Task 7: Update date formatting for locale awareness (AC: 10.1.7)
  - [ ] Update `src/lib/utils/dateFormatter.ts` to import `date-fns/locale/bg` and `date-fns/locale/enUS`
  - [ ] Add locale parameter to `formatDate()` and related functions
  - [ ] Map user locale to date-fns locale object
  - [ ] Update all date formatting call sites to pass current locale
  - [ ] Verify Bulgarian date format: DD.MM.YYYY with Bulgarian month names

- [ ] Task 8: Update number/currency formatting for locale awareness (AC: 10.1.8)
  - [ ] Update `src/lib/utils/currency.ts` `formatCurrency()` to accept locale parameter
  - [ ] Replace hardcoded `'en-US'` in `Intl.NumberFormat` with dynamic locale
  - [ ] Map `'bg'` locale to `'bg-BG'` for `Intl.NumberFormat`
  - [ ] Update all `formatCurrency()` call sites to pass current locale
  - [ ] Verify Bulgarian number format: `1 234,56` with correct separators

- [ ] Task 9: Write unit tests (AC: 10.1.9, 10.1.10)
  - [ ] Create or update test helper `renderWithIntl()` wrapping components with next-intl provider
  - [ ] Write tests for LanguageSwitcher component (renders, changes locale)
  - [ ] Write tests for `detectLocale()` utility (bg browser, en browser, no preference)
  - [ ] Write tests for `formatCurrency()` with `en` and `bg` locales
  - [ ] Write tests for `formatDate()` with `en` and `bg` locales
  - [ ] Write tests for translation key resolution (correct string returned per locale)
  - [ ] Update existing test setup to provide i18n context (mock or real provider)
  - [ ] Run full test suite to verify all 585+ existing tests still pass
  - [ ] Run TypeScript type-check (`npx tsc --noEmit`) to verify zero errors
  - [ ] Run ESLint to verify zero warnings

## Dev Notes

### Architecture Patterns and Constraints

- **Next.js App Router**: The app uses Next.js 15+ with App Router pattern. `next-intl` v3+ has first-class App Router support with server components. Use `next-intl`'s recommended App Router setup (not Pages Router patterns).
  [Source: docs/architecture.md#Core-Technologies]

- **Provider Chain**: Current providers are ChakraProvider > SWRConfig > PWAAnalyticsProvider (in `src/app/providers.tsx`). The `NextIntlClientProvider` should wrap at the layout level, above or alongside existing providers.
  [Source: src/app/providers.tsx]

- **SWR for Data Fetching**: User preferences are fetched via SWR (`useUserPreferences` hook). Language preference should follow the same pattern - read from cached preferences, update via PATCH endpoint.
  [Source: docs/architecture.md#State-Management-Strategy]

- **Chakra UI Components**: All UI uses Chakra UI 2.8+. The language switcher should use Chakra's `Select` or `Menu` component to match existing Settings page styling.
  [Source: docs/architecture.md#UI-Framework]

- **Existing Currency Formatting**: `src/lib/utils/currency.ts` already uses `Intl.NumberFormat` with hardcoded `'en-US'`. This is a clean foundation - just parameterize the locale.
  [Source: src/lib/utils/currency.ts]

- **Existing Date Formatting**: `src/lib/utils/dateFormatter.ts` uses `date-fns` with a `DATE_FORMAT_MAP` driven by user preferences. Add locale awareness by importing `date-fns/locale/bg`.
  [Source: src/lib/utils/dateFormatter.ts]

- **User Preferences Schema**: `UserPreferences` interface in `src/types/user.types.ts` currently has `currency_format` and `date_format`. Add `language` field. Supabase `user_profiles` table stores preferences as JSONB.
  [Source: src/types/user.types.ts, supabase/migrations/004_user_profiles_table.sql]

- **Settings Page Structure**: Settings page at `src/app/(dashboard)/settings/page.tsx` has a Preferences section with Currency Format and Date Format dropdowns. Language switcher goes here.
  [Source: src/app/(dashboard)/settings/page.tsx]

- **Testing Framework**: Jest + React Testing Library. Use existing `renderWithProviders()` from test utilities (Story 9-2) and extend it to include i18n context.
  [Source: docs/architecture.md#Testing-Strategy]

- **200+ Hardcoded Strings**: The codebase has ~200+ hardcoded English strings across ~15 component files. The highest density files are: Settings page (~30+), TransactionEntryModal (~20+), OnboardingModal (~10+), and various shared components.

### Project Structure Notes

**New Files:**
- `messages/en.json` - English translation file
- `messages/bg.json` - Bulgarian translation file (skeleton for Story 10-2)
- `src/i18n/request.ts` - Server-side i18n configuration
- `src/i18n/routing.ts` - Locale routing configuration
- `src/i18n/detectLocale.ts` - Browser locale detection utility
- `src/components/settings/LanguageSwitcher.tsx` - Language switcher component

**Modified Files:**
- `src/middleware.ts` - Add next-intl locale middleware
- `src/app/layout.tsx` - Wrap with NextIntlClientProvider
- `src/app/providers.tsx` - Potentially add i18n provider
- `src/types/user.types.ts` - Add `language` to UserPreferences
- `src/lib/utils/currency.ts` - Parameterize locale in formatCurrency
- `src/lib/utils/dateFormatter.ts` - Add locale parameter with date-fns locale imports
- `src/lib/utils/constants.ts` - Extract default category names to translation keys
- `src/app/(dashboard)/settings/page.tsx` - Add LanguageSwitcher, extract strings
- `src/components/layout/Sidebar.tsx` - Extract navigation labels
- `src/components/layout/Header.tsx` - Extract strings
- `src/components/dashboard/DashboardStats.tsx` - Extract stat labels
- `src/components/transactions/TransactionEntryModal.tsx` - Extract form strings
- `src/components/common/OnboardingModal.tsx` - Extract onboarding strings
- `src/components/categories/CategoryModal.tsx` - Extract validation messages
- `src/components/shared/OfflineBanner.tsx` - Extract offline messages
- `src/components/shared/SyncStatusIndicator.tsx` - Extract sync labels
- `src/components/settings/ActiveDevicesSection.tsx` - Extract device labels
- `src/components/settings/ProfilePictureUpload.tsx` - Extract upload messages
- Various insight components - Extract insight-related strings
- Test helper files - Add i18n test wrapper

### Learnings from Previous Story

**From Story 9-10 (Status: done)**

- **Process Story**: Story 9-10 was a process/documentation story (formalizing the 20% infrastructure rule), not a code implementation story. No new services or reusable code patterns were created.
- **Infrastructure Tracking**: `sprint-status.yaml` now includes an `infrastructure_tracking` section per epic with `infrastructure_percentage`, `infrastructure_stories`, and `feature_stories` lists. Story 10-1 is classified as a feature story.
- **Sprint Status Schema**: Story type metadata (infrastructure vs feature) is now tracked. Story 10-1 should maintain this schema.
- **Dev Agent Record**: Previous story's Dev Agent Record sections (Debug Log, Completion Notes, File List) were left as TBD placeholders - ensure this story fills them in properly during implementation.

[Source: stories/9-10-formalize-20-percent-infrastructure-rule.md#Dev-Agent-Record]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#Story-10-1] - Acceptance criteria and technical requirements
- [Source: docs/architecture.md#Core-Technologies] - Next.js App Router, Chakra UI, SWR patterns
- [Source: docs/architecture.md#Testing-Strategy] - Jest + React Testing Library approach
- [Source: docs/architecture.md#Performance-Architecture] - SWR caching, code splitting patterns
- [Source: src/lib/utils/currency.ts] - Existing currency formatting with Intl.NumberFormat
- [Source: src/lib/utils/dateFormatter.ts] - Existing date formatting with date-fns
- [Source: src/types/user.types.ts] - UserPreferences interface
- [Source: src/app/providers.tsx] - Current provider chain
- [Source: supabase/migrations/004_user_profiles_table.sql] - User profiles table schema

## Dev Agent Record

### Context Reference

- [Story 10-1 Context](10-1-i18n-framework-setup-and-language-switcher.context.xml)

### Agent Model Used

TBD

### Debug Log References

TBD

### Completion Notes List

TBD

### Change Log

- 2026-02-07: Story drafted by SM workflow from tech-spec-epic-10.md acceptance criteria

### File List

TBD
