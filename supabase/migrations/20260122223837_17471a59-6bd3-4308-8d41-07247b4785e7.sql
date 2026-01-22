-- Add marketing_status column to product_variants table (per-size/color marketing)
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS marketing_status text;

-- Add marketing_status column to products table (product-level fallback)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS marketing_status text;

-- Add check constraints to ensure valid values
ALTER TABLE public.product_variants 
ADD CONSTRAINT product_variants_marketing_status_check 
CHECK (marketing_status IS NULL OR marketing_status IN ('opportunity', 'presale', 'launch'));

ALTER TABLE public.products 
ADD CONSTRAINT products_marketing_status_check 
CHECK (marketing_status IS NULL OR marketing_status IN ('opportunity', 'presale', 'launch'));

-- Create indexes for efficient filtering by marketing status
CREATE INDEX IF NOT EXISTS idx_product_variants_marketing_status 
ON public.product_variants(marketing_status) 
WHERE marketing_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_marketing_status 
ON public.products(marketing_status) 
WHERE marketing_status IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.product_variants.marketing_status IS 'Marketing status: opportunity (oportunidade), presale (pré-venda), launch (lançamento), or null (normal)';
COMMENT ON COLUMN public.products.marketing_status IS 'Product-level marketing status fallback';