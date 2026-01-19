-- Add separate banner image for mobile
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS banner_url_mobile TEXT DEFAULT NULL;