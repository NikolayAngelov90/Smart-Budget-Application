-- Story 10-5: Exchange Rate Integration
-- Creates exchange_rates_cache table for persistent rate storage
-- This serves as a fallback when Redis cache is evicted

-- Exchange rates cache table
CREATE TABLE IF NOT EXISTS public.exchange_rates_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_currency VARCHAR(3) NOT NULL,
  target_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(16, 8) NOT NULL,
  rate_date DATE NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Unique constraint: one rate per base/target/date combination
  CONSTRAINT unique_rate_per_day UNIQUE (base_currency, target_currency, rate_date)
);

-- Index for fast lookups by base currency and date
CREATE INDEX IF NOT EXISTS idx_exchange_rates_base_date
  ON public.exchange_rates_cache (base_currency, rate_date DESC);

-- Index for fast lookups by currency pair
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair
  ON public.exchange_rates_cache (base_currency, target_currency, rate_date DESC);

-- Enable RLS
ALTER TABLE public.exchange_rates_cache ENABLE ROW LEVEL SECURITY;

-- Exchange rates are public read (any authenticated user can read rates)
CREATE POLICY "Authenticated users can read exchange rates"
  ON public.exchange_rates_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update rates (server-side only)
CREATE POLICY "Service role can manage exchange rates"
  ON public.exchange_rates_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE public.exchange_rates_cache IS 'Persistent cache for exchange rates. Primary cache is Redis with 1-hour TTL; this table serves as fallback.';
