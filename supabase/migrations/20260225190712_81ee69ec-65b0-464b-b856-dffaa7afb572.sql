
DROP POLICY IF EXISTS "Group admins can insert partnership rules" ON public.partnership_rules;
DROP POLICY IF EXISTS "Group admins can update partnership rules" ON public.partnership_rules;
DROP POLICY IF EXISTS "Group admins can delete partnership rules" ON public.partnership_rules;

CREATE POLICY "Group admins can insert partnership rules"
ON public.partnership_rules FOR INSERT
WITH CHECK (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Group admins can update partnership rules"
ON public.partnership_rules FOR UPDATE
USING (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "Group admins can delete partnership rules"
ON public.partnership_rules FOR DELETE
USING (public.is_group_admin(group_id, auth.uid()));
