-- Add color column to product_variants table
ALTER TABLE public.product_variants 
ADD COLUMN color TEXT;

-- Create index for better performance when filtering by color
CREATE INDEX idx_product_variants_color ON public.product_variants(color);