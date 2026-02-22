CREATE OR REPLACE FUNCTION public.auto_share_new_product_to_partnerships()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only auto-share if product has a cost_price set
  IF NEW.cost_price IS NULL OR NEW.cost_price <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.product_partnerships (group_id, product_id)
  SELECT pas.group_id, NEW.id
  FROM public.partnership_auto_share pas
  JOIN public.groups g ON g.id = pas.group_id
  WHERE pas.owner_id = NEW.owner_id
    AND pas.enabled = true
  ON CONFLICT (group_id, product_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Also update set_partnership_auto_share to only share products with cost_price
CREATE OR REPLACE FUNCTION public.set_partnership_auto_share(_group_id uuid, _enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.partnership_auto_share (group_id, owner_id, enabled)
  VALUES (_group_id, _uid, _enabled)
  ON CONFLICT (group_id, owner_id)
  DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

  IF _enabled THEN
    INSERT INTO public.product_partnerships (group_id, product_id)
    SELECT _group_id, p.id
    FROM public.products p
    WHERE p.owner_id = _uid
      AND p.is_active = true
      AND p.cost_price IS NOT NULL
      AND p.cost_price > 0
    ON CONFLICT (group_id, product_id) DO NOTHING;
  ELSE
    DELETE FROM public.product_partnerships pp
    USING public.products p
    WHERE pp.group_id = _group_id
      AND pp.product_id = p.id
      AND p.owner_id = _uid;
  END IF;
END;
$function$;