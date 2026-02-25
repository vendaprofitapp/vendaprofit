
-- Fix UPDATE policy for partnership_rules to include WITH CHECK
DROP POLICY IF EXISTS "Group admins can update partnership rules" ON public.partnership_rules;

CREATE POLICY "Group admins can update partnership rules"
ON public.partnership_rules
FOR UPDATE
USING (is_group_admin(group_id, auth.uid()))
WITH CHECK (is_group_admin(group_id, auth.uid()));
