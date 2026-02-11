# Story 10.2: Bulgarian Language Translations

Status: done

## Story

As a Bulgarian-speaking user,
I want the entire application UI to be translated to Bulgarian,
so that I can use the budget application comfortably in my native language.

## Acceptance Criteria

**AC-10.2.1:** Complete `messages/bg.json` with all UI strings translated to Bulgarian
- All 14+ namespaces fully translated with natural, contextually appropriate Bulgarian text
- Preserve interpolation variables (e.g., `{time}`, `{max}`, `{current}`)

**AC-10.2.2:** Navigation labels translated
- Dashboard → Табло, Transactions → Транзакции, Categories → Категории, Insights → Прегледи, Settings → Настройки

**AC-10.2.3:** All form labels, placeholders, and validation messages translated
- Transaction entry form, category form, settings forms, search fields
- Validation messages use proper Bulgarian grammar

**AC-10.2.4:** All error messages and toast notifications translated
- API error messages, success toasts, warning messages

**AC-10.2.5:** AI insight text templates translated (coaching tone preserved in Bulgarian)
- AI Budget Coach heading, empty state, insight card labels

**AC-10.2.6:** Onboarding modal content translated
- 3-step onboarding with motivational Bulgarian text preserving the coaching tone

**AC-10.2.7:** Pre-defined category names translated
- Dining → Хранене, Transport → Транспорт, Entertainment → Забавления, Utilities → Комунални, Shopping → Пазаруване, Healthcare → Здравеопазване, Rent → Наем, Salary → Заплата, Freelance → Свободна практика, Investment → Инвестиции, Gift → Подарък

**AC-10.2.8:** Date picker and calendar components display Bulgarian month/day names
- Already handled by date-fns bg locale from Story 10-1

**AC-10.2.9:** Visual verification: no text overflow or layout breaks with Bulgarian strings
- Cyrillic text is typically wider; verify key UI areas don't break

**AC-10.2.10:** Unit tests verifying all translation keys exist in both en.json and bg.json
- Extend existing translation consistency tests
- Add test detecting untranslated placeholder values in bg.json

## Tasks / Subtasks

- [ ] Task 1: Create story and context files (AC: admin)
  - [ ] Create story markdown file
  - [ ] Create context XML file
  - [ ] Update sprint-status.yaml to in-progress

- [ ] Task 2: Translate all existing bg.json values to Bulgarian (AC: 10.2.1-10.2.7)
  - [ ] Translate `common` namespace (22 keys)
  - [ ] Translate `navigation` namespace (7 keys)
  - [ ] Translate `dashboard` namespace (7 keys)
  - [ ] Translate `transactions` namespace (23 keys)
  - [ ] Translate `categories` namespace (16 keys including default category names)
  - [ ] Translate `insights` namespace (10 keys)
  - [ ] Translate `settings` namespace (40 keys)
  - [ ] Translate `onboarding` namespace (8 keys)
  - [ ] Translate `validation` namespace (13 keys)
  - [ ] Translate `toast` namespace (4 keys)
  - [ ] Translate `sync` namespace (7 keys)
  - [ ] Translate `offline` namespace (3 keys)
  - [ ] Translate `devices` namespace (11 keys)
  - [ ] Translate `profile` namespace (8 keys)
  - [ ] Translate `header` namespace (3 keys)

- [ ] Task 3: Extract hardcoded strings from remaining components (AC: 10.2.1, 10.2.3-10.2.5)
  - [ ] Dashboard page: extract page title, subtitle, section headings
  - [ ] AIBudgetCoach: extract heading, empty state, error state, link text
  - [ ] InsightsPageContent: extract heading, subtitle, error state, empty states, button text
  - [ ] AIInsightCard: extract priority labels, dismiss/undismiss, "See Details"
  - [ ] InsightsFilters: extract filter labels, type options, "Show dismissed"
  - [ ] ConfirmDeleteModal: extract modal title, warnings, form labels, buttons
  - [ ] PaginationControls: extract pagination labels, error messages
  - [ ] Transactions page: extract filter labels, empty states, dialogs, toast messages
  - [ ] Categories page: extract headings, tab labels, dialogs, toast messages

- [ ] Task 4: Update translation consistency tests (AC: 10.2.10)
  - [ ] Add test detecting untranslated bg.json values (value === en.json value)
  - [ ] Add allowlist for legitimate matches (proper nouns, identical words)
  - [ ] Ensure new `pagination` namespace is covered in key parity tests

- [ ] Task 5: Run full verification (AC: 10.2.9, 10.2.10)
  - [ ] Run TypeScript type check
  - [ ] Run all tests
  - [ ] Run linter
  - [ ] Update story status to done

## Dev Notes

### Architecture Patterns and Constraints

- **next-intl pattern**: Client components use `useTranslations(namespace)` hook. Import at top of component, call `t('key')` or `t('key', { param: value })` for interpolation.
- **Jest mock**: `jest.setup.js` has a global mock for `next-intl` that loads actual `en.json` translations. Tests query by English text and will continue working.
- **Translation file format**: Flat key-value within namespaces. Nested objects for grouped keys (e.g., `categories.defaultCategories.dining`).
- **Interpolation syntax**: `{variableName}` for simple substitution. `t.rich()` for rich text with tags.

### Learnings from Story 10-1

- ESM module resolution: `next-intl/server` uses ESM exports incompatible with Jest. Resolved with `src/i18n/config.ts` shared constants.
- Jest mock loads real `en.json` translations so existing tests continue working with English text queries.
- Some components not i18n-ized in 10-1: ConfirmDeleteModal, PaginationControls, Insights components, Dashboard page, Transactions page, Categories page.

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#Story-10-2] - Acceptance criteria
- [Source: docs/sprint-artifacts/stories/10-1-i18n-framework-setup-and-language-switcher.md] - Prerequisites and patterns

## Dev Agent Record

### Context Reference

- [Story 10-2 Context](10-2-bulgarian-language-translations.context.xml)

### Agent Model Used

Claude Opus 4.6

### Debug Log References

TBD

### Completion Notes List

TBD

### Change Log

- 2026-02-10: Story created and implementation started

### File List

TBD
