-- Add index on product_variants.product_id for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants (product_id);

-- Add index on products.owner_id for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON public.products (owner_id);

-- Add index on store_settings.owner_id for the public variant RLS policy join
CREATE INDEX IF NOT EXISTS idx_store_settings_owner_id ON public.store_settings (owner_id);