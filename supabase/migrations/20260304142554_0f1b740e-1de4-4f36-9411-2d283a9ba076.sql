
ALTER TABLE public.consignment_items
  ADD COLUMN IF NOT EXISTS swap_requested_size TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS swap_requested_product_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS swap_requested_product_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS swap_requested_variant_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS swap_requested_price NUMERIC DEFAULT NULL;
