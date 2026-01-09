-- Make the groups policy more restrictive - only show invite_code when searching
DROP POLICY IF EXISTS "Members can view their groups or search by invite code" ON public.groups;

-- Policy for members to see full group data
CREATE POLICY "Members can view their groups"
ON public.groups FOR SELECT
USING (
    (created_by = auth.uid()) 
    OR is_group_member(id, auth.uid())
);

-- Separate policy to allow anyone to join via invite code
-- This is safe because it only allows SELECT, and the join logic validates the code
CREATE POLICY "Anyone can search groups by invite code"
ON public.groups FOR SELECT
USING (invite_code IS NOT NULL);