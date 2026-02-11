
-- Allow group members to view profiles of fellow group members
CREATE POLICY "Group members can view fellow members profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid()
      AND gm2.user_id = profiles.id
      AND gm1.user_id != gm2.user_id
  )
);
