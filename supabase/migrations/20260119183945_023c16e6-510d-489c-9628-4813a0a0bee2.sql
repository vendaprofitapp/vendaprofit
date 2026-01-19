-- Add video_url column to products table
ALTER TABLE public.products 
ADD COLUMN video_url text NULL;