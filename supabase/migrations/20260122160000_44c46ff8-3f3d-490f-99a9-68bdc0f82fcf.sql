-- Function to copy default data from admin to new users
CREATE OR REPLACE FUNCTION public.copy_admin_defaults_to_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id uuid;
BEGIN
  -- Get the admin user id
  SELECT ur.user_id INTO _admin_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;
  
  -- If no admin found or the new user IS the admin, skip
  IF _admin_id IS NULL OR NEW.id = _admin_id THEN
    RETURN NEW;
  END IF;
  
  -- Copy categories from admin
  INSERT INTO public.categories (name, owner_id)
  SELECT name, NEW.id
  FROM public.categories
  WHERE owner_id = _admin_id
  ON CONFLICT DO NOTHING;
  
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
  
  -- Copy products from admin with 0 stock (template products)
  INSERT INTO public.products (
    owner_id, name, description, category, price, cost_price, sku, size, color,
    stock_quantity, min_stock_level, image_url, is_active, image_url_2, image_url_3,
    category_2, category_3, video_url
  )
  SELECT 
    NEW.id, name, description, category, price, cost_price, sku, size, color,
    0, -- stock_quantity always 0 for new users
    min_stock_level, image_url, is_active, image_url_2, image_url_3,
    category_2, category_3, video_url
  FROM public.products
  WHERE owner_id = _admin_id
    AND stock_quantity = 0; -- Only copy products that have 0 stock in admin
  
  RETURN NEW;
END;
$$;

-- Create trigger to run after profile is created (which happens after user signup)
DROP TRIGGER IF EXISTS on_profile_created_copy_defaults ON public.profiles;
CREATE TRIGGER on_profile_created_copy_defaults
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_admin_defaults_to_new_user();