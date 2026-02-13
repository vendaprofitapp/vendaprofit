-- Add shipping_label_url column to sales table
ALTER TABLE public.sales
ADD COLUMN shipping_label_url TEXT DEFAULT NULL;