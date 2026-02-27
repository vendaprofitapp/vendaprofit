
-- Add product_id and product_name columns to hub_sale_splits
ALTER TABLE public.hub_sale_splits 
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Populate product_id and product_name retroactively from sale_items
UPDATE public.hub_sale_splits hss
SET 
  product_id = si.product_id,
  product_name = si.product_name
FROM public.sales s
JOIN public.sale_items si ON si.sale_id = s.id
WHERE hss.sale_id = s.id
  AND hss.product_id IS NULL;
