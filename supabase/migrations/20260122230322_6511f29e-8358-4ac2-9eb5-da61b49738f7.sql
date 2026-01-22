-- Add marketing-specific fields to product_variants
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS marketing_price numeric(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS marketing_delivery_days integer DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.product_variants.marketing_price IS 'Special price when variant has a marketing status (opportunity, presale, launch)';
COMMENT ON COLUMN public.product_variants.marketing_delivery_days IS 'Estimated delivery days for presale variants';