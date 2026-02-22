-- Drop the complex phone-matching policy and replace with a simpler token-based approach
DROP POLICY IF EXISTS "Sellers can submit bazar items via token" ON public.bazar_items;

-- Create a security definer function to validate bazar seller submissions
CREATE OR REPLACE FUNCTION public.validate_bazar_seller(_owner_id uuid, _seller_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM customer_bazar_permissions cbp
    JOIN customers c ON c.id = cbp.customer_id
    WHERE cbp.owner_id = _owner_id
      AND cbp.can_sell = true
      AND c.phone IS NOT NULL
      AND regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(_seller_phone, '\D', '', 'g')
  );
$$;

-- Simpler policy using the function
CREATE POLICY "Sellers can submit bazar items via token"
ON public.bazar_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.validate_bazar_seller(owner_id, seller_phone)
);
