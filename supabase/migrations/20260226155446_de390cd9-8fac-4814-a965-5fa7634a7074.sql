
-- Allow HUB sellers to read products from owners they have active hub connections with
CREATE POLICY "Hub sellers can view owner products"
  ON public.products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.hub_connections hc
      WHERE hc.owner_id = products.owner_id
        AND hc.seller_id = auth.uid()
        AND hc.status = 'active'
    )
  );
