CREATE POLICY "Partners can view splits from same group sales"
  ON public.financial_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      JOIN group_members gm1 ON gm1.user_id = auth.uid()
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id = s.owner_id
      WHERE s.id = financial_splits.sale_id
        AND gm1.user_id != gm2.user_id
    )
  );