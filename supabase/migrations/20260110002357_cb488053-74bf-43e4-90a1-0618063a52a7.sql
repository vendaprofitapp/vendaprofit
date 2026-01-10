
-- First drop all dependent policies manually
DROP POLICY IF EXISTS "Group members can view partnership rules" ON public.partnership_rules;
DROP POLICY IF EXISTS "Group members can view product partnerships" ON public.product_partnerships;
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Product owners can insert product partnerships" ON public.product_partnerships;
DROP POLICY IF EXISTS "Users can create requests for group products" ON public.stock_requests;
DROP POLICY IF EXISTS "Users can view group products" ON public.products;
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Group admins can insert partnership rules" ON public.partnership_rules;
DROP POLICY IF EXISTS "Group admins can update partnership rules" ON public.partnership_rules;
DROP POLICY IF EXISTS "Group admins can delete partnership rules" ON public.partnership_rules;
DROP POLICY IF EXISTS "Group admins can delete product partnerships" ON public.product_partnerships;
DROP POLICY IF EXISTS "Group owners can update" ON public.groups;
DROP POLICY IF EXISTS "Group admins can delete groups" ON public.groups;
DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON public.group_members;
DROP POLICY IF EXISTS "Product owners can delete product partnerships" ON public.product_partnerships;
DROP POLICY IF EXISTS "Public can read product partnerships" ON public.product_partnerships;
DROP POLICY IF EXISTS "Public can view product partnerships for active stores" ON public.product_partnerships;
DROP POLICY IF EXISTS "Public can view partnerships for active stores" ON public.product_partnerships;

-- Now drop and recreate the functions
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_admin(uuid, uuid) CASCADE;

-- Recreate is_group_member with SECURITY DEFINER and STABLE
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
  )
$$;

-- Recreate is_group_admin with SECURITY DEFINER and STABLE
CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Recreate all policies for group_members
CREATE POLICY "Members can view group members" 
ON public.group_members FOR SELECT 
USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Group admins can add members" 
ON public.group_members FOR INSERT 
WITH CHECK ((user_id = auth.uid()) OR public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Group admins can remove members" 
ON public.group_members FOR DELETE 
USING ((user_id = auth.uid()) OR public.is_group_admin(group_id, auth.uid()));

-- Recreate policies for groups
CREATE POLICY "Members can view their groups" 
ON public.groups FOR SELECT 
USING ((created_by = auth.uid()) OR public.is_group_member(id, auth.uid()));

CREATE POLICY "Group owners can update" 
ON public.groups FOR UPDATE 
USING (public.is_group_admin(id, auth.uid()));

CREATE POLICY "Group admins can delete groups" 
ON public.groups FOR DELETE 
USING (public.is_group_admin(id, auth.uid()));

-- Recreate policies for partnership_rules
CREATE POLICY "Group members can view partnership rules" 
ON public.partnership_rules FOR SELECT 
USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Group admins can insert partnership rules" 
ON public.partnership_rules FOR INSERT 
WITH CHECK (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Group admins can update partnership rules" 
ON public.partnership_rules FOR UPDATE 
USING (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Group admins can delete partnership rules" 
ON public.partnership_rules FOR DELETE 
USING (public.is_group_admin(group_id, auth.uid()));

-- Recreate policies for product_partnerships
CREATE POLICY "Group members can view product partnerships" 
ON public.product_partnerships FOR SELECT 
USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Product owners can insert product partnerships" 
ON public.product_partnerships FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id AND p.owner_id = auth.uid()
  )
  AND public.is_group_member(group_id, auth.uid())
);

CREATE POLICY "Product owners can delete product partnerships" 
ON public.product_partnerships FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Group admins can delete product partnerships" 
ON public.product_partnerships FOR DELETE 
USING (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Public can view partnerships for active stores" 
ON public.product_partnerships FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.store_partnerships sp
    JOIN public.store_settings ss ON ss.id = sp.store_id
    WHERE sp.group_id = product_partnerships.group_id 
    AND ss.is_active = true
  )
);

-- Recreate policies for products
CREATE POLICY "Users can view group products" 
ON public.products FOR SELECT 
USING ((group_id IS NOT NULL) AND public.is_group_member(group_id, auth.uid()));

-- Recreate policies for stock_requests
CREATE POLICY "Users can create requests for group products" 
ON public.stock_requests FOR INSERT 
WITH CHECK (
  (requester_id = auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id 
    AND p.group_id IS NOT NULL 
    AND public.is_group_member(p.group_id, auth.uid())
  )
);
