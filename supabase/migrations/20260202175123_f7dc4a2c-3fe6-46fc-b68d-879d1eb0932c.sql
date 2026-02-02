-- Add video_url column to product_variants table
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS video_url text DEFAULT NULL;