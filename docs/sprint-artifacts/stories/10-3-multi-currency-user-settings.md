# Story 10.3: Multi-Currency User Settings & Configuration

Status: done

## Story

As a budget-conscious user,
I want to choose my preferred currency (EUR or USD) in settings,
so that all monetary amounts display in the currency I use daily.

## Acceptance Criteria

**AC-10.3.1:** Add `preferred_currency` default to 'EUR' in user preferences
- Database migration sets default to EUR for new users
- Existing users with USD keep their preference

**AC-10.3.2:** Create currency configuration with supported currencies array
- Each currency has: code, symbol, name, locale
- Configuration is centralized and importable

**AC-10.3.3:** Initial supported currencies: EUR (Euro, default), USD (US Dollar)
- EUR is the default currency for new accounts
- USD available as secondary option

**AC-10.3.4:** Currency selector in Settings page under Preferences section
- Dropdown enabled for both EUR and USD (remove "Coming soon" restrictions)
- Changing currency triggers preference save via existing API

**AC-10.3.5:** Currency symbol displayed correctly: EUR (€), USD ($)
- formatCurrency utility updated to accept currency code parameter
- Symbol position and formatting follows locale conventions

**AC-10.3.6:** Currency formatting respects locale
- EUR: €1.234,56 (bg locale) / €1,234.56 (en locale)
- USD: $1,234.56 (en locale) / 1 234,56 $ (bg locale)

**AC-10.3.7:** Changing preferred currency updates all dashboard displays immediately
- SWR revalidation triggers re-render with new currency
- Optimistic UI update for instant feedback

**AC-10.3.8:** Currency preference syncs across devices via Supabase
- Uses existing user_profiles.preferences JSONB column
- No new database table needed

**AC-10.3.9:** Migration script for existing users (set default to EUR)
- New migration file: 007_user_currency_preference.sql
- Existing users with no explicit currency default to EUR

**AC-10.3.10:** Unit tests for currency configuration, formatting, and preference persistence
- Tests for SUPPORTED_CURRENCIES configuration
- Tests for formatCurrency with different currency codes
- Tests for formatCurrencyWithSign with different currencies

## Tasks / Subtasks

- [ ] Task 1: Create story and context files (AC: admin)
  - [ ] Create story markdown file
  - [ ] Create context XML file
  - [ ] Update sprint-status.yaml to in-progress

- [ ] Task 2: Create currency configuration module (AC: 10.3.2, 10.3.3)
  - [ ] Create src/lib/config/currencies.ts with SUPPORTED_CURRENCIES
  - [ ] Define CurrencyConfig type with code, symbol, name, locale
  - [ ] Add helper functions: getCurrencyConfig, getDefaultCurrency

- [ ] Task 3: Update formatCurrency utility (AC: 10.3.5, 10.3.6)
  - [ ] Add currencyCode parameter to formatCurrency
  - [ ] Update formatCurrencyWithSign to support multi-currency
  - [ ] Default to EUR when no currency specified

- [ ] Task 4: Update user preferences defaults (AC: 10.3.1, 10.3.8)
  - [ ] Change default currency_format from 'USD' to 'EUR' in types
  - [ ] Update useUserPreferences hook default
  - [ ] Update settingsService default preferences

- [ ] Task 5: Create database migration (AC: 10.3.9)
  - [ ] Create 007_user_currency_preference.sql
  - [ ] Update default preferences for new users to EUR

- [ ] Task 6: Enable currency selector in Settings (AC: 10.3.4, 10.3.7)
  - [ ] Remove disabled/coming-soon from EUR and GBP options
  - [ ] Enable EUR and USD options (keep GBP as coming soon)
  - [ ] Add currency symbols and proper labels
  - [ ] Ensure SWR revalidation on currency change

- [ ] Task 7: Add i18n translation keys (AC: 10.3.4, 10.3.5)
  - [ ] Add currency-related keys to en.json
  - [ ] Add corresponding Bulgarian translations to bg.json

- [ ] Task 8: Write unit tests (AC: 10.3.10)
  - [ ] Test SUPPORTED_CURRENCIES configuration
  - [ ] Test formatCurrency with EUR, USD, and locale variants
  - [ ] Test formatCurrencyWithSign with EUR and USD
  - [ ] Test getCurrencyConfig helper

- [ ] Task 9: Run full verification
  - [ ] Run TypeScript type check
  - [ ] Run all tests
  - [ ] Run linter
  - [ ] Update story status to done

## Dev Notes

### Architecture Patterns and Constraints

- **Preferences stored as JSONB**: User preferences are in `user_profiles.preferences` JSONB column. No schema change needed - just update default values.
- **Existing preference flow**: Settings page → handleUpdatePreferences() → PUT /api/user/profile → settingsService.updateUserProfile() → Supabase update → SWR revalidation.
- **formatCurrency usage**: Used in DashboardStats, SpendingTrendsChart, CategorySpendingChart, MonthOverMonth. Story 10-4 will update all callsites; this story updates the utility itself.
- **next-intl pattern**: All new UI strings use `useTranslations(namespace)` hook.
- **Default change**: EUR becomes the new default (per tech spec). The change is backward-compatible since existing users have explicit preferences saved.

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#Story-10-3] - Acceptance criteria
- [Source: docs/sprint-artifacts/stories/10-2-bulgarian-language-translations.md] - Previous story patterns

## Dev Agent Record

### Context Reference

- [Story 10-3 Context](10-3-multi-currency-user-settings.context.xml)

### Agent Model Used

Claude Opus 4.6

### Debug Log References

TBD

### Completion Notes List

TBD

### Change Log

- 2026-02-12: Story created and implementation started

### File List

TBD
