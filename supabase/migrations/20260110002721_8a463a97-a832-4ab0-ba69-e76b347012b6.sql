
-- 1) Helper function to check product ownership without invoking products RLS (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_product_owner(_product_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = _product_id
      AND p.owner_id = _user_id
  )
$$;

-- 2) Recreate product_partnerships policies to use is_product_owner()
DROP POLICY IF EXISTS "Product owners can insert product partnerships" ON public.product_partnerships;
DROP POLICY IF EXISTS "Product owners can delete product partnerships" ON public.product_partnerships;

CREATE POLICY "Product owners can insert product partnerships"
ON public.product_partnerships
FOR INSERT
WITH CHECK (
  public.is_product_owner(product_id, auth.uid())
  AND public.is_group_member(group_id, auth.uid())
);

CREATE POLICY "Product owners can delete product partnerships"
ON public.product_partnerships
FOR DELETE
USING (
  public.is_product_owner(product_id, auth.uid())
);

-- 3) Ensure the auto-share trigger exists (so new products are auto-shared)
DROP TRIGGER IF EXISTS trg_auto_share_new_product_to_partnerships ON public.products;
CREATE TRIGGER trg_auto_share_new_product_to_partnerships
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.auto_share_new_product_to_partnerships();
