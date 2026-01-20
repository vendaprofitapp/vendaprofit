-- Add columns to control visibility of store URL and description
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS show_store_url boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_store_description boolean DEFAULT true;