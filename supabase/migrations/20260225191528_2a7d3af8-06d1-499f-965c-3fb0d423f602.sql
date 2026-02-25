
DROP POLICY IF EXISTS "Group admins can insert partnership rules" ON public.partnership_rules;

CREATE POLICY "Group admins can insert partnership rules"
ON public.partnership_rules FOR INSERT
WITH CHECK (public.is_group_admin(group_id, auth.uid()));
