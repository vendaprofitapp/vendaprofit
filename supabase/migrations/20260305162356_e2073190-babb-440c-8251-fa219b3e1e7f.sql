
ALTER TABLE public.landing_page_settings
  ADD COLUMN IF NOT EXISTS header_login_link text NOT NULL DEFAULT '/auth',
  ADD COLUMN IF NOT EXISTS header_cta_link text NOT NULL DEFAULT '/auth',
  ADD COLUMN IF NOT EXISTS hero_cta_primary_link text NOT NULL DEFAULT '/auth',
  ADD COLUMN IF NOT EXISTS hero_cta_secondary_link text NOT NULL DEFAULT '#video',
  ADD COLUMN IF NOT EXISTS cta_button_link text NOT NULL DEFAULT '/auth';
