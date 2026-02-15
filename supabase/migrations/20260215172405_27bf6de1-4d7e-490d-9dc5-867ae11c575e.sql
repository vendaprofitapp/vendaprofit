
-- Add denormalized product info to stock_requests
ALTER TABLE public.stock_requests ADD COLUMN product_name text;
ALTER TABLE public.stock_requests ADD COLUMN product_price numeric;

-- Backfill existing records
UPDATE public.stock_requests sr
SET product_name = p.name, product_price = p.price
FROM public.products p
WHERE sr.product_id = p.id AND sr.product_name IS NULL;
