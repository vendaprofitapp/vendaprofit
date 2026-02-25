
-- Allow group members to manage (delete/insert) profit_share splits
-- for partnership sales retroactive recalculation.
-- Restricted to type = 'profit_share' only for safety.

-- 1. Drop restrictive DELETE policy and replace with one that also covers partners
DROP POLICY IF EXISTS "Users can delete splits for their sales" ON public.financial_splits;

CREATE POLICY "Users can delete splits for their sales"
ON public.financial_splits
FOR DELETE
USING (
  -- own sales
  EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = financial_splits.sale_id
      AND s.owner_id = auth.uid()
  )
  OR
  -- partner recalculation: group member deleting profit_share splits
  (
    financial_splits.type = 'profit_share'
    AND EXISTS (
      SELECT 1 FROM sales s
      JOIN group_members gm1 ON gm1.user_id = auth.uid()
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id = s.owner_id
      WHERE s.id = financial_splits.sale_id
        AND gm1.user_id <> gm2.user_id
    )
  )
);

-- 2. Drop restrictive INSERT policy and replace with one that also covers partners
DROP POLICY IF EXISTS "Users can insert splits for their sales" ON public.financial_splits;

CREATE POLICY "Users can insert splits for their sales"
ON public.financial_splits
FOR INSERT
WITH CHECK (
  -- own sales
  EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = financial_splits.sale_id
      AND s.owner_id = auth.uid()
  )
  OR
  -- partner recalculation: group member inserting profit_share splits
  (
    financial_splits.type = 'profit_share'
    AND EXISTS (
      SELECT 1 FROM sales s
      JOIN group_members gm1 ON gm1.user_id = auth.uid()
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id = s.owner_id
      WHERE s.id = financial_splits.sale_id
        AND gm1.user_id <> gm2.user_id
    )
  )
);
