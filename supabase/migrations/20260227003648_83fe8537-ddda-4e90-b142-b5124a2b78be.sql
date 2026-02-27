
-- Drop all existing SELECT policies on hub_sale_splits and create a single clear one
DROP POLICY IF EXISTS "Allow members to read splits" ON public.hub_sale_splits;
DROP POLICY IF EXISTS "Hub members can view splits" ON public.hub_sale_splits;
DROP POLICY IF EXISTS "Users can view their hub splits" ON public.hub_sale_splits;
DROP POLICY IF EXISTS "hub_sale_splits_select" ON public.hub_sale_splits;

-- Simple, unambiguous RLS policy
CREATE POLICY "Allow members to read splits"
  ON public.hub_sale_splits
  FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = seller_id);

-- Ensure INSERT policy exists for owner
DROP POLICY IF EXISTS "Allow owner to insert splits" ON public.hub_sale_splits;
CREATE POLICY "Allow owner to insert splits"
  ON public.hub_sale_splits
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
