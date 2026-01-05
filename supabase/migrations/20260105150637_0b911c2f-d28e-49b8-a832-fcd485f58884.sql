-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
DROP POLICY IF EXISTS "Users can view group products" ON public.products;

-- Recreate as PERMISSIVE policies (default, so any policy can grant access)
CREATE POLICY "Users can view own products" 
ON public.products 
FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Users can view group products" 
ON public.products 
FOR SELECT 
USING (
  group_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_members.group_id = products.group_id 
    AND group_members.user_id = auth.uid()
  )
);