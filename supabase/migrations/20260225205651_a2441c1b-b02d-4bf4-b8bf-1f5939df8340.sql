
-- Fix: Allow any group MEMBER (not just admin) to update partnership_rules and groups
-- in direct (1-1) partnerships, since both partners are co-owners.

-- 1. Fix partnership_rules UPDATE policy
DROP POLICY IF EXISTS "Group admins can update partnership rules" ON public.partnership_rules;

CREATE POLICY "Group members can update partnership rules"
ON public.partnership_rules
FOR UPDATE
USING (is_group_member(group_id, auth.uid()))
WITH CHECK (is_group_member(group_id, auth.uid()));

-- 2. Fix partnership_rules INSERT policy
DROP POLICY IF EXISTS "Group admins can insert partnership rules" ON public.partnership_rules;

CREATE POLICY "Group members can insert partnership rules"
ON public.partnership_rules
FOR INSERT
WITH CHECK (is_group_member(group_id, auth.uid()));

-- 3. Fix groups UPDATE policy to allow members of direct groups to update
DROP POLICY IF EXISTS "Group owners can update qual" ON public.groups;
DROP POLICY IF EXISTS "Group owners can update" ON public.groups;

CREATE POLICY "Group admins or direct members can update groups"
ON public.groups
FOR UPDATE
USING (
  is_group_admin(id, auth.uid())
  OR (is_direct = true AND is_group_member(id, auth.uid()))
)
WITH CHECK (
  is_group_admin(id, auth.uid())
  OR (is_direct = true AND is_group_member(id, auth.uid()))
);
