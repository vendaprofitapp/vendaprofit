
ALTER TABLE public.hub_shared_products
  ADD COLUMN IF NOT EXISTS hub_approval_type TEXT NOT NULL DEFAULT 'automatic' CHECK (hub_approval_type IN ('manual', 'automatic')),
  ADD COLUMN IF NOT EXISTS hub_pricing_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (hub_pricing_mode IN ('fixed', 'commission')),
  ADD COLUMN IF NOT EXISTS hub_fixed_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hub_minimum_sale_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hub_commission_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hub_configured BOOLEAN NOT NULL DEFAULT false;
