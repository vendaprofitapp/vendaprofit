-- Add category_2 and category_3 columns to products table for multi-category support (up to 3 categories)
ALTER TABLE public.products 
ADD COLUMN category_2 text,
ADD COLUMN category_3 text;