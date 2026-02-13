
-- Add shipping integration columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS origin_zip text,
  ADD COLUMN IF NOT EXISTS melhor_envio_token text,
  ADD COLUMN IF NOT EXISTS superfrete_token text;

-- Add weight and dimensions columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_grams integer,
  ADD COLUMN IF NOT EXISTS width_cm integer,
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS length_cm integer;
