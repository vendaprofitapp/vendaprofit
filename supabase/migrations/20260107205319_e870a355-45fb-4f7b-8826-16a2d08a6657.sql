-- Add public read access for product_partnerships when part of active store
CREATE POLICY "Public can view product partnerships for active stores"
ON public.product_partnerships
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM store_partnerships sp
    JOIN store_settings ss ON ss.id = sp.store_id
    WHERE sp.group_id = product_partnerships.group_id
    AND ss.is_active = true
  )
);