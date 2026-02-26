
-- Allow anonymous users to read product_variants for products shared via active HUB connections
CREATE POLICY "Public can read variants of hub shared products"
ON public.product_variants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM hub_shared_products hsp
    JOIN hub_connections hc ON hc.id = hsp.connection_id
    WHERE hsp.product_id = product_variants.product_id
      AND hsp.is_active = true
      AND hc.status = 'active'
  )
);
