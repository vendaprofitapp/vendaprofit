
-- Add a JSONB column to store per-status marketing prices
-- e.g. {"opportunity": 99.90, "secret": 79.90}
ALTER TABLE public.product_variants
ADD COLUMN marketing_prices jsonb DEFAULT NULL;

-- Migrate existing marketing_price data into the new column
-- For variants that have both marketing_status and marketing_price, 
-- create a JSON object with the price for each status
UPDATE public.product_variants
SET marketing_prices = (
  SELECT jsonb_object_agg(status, marketing_price)
  FROM unnest(marketing_status) AS status
)
WHERE marketing_status IS NOT NULL 
  AND array_length(marketing_status, 1) > 0
  AND marketing_price IS NOT NULL;
