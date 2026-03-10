
-- Add hub fee fields to profiles (per-supplier negotiated rate)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_fee_type TEXT CHECK (hub_fee_type IN ('fixed', 'percentage')),
  ADD COLUMN IF NOT EXISTS hub_fee_value NUMERIC DEFAULT NULL;

-- Add admin override fee fields to products (per-product exception)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS admin_hub_fee_type TEXT CHECK (admin_hub_fee_type IN ('fixed', 'percentage')),
  ADD COLUMN IF NOT EXISTS admin_hub_fee_value NUMERIC DEFAULT NULL;
