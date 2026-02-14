
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS favicon_url text;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS page_title text;
