-- Allow HUB sellers to view sales linked to their hub_sale_splits
CREATE POLICY "Hub sellers can view sales from splits"
ON public.sales
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hub_sale_splits hss
    WHERE hss.sale_id = sales.id
      AND (hss.seller_id = auth.uid() OR hss.owner_id = auth.uid())
  )
);