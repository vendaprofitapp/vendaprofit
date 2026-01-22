-- Create a function to merge categories (transfer products from source to destination)
CREATE OR REPLACE FUNCTION public.merge_categories(source_name text, destination_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update category field
  UPDATE public.products
  SET category = destination_name
  WHERE category = source_name;
  
  -- Update category_2 field
  UPDATE public.products
  SET category_2 = destination_name
  WHERE category_2 = source_name;
  
  -- Update category_3 field
  UPDATE public.products
  SET category_3 = destination_name
  WHERE category_3 = source_name;
END;
$$;