
-- Add post-sale fields to bazar_items
ALTER TABLE public.bazar_items
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_zip text,
  ADD COLUMN IF NOT EXISTS shipping_cost numeric,
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS shipping_service text,
  ADD COLUMN IF NOT EXISTS shipping_source text,
  ADD COLUMN IF NOT EXISTS shipping_service_id integer,
  ADD COLUMN IF NOT EXISTS shipping_label_url text,
  ADD COLUMN IF NOT EXISTS shipping_tracking text,
  ADD COLUMN IF NOT EXISTS sold_at timestamptz;

-- Public SELECT policy for approved bazar items (needed for showcase)
CREATE POLICY "Anyone can view approved bazar items"
  ON public.bazar_items
  FOR SELECT
  USING (status = 'approved');
