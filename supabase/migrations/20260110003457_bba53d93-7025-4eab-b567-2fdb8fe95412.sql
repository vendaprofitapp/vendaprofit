
-- Drop the old policy that checks group_id directly on products
DROP POLICY IF EXISTS "Users can create requests for group products" ON public.stock_requests;

-- Create a helper function to check if a product is shared with the user via product_partnerships
CREATE OR REPLACE FUNCTION public.is_product_shared_with_user(_product_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.product_partnerships pp
    JOIN public.group_members gm ON gm.group_id = pp.group_id
    WHERE pp.product_id = _product_id
      AND gm.user_id = _user_id
  )
$$;

-- Create new policy that uses product_partnerships for checking access
CREATE POLICY "Users can create requests for shared products"
ON public.stock_requests
FOR INSERT
WITH CHECK (
  requester_id = auth.uid()
  AND public.is_product_shared_with_user(product_id, auth.uid())
);
