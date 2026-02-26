
CREATE POLICY "Public can view products shared via hub connections"
ON public.products
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM hub_shared_products hsp
    JOIN hub_connections hc ON hc.id = hsp.connection_id
    WHERE hsp.product_id = products.id
      AND hsp.is_active = true
      AND hc.status = 'active'
  )
);
