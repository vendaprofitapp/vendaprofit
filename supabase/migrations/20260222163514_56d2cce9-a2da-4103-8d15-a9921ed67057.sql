
-- Function to validate if a buyer (by phone) has can_buy permission
CREATE OR REPLACE FUNCTION public.validate_bazar_buyer(_owner_id uuid, _buyer_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM customer_bazar_permissions cbp
    JOIN customers c ON c.id = cbp.customer_id
    WHERE cbp.owner_id = _owner_id
      AND cbp.can_buy = true
      AND c.phone IS NOT NULL
      AND regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(_buyer_phone, '\D', '', 'g')
  );
$$;
