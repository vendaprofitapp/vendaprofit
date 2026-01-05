-- Fix RLS for INSERT ... RETURNING: allow creator to see newly created group immediately
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;

CREATE POLICY "Members can view their groups"
ON public.groups
FOR SELECT
TO authenticated
USING (
  (created_by = auth.uid())
  OR public.is_group_member(id, auth.uid())
);