-- Fix infinite recursion in RLS policies by using SECURITY DEFINER helper functions

-- 1) Helper functions (bypass RLS safely)
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = _group_id
      AND gm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = _group_id
      AND gm.user_id = _user_id
      AND gm.role IN ('owner', 'admin')
  );
$$;

-- 2) group_members policies (remove self-referencing queries)
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON public.group_members;

CREATE POLICY "Members can view group members"
ON public.group_members
FOR SELECT
USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Group admins can add members"
ON public.group_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR public.is_group_admin(group_id, auth.uid())
);

CREATE POLICY "Group admins can remove members"
ON public.group_members
FOR DELETE
USING (
  user_id = auth.uid()
  OR public.is_group_admin(group_id, auth.uid())
);

-- 3) groups policies (use helper functions)
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Group owners can update" ON public.groups;

CREATE POLICY "Members can view their groups"
ON public.groups
FOR SELECT
USING (public.is_group_member(id, auth.uid()));

CREATE POLICY "Group owners can update"
ON public.groups
FOR UPDATE
USING (public.is_group_admin(id, auth.uid()));

-- 4) products policy (avoid calling group_members directly)
DROP POLICY IF EXISTS "Users can view group products" ON public.products;

CREATE POLICY "Users can view group products"
ON public.products
FOR SELECT
USING (
  group_id IS NOT NULL
  AND public.is_group_member(group_id, auth.uid())
);

-- 5) stock_requests insert policy (avoid joining group_members directly)
DROP POLICY IF EXISTS "Users can create requests for group products" ON public.stock_requests;

CREATE POLICY "Users can create requests for group products"
ON public.stock_requests
FOR INSERT
WITH CHECK (
  requester_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = stock_requests.product_id
      AND p.group_id IS NOT NULL
      AND public.is_group_member(p.group_id, auth.uid())
  )
);
