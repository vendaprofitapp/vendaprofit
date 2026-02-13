
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
  
  -- Copy products from admin with 0 stock
  INSERT INTO public.products (
    owner_id, name, description, category, price, cost_price, sku, size, color,
    stock_quantity, min_stock_level, image_url, is_active, image_url_2, image_url_3,
    category_2, category_3, video_url
  )
  SELECT 
    NEW.id, name, description, category, price, cost_price, sku, size, color,
    0, min_stock_level, image_url, is_active, image_url_2, image_url_3,
    category_2, category_3, video_url
  FROM public.products
  WHERE owner_id = _admin_id
    AND stock_quantity = 0;
  
  RETURN NEW;
END;
$function$;
