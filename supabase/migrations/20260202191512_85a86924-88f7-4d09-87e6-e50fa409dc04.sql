-- Add policy to allow users to view products that are shared through partnerships they are members of
CREATE POLICY "Users can view products shared in their partnerships"
ON public.products
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM product_partnerships pp
    JOIN group_members gm ON gm.group_id = pp.group_id
    WHERE pp.product_id = products.id
    AND gm.user_id = auth.uid()
  )
);