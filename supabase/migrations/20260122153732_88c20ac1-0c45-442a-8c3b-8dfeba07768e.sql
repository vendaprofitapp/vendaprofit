-- Create a function to rename a category across all products
CREATE OR REPLACE FUNCTION public.rename_category_in_products(old_name text, new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update category field
  UPDATE public.products
  SET category = new_name
  WHERE category = old_name;
  
  -- Update category_2 field
  UPDATE public.products
  SET category_2 = new_name
  WHERE category_2 = old_name;
  
  -- Update category_3 field
  UPDATE public.products
  SET category_3 = new_name
  WHERE category_3 = old_name;
END;
$$;

-- Create a function to clear a category from all products
CREATE OR REPLACE FUNCTION public.clear_category_from_products(category_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear category field
  UPDATE public.products
  SET category = NULL
  WHERE category = category_name;
  
  -- Clear category_2 field
  UPDATE public.products
  SET category_2 = NULL
  WHERE category_2 = category_name;
  
  -- Clear category_3 field
  UPDATE public.products
  SET category_3 = NULL
  WHERE category_3 = category_name;
END;
$$;