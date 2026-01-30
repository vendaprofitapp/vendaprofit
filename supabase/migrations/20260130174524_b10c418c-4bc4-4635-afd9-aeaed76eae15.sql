-- Add bio video columns to landing_page_settings for Video Sales Bubble feature
ALTER TABLE public.landing_page_settings 
ADD COLUMN IF NOT EXISTS bio_video_preview text,
ADD COLUMN IF NOT EXISTS bio_video_full text;

-- Add comment for documentation
COMMENT ON COLUMN public.landing_page_settings.bio_video_preview IS 'URL for the short/loop video displayed in the floating bubble';
COMMENT ON COLUMN public.landing_page_settings.bio_video_full IS 'URL for the full presentation video (Stories style)';