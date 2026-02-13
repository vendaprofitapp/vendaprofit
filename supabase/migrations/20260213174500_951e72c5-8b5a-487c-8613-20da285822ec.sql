
-- Add address columns to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text;

-- Add shipping columns to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS shipping_method text,
  ADD COLUMN IF NOT EXISTS shipping_company text,
  ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_payer text,
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS shipping_notes text,
  ADD COLUMN IF NOT EXISTS shipping_tracking text;
