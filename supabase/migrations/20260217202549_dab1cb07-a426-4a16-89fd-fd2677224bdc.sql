
-- Add catalog_synced column to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS catalog_synced boolean NOT NULL DEFAULT false;

-- Update trigger to stop copying products
CREATE OR REPLACE FUNCTION public.copy_admin_defaults_to_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id uuid;
BEGIN
  SELECT ur.user_id INTO _admin_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;
  
  IF _admin_id IS NULL OR NEW.id = _admin_id THEN
    RETURN NEW;
  END IF;
  
  -- Copy suppliers from admin
  INSERT INTO public.suppliers (owner_id, name, cnpj, phone, email, address, notes, attendant_name, attendant_phone, purchase_rules, website)
  SELECT NEW.id, name, cnpj, phone, email, address, notes, attendant_name, attendant_phone, purchase_rules, website
  FROM public.suppliers
  WHERE owner_id = _admin_id;
  
  -- Copy custom payment methods from admin
  INSERT INTO public.custom_payment_methods (owner_id, name, fee_percent, is_deferred, is_active)
  SELECT NEW.id, name, fee_percent, is_deferred, is_active
  FROM public.custom_payment_methods
  WHERE owner_id = _admin_id;
  
  -- Products are NO LONGER copied here.
  -- Users start with zero products and activate supplier catalogs on demand.
  
  RETURN NEW;
END;
$function$;
