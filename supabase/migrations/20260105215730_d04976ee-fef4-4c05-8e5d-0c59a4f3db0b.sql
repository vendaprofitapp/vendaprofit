-- Fix group creation RLS reliably by setting created_by server-side
-- and only requiring a valid authenticated user.

-- 1) Set created_by automatically
CREATE OR REPLACE FUNCTION public.set_groups_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_groups_created_by ON public.groups;
CREATE TRIGGER set_groups_created_by
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_groups_created_by();

-- 2) Make INSERT policy only require authentication (created_by is set by trigger)
ALTER POLICY "Authenticated users can create groups"
ON public.groups
WITH CHECK (auth.uid() IS NOT NULL);

-- 3) Allow admins/owners to delete a group (cascades clean up related rows)
DROP POLICY IF EXISTS "Group admins can delete groups" ON public.groups;
CREATE POLICY "Group admins can delete groups"
ON public.groups
FOR DELETE
TO public
USING (is_group_admin(id, auth.uid()));

-- 4) Allow group admins to delete product partnerships so cascade delete won't fail
DROP POLICY IF EXISTS "Group admins can delete product partnerships" ON public.product_partnerships;
CREATE POLICY "Group admins can delete product partnerships"
ON public.product_partnerships
FOR DELETE
TO public
USING (is_group_admin(group_id, auth.uid()));