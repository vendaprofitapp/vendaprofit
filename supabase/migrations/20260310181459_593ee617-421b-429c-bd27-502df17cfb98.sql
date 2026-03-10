
-- Add payment proof URL columns to hub_pending_orders
ALTER TABLE public.hub_pending_orders
  ADD COLUMN IF NOT EXISTS supplier_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS platform_receipt_url TEXT;

-- Add pix_key to store_settings so suppliers can set their payment key
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS pix_key TEXT;
