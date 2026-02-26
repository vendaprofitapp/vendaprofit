
-- Allow owner_id to also read hub_sale_splits (they need this for the settlement screen)
-- The existing policy only covers owner for ALL operations, but let's ensure SELECT is explicit
-- Also allow reading when user is involved in the connection (as owner or seller)

DROP POLICY IF EXISTS "hub_sale_splits_owner_all" ON public.hub_sale_splits;
DROP POLICY IF EXISTS "hub_sale_splits_seller_read" ON public.hub_sale_splits;
DROP POLICY IF EXISTS "hub_sale_splits_seller_insert" ON public.hub_sale_splits;

-- Owner can do everything
CREATE POLICY "hub_sale_splits_owner_all"
  ON public.hub_sale_splits
  FOR ALL
  USING (auth.uid() = owner_id);

-- Seller can read their own splits
CREATE POLICY "hub_sale_splits_seller_read"
  ON public.hub_sale_splits
  FOR SELECT
  USING (auth.uid() = seller_id);

-- Allow reading splits for anyone who is part of the hub_connection (owner or seller)
-- This covers the settlement screen query filtered by connection_id
CREATE POLICY "hub_sale_splits_connection_member_read"
  ON public.hub_sale_splits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hub_connections hc
      WHERE hc.id = hub_sale_splits.connection_id
        AND (hc.owner_id = auth.uid() OR hc.seller_id = auth.uid())
    )
  );

-- Seller can insert splits
CREATE POLICY "hub_sale_splits_seller_insert"
  ON public.hub_sale_splits
  FOR INSERT
  WITH CHECK (auth.uid() = seller_id);
