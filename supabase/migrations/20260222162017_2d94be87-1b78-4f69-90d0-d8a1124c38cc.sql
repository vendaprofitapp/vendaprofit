-- Allow anonymous inserts to bazar_items when the seller has a valid bazar_token with can_sell=true
CREATE POLICY "Sellers can submit bazar items via token"
ON public.bazar_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_bazar_permissions cbp
    WHERE cbp.owner_id = bazar_items.owner_id
      AND cbp.can_sell = true
      AND cbp.bazar_token IS NOT NULL
      AND (
        -- Match by phone
        EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = cbp.customer_id
            AND c.phone IS NOT NULL
            AND c.phone != ''
            AND replace(replace(replace(replace(c.phone, '(', ''), ')', ''), '-', ''), ' ', '') 
              LIKE '%' || replace(replace(replace(replace(bazar_items.seller_phone, '(', ''), ')', ''), '-', ''), ' ', '')
        )
      )
  )
);
