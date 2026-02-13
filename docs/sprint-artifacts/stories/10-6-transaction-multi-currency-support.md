# Story 10.6: Transaction Multi-Currency Support

Status: done

## Story

As a user who deals with multiple currencies,
I want to record transactions in their original currency and see converted equivalents,
so that my financial data accurately reflects real-world multi-currency spending.

## Acceptance Criteria

- **AC-10.6.1**: Add `currency` column to transactions table (default: user's preferred currency)
- **AC-10.6.2**: Add `exchange_rate` column to transactions table (rate at time of entry, nullable)
- **AC-10.6.3**: Transaction entry modal includes currency selector (small toggle next to amount field)
- **AC-10.6.4**: Default currency in entry modal matches user's preferred currency
- **AC-10.6.5**: When transaction currency differs from preferred, exchange rate auto-populated
- **AC-10.6.6**: Transaction list shows original amount and currency, with converted equivalent in parentheses
- **AC-10.6.7**: Filter transactions by currency (all, EUR only, USD only)
- **AC-10.6.8**: Edit transaction preserves original currency and exchange rate
- **AC-10.6.9**: CSV export includes columns: amount, currency, exchange_rate, converted_amount
- **AC-10.6.10**: Database migration with backward compatibility (existing transactions default to EUR)
- **AC-10.6.11**: Unit and component tests for multi-currency transaction flow

## Implementation Notes

### Architecture
- Database migration: `supabase/migrations/010_transaction_currency.sql`
- Updated types: `src/types/database.types.ts` (Transaction Row/Insert/Update)
- API changes: `src/app/api/transactions/route.ts` (GET currency filter, POST accept currency)
- API changes: `src/app/api/transactions/[id]/route.ts` (PUT accept currency)
- UI: `src/components/transactions/TransactionEntryModal.tsx` (currency selector)
- UI: `src/app/transactions/page.tsx` (currency display + filter)
- Export: `src/lib/services/exportService.ts` (new CSV columns)

### Prerequisites (all done)
- Story 10-3: SUPPORTED_CURRENCIES config, getEnabledCurrencies()
- Story 10-4: formatCurrency utility with currencyCode parameter
- Story 10-5: exchangeRateService with convertCurrency(), getExchangeRate()

## Dev Notes

- Existing transactions get currency='EUR' (the app default) via migration
- Exchange rate is only stored when currency differs from user's preferred currency
- The convertCurrency utility from Story 10-5 handles all conversion math
- Currency selector uses getEnabledCurrencies() for the dropdown options
