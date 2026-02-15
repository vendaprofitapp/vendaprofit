
-- Allow partners in the same group to view each other's sales
CREATE POLICY "Partners can view sales from same group"
  ON public.sales FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()
        AND gm2.user_id = sales.owner_id
        AND gm1.user_id != gm2.user_id
    )
  );

-- Allow partners to view sale_items for partner sales
CREATE POLICY "Partners can view sale items from same group"
  ON public.sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      JOIN group_members gm1 ON gm1.user_id = auth.uid()
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id = s.owner_id
      WHERE s.id = sale_items.sale_id
        AND gm1.user_id != gm2.user_id
    )
  );
