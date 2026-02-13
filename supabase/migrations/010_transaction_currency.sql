-- Migration: Add multi-currency support to transactions table
-- Story 10-6: Transaction Multi-Currency Support
-- AC-10.6.1: Add currency column (default: user's preferred currency)
-- AC-10.6.2: Add exchange_rate column (rate at time of entry, nullable)
-- AC-10.6.10: Backward compatibility (existing transactions default to EUR)

-- Add currency column with EUR default (matches app default currency)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'EUR';

-- Add exchange_rate column (nullable - only set when currency differs from preferred)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(16, 8) DEFAULT NULL;

-- Add index for currency filtering (AC-10.6.7)
CREATE INDEX IF NOT EXISTS idx_transactions_currency
  ON public.transactions(user_id, currency);

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.currency IS 'ISO 4217 currency code for this transaction (e.g., EUR, USD, GBP)';
COMMENT ON COLUMN public.transactions.exchange_rate IS 'Exchange rate at time of entry: 1 transaction_currency = exchange_rate preferred_currency. NULL when same as preferred currency.';
