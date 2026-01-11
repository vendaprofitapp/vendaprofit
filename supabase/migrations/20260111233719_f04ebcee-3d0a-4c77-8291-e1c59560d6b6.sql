-- Add image columns to product_variants table for per-color images
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_url_2 TEXT,
ADD COLUMN IF NOT EXISTS image_url_3 TEXT;