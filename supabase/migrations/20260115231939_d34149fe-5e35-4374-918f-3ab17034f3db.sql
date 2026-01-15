-- Fix variants uniqueness: allow multiple colors per size
-- Old constraint blocks inserting two variants with same size but different colors
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_product_id_size_key;

-- In some setups the unique constraint is backed by an index with the same name
DROP INDEX IF EXISTS public.product_variants_product_id_size_key;

-- Create a new uniqueness rule per (product, color, size)
-- Use COALESCE so NULL colors are treated consistently
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_unique_product_color_size
  ON public.product_variants (product_id, (COALESCE(color, '')), size);
